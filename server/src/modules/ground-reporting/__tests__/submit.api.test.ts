import { beforeEach, describe, expect, it } from 'vitest';
import { ReportStatus } from '@dms/shared';
import { Scenario, minutesAgo, validReport } from './helpers';

let s: Scenario;
beforeEach(() => {
  s = new Scenario();
});

describe('GET /reports/hazard-types', () => {
  it('should list the four hazard types and mark only Other as needing a description', async () => {
    const res = await s.get('/reports/hazard-types', s.citizen);
    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { value: string }) => t.value)).toEqual([
      'Flood',
      'Landslide',
      'BlockedRoad',
      'Other',
    ]);
    expect(
      res.body.data.filter((t: { descriptionRequired: boolean }) => t.descriptionRequired),
    ).toHaveLength(1);
  });
});

describe('POST /reports', () => {
  it('should store a Pending report with the resolved district and no severity (#1)', async () => {
    const res = await s.post('/reports', s.citizen, validReport());
    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/\/reports\/\d+$/);
    expect(res.body.data).toMatchObject({
      hazardType: 'Flood',
      status: 'Pending',
      syncStatus: 'Synced',
      districtName: 'Kandy',
      locationSource: 'Gps',
      hasPhoto: false,
      duplicateOf: null,
      outcome: null,
    });
    const row = s.env.db.prepare('SELECT severity, reporter_id FROM hazard_reports').get() as {
      severity: string | null;
      reporter_id: number;
    };
    expect(row.severity).toBeNull();
    expect(row.reporter_id).toBe(s.citizen.user.id);
  });

  it('should let a volunteer submit a report too', async () => {
    expect((await s.post('/reports', s.volunteer, validReport())).status).toBe(201);
  });

  it('should accept a report without a description for a known hazard type ', async () => {
    const res = await s.post('/reports', s.citizen, validReport({ description: undefined }));
    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('');
  });

  it('should require a description for "Other" ', async () => {
    const res = await s.post(
      '/reports',
      s.citizen,
      validReport({ hazardType: 'Other', description: '  ' }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'description', message: 'Describe the hazard when you choose "Other".' },
    ]);
  });

  it('should accept "Other" with a description', async () => {
    const res = await s.post(
      '/reports',
      s.citizen,
      validReport({ hazardType: 'Other', description: 'Fallen tree' }),
    );
    expect(res.status).toBe(201);
  });

  it('should accept a 200-character description and reject 201 (boundary)', async () => {
    expect(
      (await s.post('/reports', s.citizen, validReport({ description: 'a'.repeat(200) }))).status,
    ).toBe(201);
    const res = await s.post('/reports', s.citizen, validReport({ description: 'a'.repeat(201) }));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('description');
  });

  it('should trim the description before counting it', async () => {
    const res = await s.post(
      '/reports',
      s.citizen,
      validReport({ description: `  ${'a'.repeat(200)}  ` }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.description).toHaveLength(200);
  });

  it.each([
    ['unknown hazard type', { hazardType: 'Earthquake' }, 'hazardType'],
    ['missing hazard type', { hazardType: undefined }, 'hazardType'],
    ['latitude outside Sri Lanka ', { latitude: 13.08 }, 'latitude'],
    ['longitude outside Sri Lanka ', { longitude: 70 }, 'longitude'],
    ['latitude as text', { latitude: 'north' }, 'latitude'],
    ['unknown location source', { locationSource: 'Guess' }, 'locationSource'],
    ['malformed clientId', { clientId: 'not-a-uuid' }, 'clientId'],
    ['malformed reportedAt', { reportedAt: 'yesterday' }, 'reportedAt'],
  ])('should reject %s with a field error (400)', async (_label, override, field) => {
    const res = await s.post('/reports', s.citizen, validReport(override));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(s.rowCount()).toBe(0);
  });

  it('should accept a manual pin after GPS failure ', async () => {
    const res = await s.post('/reports', s.citizen, validReport({ locationSource: 'Manual' }));
    expect(res.status).toBe(201);
    expect(res.body.data.locationSource).toBe('Manual');
  });

  it('should reject a report time in the future (400) but allow a past one (offline)', async () => {
    const future = new Date(s.env.clock.now.getTime() + 10 * 60_000).toISOString();
    const rejected = await s.post('/reports', s.citizen, validReport({ reportedAt: future }));
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.details[0].field).toBe('reportedAt');

    const past = minutesAgo(s.env.clock.now, 180);
    const accepted = await s.post('/reports', s.citizen, validReport({ reportedAt: past }));
    expect(accepted.status).toBe(201);
    expect(accepted.body.data.reportedAt).toBe(past);
  });

  it('should return the stored report with 200 when the same clientId is sent again ', async () => {
    const clientId = '0b9f4a52-6f0e-4f5a-9e55-0d7d1f0a8c11';
    const first = await s.post('/reports', s.citizen, validReport({ clientId }));
    const again = await s.post('/reports', s.citizen, validReport({ clientId }));
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(s.rowCount()).toBe(1);
  });

  it('should refuse a clientId that belongs to another user (409)', async () => {
    const clientId = '0b9f4a52-6f0e-4f5a-9e55-0d7d1f0a8c12';
    await s.post('/reports', s.citizen, validReport({ clientId }));
    const res = await s.post('/reports', s.otherCitizen, validReport({ clientId }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('duplicate linking (critique #6)', () => {
  const nearby = { latitude: 7.2905, longitude: 80.63 };

  it('should link a nearby report of the same hazard within the window, and still queue it', async () => {
    const first = await s.submit(s.citizen);
    const second = await s.submit(s.otherCitizen, nearby);
    expect(second.duplicateOf).toBe(first.id);
    expect(second.status).toBe('Pending');
  });

  it('should not link a report that is far away or a different hazard', async () => {
    await s.submit(s.citizen);
    expect((await s.submit(s.otherCitizen, { latitude: 7.293 })).duplicateOf).toBeNull();
    expect((await s.submit(s.otherCitizen, { hazardType: 'Landslide' })).duplicateOf).toBeNull();
  });

  it('should link at exactly the time window and not a minute beyond (window edge)', async () => {
    const now = s.env.clock.now;
    const old = await s.submit(s.citizen, { reportedAt: minutesAgo(now, 60) });
    const atEdge = await s.submit(s.otherCitizen, nearby);
    expect(atEdge.duplicateOf).toBe(old.id);

    const fresh = new Scenario();
    await fresh.submit(fresh.citizen, { reportedAt: minutesAgo(fresh.env.clock.now, 61) });
    expect((await fresh.submit(fresh.otherCitizen, nearby)).duplicateOf).toBeNull();
  });

  it('should point later duplicates at the original, never at another duplicate', async () => {
    const original = await s.submit(s.citizen);
    await s.submit(s.otherCitizen, nearby);
    const third = await s.submit(s.volunteer, nearby);
    expect(third.duplicateOf).toBe(original.id);
  });

  it('should ignore a Rejected report when looking for the original', async () => {
    const rejected = await s.submit(s.citizen);
    s.setStatus(rejected.id, ReportStatus.Rejected);
    expect((await s.submit(s.otherCitizen, nearby)).duplicateOf).toBeNull();
  });

  it('should follow the radius stored in report_settings', async () => {
    await s.submit(s.citizen);
    s.env.db
      .prepare("UPDATE report_settings SET value = 10 WHERE key = 'duplicate_radius_m'")
      .run();
    expect((await s.submit(s.otherCitizen, nearby)).duplicateOf).toBeNull();
  });
});
