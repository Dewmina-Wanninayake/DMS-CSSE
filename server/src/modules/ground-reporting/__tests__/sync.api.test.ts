import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SYNC_BATCH_MAX } from '@dms/shared';
import { Scenario, minutesAgo, queued } from './helpers';

let s: Scenario;
beforeEach(() => {
  s = new Scenario();
});

const sync = (actor: Scenario['citizen'], reports: unknown[]) =>
  s.post('/reports/sync', actor, { reports });

describe('POST /reports/sync (offline queue)', () => {
  it('should create every queued report, in the order given', async () => {
    const batch = [
      queued({ description: 'first', reportedAt: minutesAgo(s.env.clock.now, 90) }),
      queued({ description: 'second', hazardType: 'Landslide' }),
      queued({ description: 'third', hazardType: 'BlockedRoad' }),
    ];
    const res = await sync(s.citizen, batch);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Created',
      'Created',
      'Created',
    ]);
    expect(res.body.data.map((r: { clientId: string }) => r.clientId)).toEqual(
      batch.map((b) => b.clientId),
    );
    const ids = res.body.data.map((r: { report: { id: number } }) => r.report.id);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect(res.body.data[0].report.reportedAt).toBe(batch[0]?.reportedAt);
  });

  it('should be idempotent: replaying a batch returns Existing and adds no rows', async () => {
    const batch = [queued(), queued({ hazardType: 'Landslide' })];
    await sync(s.citizen, batch);
    const replay = await sync(s.citizen, batch);
    expect(replay.body.data.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Existing',
      'Existing',
    ]);
    expect(s.rowCount()).toBe(2);
  });

  it('should treat a repeated clientId inside one batch as Existing', async () => {
    const item = queued();
    const res = await sync(s.citizen, [item, item]);
    expect(res.body.data.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Created',
      'Existing',
    ]);
    expect(s.rowCount()).toBe(1);
  });

  it('should report an invalid item without failing the rest of the batch', async () => {
    const good = queued();
    const bad = queued({ latitude: 13.08 });
    const noId = { ...queued(), clientId: undefined };
    const res = await sync(s.citizen, [bad, good, noId, 'not an object']);
    expect(res.status).toBe(200);
    const [first, second, third, fourth] = res.body.data;
    expect(first).toMatchObject({ clientId: bad.clientId, outcome: 'Invalid' });
    expect(first.errors[0].field).toBe('latitude');
    expect(second.outcome).toBe('Created');
    expect(third).toMatchObject({ clientId: '', outcome: 'Invalid' });
    expect(fourth).toMatchObject({ clientId: '', outcome: 'Invalid' });
    expect(s.rowCount()).toBe(1);
  });

  it('should flag a future report time as Invalid', async () => {
    const future = new Date(s.env.clock.now.getTime() + 3_600_000).toISOString();
    const res = await sync(s.citizen, [queued({ reportedAt: future })]);
    expect(res.body.data[0]).toMatchObject({ outcome: 'Invalid' });
    expect(res.body.data[0].errors[0].field).toBe('reportedAt');
  });

  it('should flag a clientId owned by another user as Conflict', async () => {
    const item = queued();
    await sync(s.citizen, [item]);
    const res = await sync(s.otherCitizen, [item]);
    expect(res.body.data[0]).toMatchObject({ outcome: 'Conflict', clientId: item.clientId });
    expect(s.rowCount()).toBe(1);
  });

  it('should link duplicates inside the same batch', async () => {
    const res = await sync(s.citizen, [queued(), queued({ latitude: 7.2905 })]);
    const [first, second] = res.body.data;
    expect(second.report.duplicateOf).toBe(first.report.id);
  });

  it('should require Other to be described, per item', async () => {
    const res = await sync(s.citizen, [queued({ hazardType: 'Other', description: '' })]);
    expect(res.body.data[0].outcome).toBe('Invalid');
  });

  it.each([
    ['an empty list', []],
    [
      `more than ${SYNC_BATCH_MAX} reports`,
      Array.from({ length: SYNC_BATCH_MAX + 1 }, () => ({ clientId: randomUUID() })),
    ],
  ])('should reject %s with 400', async (_label, reports) => {
    const res = await sync(s.citizen, reports);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('reports');
  });

  it('should accept exactly the maximum batch size', async () => {
    const batch = Array.from({ length: SYNC_BATCH_MAX }, (_, i) =>
      queued({ latitude: 6 + i * 0.1 }),
    );
    const res = await sync(s.volunteer, batch);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(SYNC_BATCH_MAX);
  });

  it('should reject a body without a reports list (400)', async () => {
    expect((await s.post('/reports/sync', s.citizen, {})).status).toBe(400);
  });
});
