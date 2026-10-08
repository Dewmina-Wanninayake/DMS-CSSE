import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@dms/shared';
import { dayInZone } from '../../../core/time';
import { bearer, createTestEnv, type TestEnv } from '../../../core/testing/test-env';

/**
 * Regression: the server clock is UTC but the business day is Sri Lankan (UTC+05:30). At 01:14 on
 * 9 October in Colombo it is still 8 October in UTC, and "today" must be accepted as a period end.
 */
const EARLY_MORNING_COLOMBO = '2026-10-08T19:44:00.000Z';

let env: TestEnv;
let analyst: { token: string };

const trend = (periodEnd: string) =>
  request(env.app)
    .post('/api/v1/analytics/trend-reports')
    .set(bearer(analyst.token))
    .send({ hazardType: 'Flood', districtIds: 'all', periodStart: '2026-09-01', periodEnd });

beforeEach(() => {
  env = createTestEnv();
  env.clock.now = new Date(EARLY_MORNING_COLOMBO);
  analyst = env.signIn(Role.DisasterAnalyst);
});

describe('dayInZone', () => {
  it('should give the date in the requested zone, not in UTC', () => {
    const instant = new Date(EARLY_MORNING_COLOMBO);
    expect(dayInZone(instant, 'Asia/Colombo')).toBe('2026-10-09');
    expect(dayInZone(instant, 'UTC')).toBe('2026-10-08');
    expect(dayInZone(instant, 'America/Los_Angeles')).toBe('2026-10-08');
  });

  it('should roll over at local midnight', () => {
    expect(dayInZone(new Date('2026-12-31T18:29:59Z'), 'Asia/Colombo')).toBe('2026-12-31');
    expect(dayInZone(new Date('2026-12-31T18:30:00Z'), 'Asia/Colombo')).toBe('2027-01-01');
  });
});

describe('business day in Sri Lanka', () => {
  it('should accept today (Colombo date) as the end of a period even though UTC is a day behind', async () => {
    expect((await trend('2026-10-09')).status).toBe(201);
  });

  it('should still refuse tomorrow', async () => {
    const res = await trend('2026-10-10');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/future/);
  });

  it("should default a policy's effective date to the Colombo date", async () => {
    const director = env.signIn(Role.PolicyDirector);
    const report = await trend('2026-09-30');
    const draft = await request(env.app)
      .post('/api/v1/policies/drafts')
      .set(bearer(analyst.token))
      .send({
        trendReportId: report.body.data.id,
        title: 'Early morning act',
        description: 'd',
        mitigationStrategies: 'm',
      });
    const id = draft.body.data.id;
    await request(env.app).post(`/api/v1/policies/${id}/submit`).set(bearer(analyst.token));
    const approved = await request(env.app)
      .post(`/api/v1/policies/${id}/review`)
      .set(bearer(director.token))
      .send({ decision: 'Approved' });
    expect(approved.body.data.effectiveDate).toBe('2026-10-09');
  });

  it('should accept a proposed date of today (Colombo) at submission', async () => {
    const report = await trend('2026-09-30');
    const draft = await request(env.app)
      .post('/api/v1/policies/drafts')
      .set(bearer(analyst.token))
      .send({
        trendReportId: report.body.data.id,
        title: 'Same day act',
        description: 'd',
        mitigationStrategies: 'm',
        proposedEffectiveDate: '2026-10-09',
      });
    const submit = await request(env.app)
      .post(`/api/v1/policies/${draft.body.data.id}/submit`)
      .set(bearer(analyst.token));
    expect(submit.status).toBe(200);
  });
});
