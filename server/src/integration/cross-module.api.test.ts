import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@dms/shared';
import { bearer, createTestEnv, districtId, type TestEnv } from '../core/testing/test-env';
import { seedEmergencyResponse } from '../db/seeds/modules/emergency-response.seed';

/**
 * Phase 5 of the team plan: the four modules working together through the real app
 * (create → verify → analyse → publish → warning criteria visible; shelters visible read-only).
 */
let env: TestEnv;
type Actor = { token: string; user: { id: number } };

const call = (
  method: 'get' | 'post' | 'put' | 'patch',
  path: string,
  actor: Actor,
  body?: object,
) => request(env.app)[method](`/api/v1${path}`).set(bearer(actor.token)).send(body);

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

let citizen: Actor;
let officer: Actor;
let analyst: Actor;
let director: Actor;
let jointOps: Actor;

beforeEach(() => {
  env = createTestEnv();
  citizen = env.signIn(Role.Citizen, 'Nimal Citizen');
  officer = env.signIn(Role.DutyOfficer);
  analyst = env.signIn(Role.DisasterAnalyst);
  director = env.signIn(Role.PolicyDirector);
  jointOps = env.signIn(Role.JointOpsLead);
});

/** UC-CV-003 submit, with a photo so GPS + photo meets the minimum evidence rule. */
async function submitFlood() {
  const created = await call('post', '/reports', citizen, {
    hazardType: 'Flood',
    description: 'River is over the road',
    latitude: 7.25,
    longitude: 80.35,
    locationSource: 'Gps',
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id as number;
  const photo = await request(env.app)
    .put(`/api/v1/reports/${id}/photo`)
    .set(bearer(citizen.token))
    .set('Content-Type', 'image/jpeg')
    .send(JPEG);
  expect(photo.status).toBe(200);
  return id;
}

describe('UC-CV-003 → UC-DIST-02: a ground report reaches the officer and the reporter hears back', () => {
  it('should queue the report, verify it and show the outcome in My Reports', async () => {
    const id = await submitFlood();

    const queue = await call('get', '/verification/queue', officer);
    expect(queue.body.data.reports.map((r: { id: number }) => r.id)).toContain(id);

    const decision = await call('post', `/verification/reports/${id}/decision`, officer, {
      decision: 'Verified',
      severity: 'High',
      notes: 'Photo and GPS match the river gauge.',
    });
    expect(decision.status).toBe(200);

    const mine = await call('get', '/reports/mine', citizen);
    expect(mine.body.data[0]).toMatchObject({ id, status: 'Verified' });
    expect(mine.body.data[0].outcome.message).toMatch(/verified/i);
  });

  it('should return a report that needs information to Pending once the reporter updates it', async () => {
    const id = await submitFlood();
    await call('post', `/verification/reports/${id}/decision`, officer, {
      decision: 'RequiresInformation',
      notes: 'Please say which bridge you mean.',
    });

    const asked = await call('get', `/reports/${id}`, citizen);
    expect(asked.body.data).toMatchObject({ status: 'NeedsInformation' });
    expect(asked.body.data.outcome.message).toContain('Please say which bridge you mean.');

    const updated = await call('patch', `/reports/${id}`, citizen, {
      description: 'River is over the road at the Kaduwela bridge',
    });
    expect(updated.body.data.status).toBe('Pending');
    const queue = await call('get', '/verification/queue', officer);
    expect(queue.body.data.reports.map((r: { id: number }) => r.id)).toContain(id);
  });

  it('should tell the reporter when the officer rejects the report', async () => {
    const id = await submitFlood();
    await call('post', `/verification/reports/${id}/decision`, officer, {
      decision: 'Rejected',
      notes: 'This is an old photo of a different place.',
    });
    const mine = await call('get', '/reports/mine', citizen);
    expect(mine.body.data[0]).toMatchObject({ status: 'Rejected' });
    expect(mine.body.data[0].outcome.message).toContain('old photo');
  });
});

describe('UC-DIST-02 → UC-DA-001 → UC-DIST-02: verified data feeds analytics and the policy feeds the officer', () => {
  it('should count the verified report in the trend analysis and publish new warning criteria', async () => {
    const id = await submitFlood();
    await call('post', `/verification/reports/${id}/decision`, officer, {
      decision: 'Verified',
      severity: 'High',
      notes: 'Verified from the photo.',
    });

    const trend = await call('post', '/analytics/trend-reports', analyst, {
      hazardType: 'Flood',
      districtIds: [districtId(env.db, 'KEG')],
      periodStart: '2026-10-01',
      periodEnd: '2026-10-09',
    });
    expect(trend.status).toBe(201);
    const kegalle = trend.body.data.districts.find((d: { name: string }) => d.name === 'Kegalle');
    expect(kegalle.verifiedCount).toBe(1);

    const draft = await call('post', '/policies/drafts', analyst, {
      trendReportId: trend.body.data.id,
      title: 'Kelani basin flood policy',
      description: 'Lower the alert threshold.',
      mitigationStrategies: 'Pre-position boats.',
      landUseGuidelines: 'Keep a buffer.',
      resourceRules: 'Boats in Kegalle.',
      warningRiskThreshold: 2,
      proposedEffectiveDate: null,
    });
    await call('post', `/policies/${draft.body.data.id}/submit`, analyst);
    const approved = await call('post', `/policies/${draft.body.data.id}/review`, director, {
      decision: 'Approved',
    });
    expect(approved.status).toBe(200);

    const criteria = await call('get', '/policies/active/warning-criteria', officer);
    expect(
      criteria.body.data.find((c: { hazardType: string }) => c.hazardType === 'Flood'),
    ).toMatchObject({
      riskThreshold: 2,
    });

    // The officer's decision support reads the same criteria for the next report.
    const next = await submitFlood();
    const review = await call('get', `/verification/reports/${next}`, officer);
    expect(review.body.data.warningCriteria).toMatchObject({ riskThreshold: 2 });
  });
});

describe('UC-JOINT-001 beside the others', () => {
  it('should read shelters without being able to change them', async () => {
    seedEmergencyResponse(env.db);
    const shelters = await call('get', '/shelters', jointOps);
    expect(shelters.status).toBe(200);
    expect(shelters.body.data.length).toBeGreaterThan(0);

    const id = shelters.body.data[0].id;
    for (const method of ['put', 'patch', 'post'] as const) {
      expect((await call(method, `/shelters/${id}`, jointOps, { occupied: 0 })).status).toBe(404);
    }
  });

  it('should keep every module behind its own roles', async () => {
    expect((await call('get', '/response/dashboard', citizen)).status).toBe(403);
    expect((await call('get', '/verification/queue', jointOps)).status).toBe(403);
    expect((await call('get', '/reports/mine', officer)).status).toBe(403);
    expect((await call('get', '/analytics/filters', citizen)).status).toBe(403);
  });
});
