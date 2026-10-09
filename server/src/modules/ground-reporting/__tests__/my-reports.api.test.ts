import { beforeEach, describe, expect, it } from 'vitest';
import { ReportStatus } from '@dms/shared';
import { Scenario, jpegOfSize, minutesAgo } from './helpers';

let s: Scenario;
beforeEach(() => {
  s = new Scenario();
});

describe('GET /reports/mine (My Reports, #5)', () => {
  it('should list only my reports, newest first, with paging meta', async () => {
    const now = s.env.clock.now;
    const older = await s.submit(s.citizen, { reportedAt: minutesAgo(now, 300), latitude: 6.5 });
    const newer = await s.submit(s.citizen, { latitude: 8.5, longitude: 81 });
    await s.submit(s.otherCitizen);

    const res = await s.get('/reports/mine', s.citizen);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { id: number }) => r.id)).toEqual([newer.id, older.id]);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it('should show every server-side state with its text label', async () => {
    const statuses = [
      ReportStatus.Pending,
      ReportStatus.Verified,
      ReportStatus.Rejected,
      ReportStatus.NeedsInformation,
    ];
    for (const [i, status] of statuses.entries()) {
      const report = await s.submit(s.citizen, { latitude: 6 + i, longitude: 80 + i * 0.3 });
      s.setStatus(report.id, status);
    }
    const res = await s.get('/reports/mine', s.citizen);
    expect(res.body.data.map((r: { status: string }) => r.status).sort()).toEqual(
      [...statuses].sort(),
    );
  });

  it('should filter by status', async () => {
    const a = await s.submit(s.citizen);
    await s.submit(s.citizen, { latitude: 8.5, longitude: 81 });
    s.setStatus(a.id, ReportStatus.Verified);
    const res = await s.get('/reports/mine?status=Verified', s.citizen);
    expect(res.body.data.map((r: { id: number }) => r.id)).toEqual([a.id]);
    expect(res.body.meta.total).toBe(1);
  });

  it('should page the results', async () => {
    for (let i = 0; i < 3; i += 1)
      await s.submit(s.citizen, { latitude: 6 + i, longitude: 80 + i * 0.3 });
    const res = await s.get('/reports/mine?page=2&pageSize=2', s.citizen);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it('should return an empty list for a user with no reports', async () => {
    const res = await s.get('/reports/mine', s.volunteer);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it.each(['status=Done', 'page=0', 'pageSize=101', 'pageSize=abc'])(
    'should reject the query "%s" (400)',
    async (query) => {
      expect((await s.get(`/reports/mine?${query}`, s.citizen)).status).toBe(400);
    },
  );

  it('should show the decision message written by UC-DIST-02 (outcome, #3)', async () => {
    const report = await s.submit(s.citizen);
    expect((await s.get('/reports/mine', s.citizen)).body.data[0].outcome).toBeNull();

    s.notifyOutcome(report.id, s.citizen, 'Your report was verified. Thank you.');
    s.notifyOutcome(report.id, s.citizen, 'Please add a photo of the road.');
    const outcome = (await s.get('/reports/mine', s.citizen)).body.data[0].outcome;
    expect(outcome.message).toBe('Please add a photo of the road.');
  });

  it('should ignore notifications addressed to someone other than the reporter', async () => {
    const report = await s.submit(s.citizen);
    s.notifyOutcome(report.id, s.officer, 'Internal: new report in your queue.');
    expect((await s.get('/reports/mine', s.citizen)).body.data[0].outcome).toBeNull();
  });

  it('should flag duplicates and photos', async () => {
    const original = await s.submit(s.citizen);
    const duplicate = await s.submit(s.otherCitizen, { latitude: 7.2905 });
    await s.putPhoto(duplicate.id, s.otherCitizen, jpegOfSize(50));
    const res = await s.get('/reports/mine', s.otherCitizen);
    expect(res.body.data[0]).toMatchObject({ duplicateOf: original.id, hasPhoto: true });
  });
});

describe('GET /reports/:id', () => {
  it('should return the detail with coordinates and an empty history', async () => {
    const report = await s.submit(s.citizen);
    const res = await s.get(`/reports/${report.id}`, s.citizen);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: report.id,
      latitude: 7.29,
      longitude: 80.63,
      updates: [],
    });
  });

  it('should refuse someone else’s report with 403, even for a volunteer', async () => {
    const report = await s.submit(s.citizen);
    expect((await s.get(`/reports/${report.id}`, s.otherCitizen)).status).toBe(403);
    expect((await s.get(`/reports/${report.id}`, s.volunteer)).status).toBe(403);
  });

  it('should return 404 for an unknown id and 400 for a malformed one', async () => {
    expect((await s.get('/reports/9999', s.citizen)).status).toBe(404);
    expect((await s.get('/reports/abc', s.citizen)).status).toBe(400);
    expect((await s.get('/reports/0', s.citizen)).status).toBe(400);
  });
});
