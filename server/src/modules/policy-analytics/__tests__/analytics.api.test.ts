import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { HazardType, ReportStatus, Role } from '@dms/shared';
import { bearer, createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';
import type { HydrometProvider } from '../../../core/hydromet/hydromet-provider';

const PERIOD = { periodStart: '2026-09-01', periodEnd: '2026-09-30' };
const IN_PERIOD = '2026-09-15T08:00:00.000Z';

let env: TestEnv;
let analyst: { token: string; user: { id: number } };

const create = (body: object, token = analyst.token) =>
  request(env.app).post('/api/v1/analytics/trend-reports').set(bearer(token)).send(body);

const floodRequest = (districtIds: number[] | 'all' = 'all') => ({
  hazardType: HazardType.Flood,
  districtIds,
  ...PERIOD,
});

const addReports = (
  code: string,
  count: number,
  extra: Partial<Parameters<TestEnv['insertReport']>[0]> = {},
) => {
  for (let i = 0; i < count; i += 1) {
    env.insertReport({ districtCode: code, reportedAt: IN_PERIOD, ...extra });
  }
};

beforeEach(() => {
  env = createTestEnv();
  analyst = env.signIn(Role.DisasterAnalyst);
});

describe('access control', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const res = await request(env.app).get('/api/v1/analytics/filters');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it.each([Role.Citizen, Role.Volunteer, Role.DutyOfficer, Role.JointOpsLead])(
    'should forbid %s from analytics (policies are internal to the analyst and director)',
    async (role) => {
      const { token } = env.signIn(role);
      const res = await request(env.app).get('/api/v1/analytics/filters').set(bearer(token));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('should let the Policy Director read analytics but not create a trend report', async () => {
    const director = env.signIn(Role.PolicyDirector);
    const read = await request(env.app)
      .get('/api/v1/analytics/filters')
      .set(bearer(director.token));
    expect(read.status).toBe(200);
    const write = await create(floodRequest(), director.token);
    expect(write.status).toBe(403);
  });

  it('should reject a malformed bearer token with 401', async () => {
    const res = await request(env.app)
      .get('/api/v1/analytics/filters')
      .set({ Authorization: 'Bearer not-a-token' });
    expect(res.status).toBe(401);
  });
});

describe('GET /analytics/filters (step 2 form options)', () => {
  it('should list the 25 districts, hazard types and thresholds in force', async () => {
    const res = await request(env.app).get('/api/v1/analytics/filters').set(bearer(analyst.token));
    expect(res.status).toBe(200);
    expect(res.body.data.districts).toHaveLength(25);
    expect(res.body.data.districts[0]).not.toHaveProperty('population');
    expect(res.body.data.hazardTypes).toEqual(['Flood', 'Landslide', 'BlockedRoad', 'Other']);
    expect(res.body.data.thresholds).toHaveLength(4);
  });
});

describe('POST /analytics/trend-reports (steps 2–4)', () => {
  it('should classify each district against the stored threshold and save the report', async () => {
    addReports('KEG', 6); // above threshold 5  → High
    addReports('RAT', 3); // ≥ 2.5              → Medium
    addReports('GPH', 1); // below              → Low

    const res = await create(floodRequest());

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/trend-reports\/\d+$/);
    const report = res.body.data;
    const byName = Object.fromEntries(report.districts.map((d: { name: string }) => [d.name, d]));
    expect(byName.Kegalle).toMatchObject({ verifiedCount: 6, riskLevel: 'High' });
    expect(byName.Ratnapura).toMatchObject({ verifiedCount: 3, riskLevel: 'Medium' });
    expect(byName.Gampaha).toMatchObject({ verifiedCount: 1, riskLevel: 'Low' });
    expect(report.summary).toMatchObject({ totalVerified: 10, highRiskCount: 1 });
    expect(report.thresholds).toEqual({ riskThreshold: 5, mediumRatio: 0.5, minDataPoints: 3 });
    expect(report.sparse).toBe(false);
    expect(report.districts).toHaveLength(25);

    const saved = await request(env.app)
      .get(`/api/v1/analytics/trend-reports/${report.id}`)
      .set(bearer(analyst.token));
    expect(saved.status).toBe(200);
    expect(saved.body.data.summary.totalVerified).toBe(10);
  });

  it('should treat a count equal to the threshold as not High', async () => {
    addReports('KEG', 5);
    const res = await create(floodRequest([districtId(env.db, 'KEG')]));
    expect(res.body.data.districts[0].riskLevel).toBe('Medium');
    expect(res.body.data.summary.highRiskCount).toBe(0);
  });

  it('should count only Verified, non-duplicate reports of the chosen hazard inside the period', async () => {
    const original = env.insertReport({ districtCode: 'KEG', reportedAt: IN_PERIOD });
    env.insertReport({ districtCode: 'KEG', reportedAt: IN_PERIOD, duplicateOf: original });
    env.insertReport({ districtCode: 'KEG', reportedAt: IN_PERIOD, status: ReportStatus.Pending });
    env.insertReport({ districtCode: 'KEG', reportedAt: IN_PERIOD, status: ReportStatus.Rejected });
    env.insertReport({
      districtCode: 'KEG',
      reportedAt: IN_PERIOD,
      status: ReportStatus.NeedsInformation,
    });
    env.insertReport({
      districtCode: 'KEG',
      reportedAt: IN_PERIOD,
      hazardType: HazardType.Landslide,
    });
    env.insertReport({ districtCode: 'KEG', reportedAt: '2026-08-31T23:59:59.000Z' });
    env.insertReport({ districtCode: 'KEG', reportedAt: '2026-10-01T00:00:00.000Z' });
    env.insertReport({ districtCode: 'KEG', reportedAt: '2026-09-30T23:59:59.000Z' }); // last second counts

    const res = await create(floodRequest([districtId(env.db, 'KEG')]));

    expect(res.body.data.districts[0].verifiedCount).toBe(2);
  });

  it('3a: should return a limited report with the sparsity flag when data is insufficient', async () => {
    addReports('KEG', 2); // total 2 < minDataPoints 3
    const res = await create(floodRequest());
    expect(res.status).toBe(201);
    expect(res.body.data.sparse).toBe(true);
    expect(res.body.data.summary.totalVerified).toBe(2);
  });

  it('3a: should still produce a report when there is no data at all', async () => {
    const res = await create(floodRequest());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      sparse: true,
      summary: { totalVerified: 0, highRiskCount: 0 },
    });
  });

  it('should include archival records in the data points and the monthly chart series', async () => {
    addReports('KEG', 1);
    env.db
      .prepare(
        'INSERT INTO historical_incidents (district_id, hazard_type, occurred_at, summary) VALUES (?, ?, ?, ?)',
      )
      .run(districtId(env.db, 'KEG'), 'Flood', '2026-09-03T00:00:00.000Z', 'archived');
    env.db
      .prepare(
        'INSERT INTO historical_incidents (district_id, hazard_type, occurred_at, summary) VALUES (?, ?, ?, ?)',
      )
      .run(districtId(env.db, 'KEG'), 'Flood', '2026-09-04T00:00:00.000Z', 'archived');

    const res = await create(floodRequest());

    expect(res.body.data.sparse).toBe(false); // 1 verified + 2 historical = 3 data points
    expect(res.body.data.monthly).toEqual([{ month: '2026-09', verified: 1, historical: 2 }]);
    expect(res.body.data.summary).toMatchObject({ totalHistorical: 2 });
  });

  it('should compare with the previous period to give the trend direction', async () => {
    addReports('KEG', 4); // September: 4
    addReports('KEG', 2, { reportedAt: '2026-08-10T00:00:00.000Z' }); // previous 30 days: 2

    const res = await create({
      hazardType: 'Flood',
      districtIds: 'all',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });

    expect(res.body.data.summary).toMatchObject({ trendDirection: 'Rising', percentChange: 100 });
  });

  it('should aggregate hydromet observations per district', async () => {
    addReports('KEG', 3);
    const keg = districtId(env.db, 'KEG');
    const insert = env.db.prepare(
      'INSERT INTO hydromet_observations (district_id, station_name, observed_at, rainfall_mm, river_level_m) VALUES (?, ?, ?, ?, ?)',
    );
    insert.run(keg, 'Kegalle gauge', '2026-09-05T00:00:00.000Z', 40.5, 2.1);
    insert.run(keg, 'Kegalle gauge', '2026-09-20T00:00:00.000Z', 20.2, 3.4);
    insert.run(keg, 'Kegalle gauge', '2026-07-01T00:00:00.000Z', 99, 9); // outside period

    const res = await create(floodRequest([keg]));

    expect(res.body.data.hydrometAvailable).toBe(true);
    expect(res.body.data.districts[0]).toMatchObject({ rainfallMm: 60.7, maxRiverLevelM: 3.4 });
  });

  it('should leave hydromet values null for a district without observations', async () => {
    addReports('KEG', 3);
    const res = await create(floodRequest([districtId(env.db, 'KEG')]));
    expect(res.body.data.districts[0]).toMatchObject({ rainfallMm: null, maxRiverLevelM: null });
  });

  it('should still produce the report when the hydromet source is unavailable', async () => {
    const failing: HydrometProvider = {
      getObservations: () => {
        throw new Error('met department feed down');
      },
    };
    env = createTestEnv({ hydromet: failing });
    analyst = env.signIn(Role.DisasterAnalyst);
    addReports('KEG', 4);

    const res = await create(floodRequest());

    expect(res.status).toBe(201);
    expect(res.body.data.hydrometAvailable).toBe(false);
    expect(res.body.data.summary.totalVerified).toBe(4);
  });

  it('should use the threshold of the chosen hazard type', async () => {
    addReports('NWE', 4, { hazardType: HazardType.Landslide });
    env.db
      .prepare("UPDATE policy_settings SET risk_threshold = 3 WHERE hazard_type = 'Landslide'")
      .run();

    const res = await create({ ...floodRequest(), hazardType: 'Landslide' });

    expect(res.body.data.thresholds.riskThreshold).toBe(3);
    expect(res.body.data.summary.highRiskCount).toBe(1);
  });

  describe('validation', () => {
    it.each([
      ['an end date in the future', { periodEnd: '2026-10-10' }, 'future'],
      [
        'a start after the end',
        { periodStart: '2026-09-30', periodEnd: '2026-09-01' },
        'start date',
      ],
      ['a period over five years', { periodStart: '2020-01-01' }, '5 years'],
    ])('should return 400 for %s', async (_label, patch, message) => {
      const res = await create({ ...floodRequest(), periodEnd: '2026-09-30', ...patch });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain(message);
    });

    it.each([
      ['an unknown hazard type', { hazardType: 'Earthquake' }],
      ['an empty district list', { districtIds: [] }],
      ['a non-date', { periodStart: '2026-02-30' }],
      ['a missing period', { periodStart: undefined }],
    ])('should return 400 with field details for %s', async (_label, patch) => {
      const res = await create({ ...floodRequest(), ...patch });
      expect(res.status).toBe(400);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('should return 400 when a selected district does not exist', async () => {
      const res = await create(floodRequest([9999]));
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toContain('9999');
    });

    it('should accept the same district twice without double counting', async () => {
      addReports('KEG', 3);
      const keg = districtId(env.db, 'KEG');
      const res = await create(floodRequest([keg, keg]));
      expect(res.status).toBe(201);
      expect(res.body.data.districts).toHaveLength(1);
    });
  });
});

describe('trend report retrieval', () => {
  it('should return 404 for an unknown report', async () => {
    const res = await request(env.app)
      .get('/api/v1/analytics/trend-reports/999')
      .set(bearer(analyst.token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 400 for a non-numeric id', async () => {
    const res = await request(env.app)
      .get('/api/v1/analytics/trend-reports/abc')
      .set(bearer(analyst.token));
    expect(res.status).toBe(400);
  });

  it('should list recent reports newest first', async () => {
    await create(floodRequest());
    const second = await create(floodRequest());
    const res = await request(env.app)
      .get('/api/v1/analytics/trend-reports')
      .set(bearer(analyst.token));
    expect(res.body.data.map((r: { id: number }) => r.id)[0]).toBe(second.body.data.id);
    expect(res.body.data).toHaveLength(2);
  });
});

describe('GET /analytics/verified-reports/latest (dashboard list)', () => {
  it('should return the newest verified, non-duplicate reports with their district', async () => {
    env.insertReport({
      districtCode: 'KEG',
      reportedAt: '2026-09-01T00:00:00.000Z',
      description: 'oldest',
    });
    env.insertReport({
      districtCode: 'RAT',
      reportedAt: '2026-09-20T00:00:00.000Z',
      description: 'newest',
    });
    env.insertReport({
      districtCode: 'GPH',
      reportedAt: '2026-09-25T00:00:00.000Z',
      status: ReportStatus.Pending,
    });

    const res = await request(env.app)
      .get('/api/v1/analytics/verified-reports/latest?limit=2')
      .set(bearer(analyst.token));

    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { description: string }) => r.description)).toEqual([
      'newest',
      'oldest',
    ]);
    expect(res.body.data[0]).toMatchObject({ districtName: 'Ratnapura', hazardType: 'Flood' });
  });

  it('should return an empty list when nothing is verified', async () => {
    const res = await request(env.app)
      .get('/api/v1/analytics/verified-reports/latest')
      .set(bearer(analyst.token));
    expect(res.body.data).toEqual([]);
  });

  it('should reject a limit above the maximum', async () => {
    const res = await request(env.app)
      .get('/api/v1/analytics/verified-reports/latest?limit=500')
      .set(bearer(analyst.token));
    expect(res.status).toBe(400);
  });
});
