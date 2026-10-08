import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { HazardType, Role } from '@dms/shared';
import { bearer, createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';

type Actor = { token: string; user: { id: number; email: string } };

let env: TestEnv;
let analyst: Actor;
let director: Actor;
let trendReportId: number;

const api = (path = '') => `/api/v1${path}`;
const post = (path: string, actor: Actor, body: object = {}) =>
  request(env.app).post(api(path)).set(bearer(actor.token)).send(body);
const get = (path: string, actor: Actor) =>
  request(env.app).get(api(path)).set(bearer(actor.token));

const completeDraft = (overrides: object = {}) => ({
  trendReportId,
  title: 'National Flood Mitigation Act',
  description: 'Reduce flood losses in the Kelani basin.',
  mitigationStrategies: 'Deploy early alerts and relocate shelters.',
  landUseGuidelines: 'Keep a buffer along the river.',
  resourceRules: 'Pre-position boats in Kegalle.',
  warningRiskThreshold: null,
  proposedEffectiveDate: null,
  ...overrides,
});

const createDraft = async (overrides: object = {}, actor = analyst) =>
  (await post('/policies/drafts', actor, completeDraft(overrides))).body.data;

/** Drives a draft to PendingApproval. */
const submitted = async (overrides: object = {}) => {
  const draft = await createDraft(overrides);
  const res = await post(`/policies/${draft.id}/submit`, analyst);
  expect(res.status).toBe(200);
  return res.body.data;
};

beforeEach(async () => {
  env = createTestEnv();
  analyst = env.signIn(Role.DisasterAnalyst, 'Dulaj Serasinghe');
  director = env.signIn(Role.PolicyDirector, 'Nimali Perera');
  for (let i = 0; i < 6; i += 1)
    env.insertReport({ districtCode: 'KEG', reportedAt: '2026-09-10T00:00:00.000Z' });
  const trend = await post('/analytics/trend-reports', analyst, {
    hazardType: HazardType.Flood,
    districtIds: [districtId(env.db, 'KEG'), districtId(env.db, 'RAT')],
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
  });
  trendReportId = trend.body.data.id;
});

describe('POST /policies/drafts (step 6)', () => {
  it('should create version 1 as a Draft, pre-filled from the trend report', async () => {
    const res = await post('/policies/drafts', analyst, completeDraft());
    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/\/policies\/\d+$/);
    expect(res.body.data).toMatchObject({
      policyKey: 'P-2026-001',
      version: 1,
      status: 'Draft',
      hazardType: 'Flood',
      trendReportId,
      regionLabel: 'Kegalle, Ratnapura',
      authorName: 'Dulaj Serasinghe',
      review: null,
      simulationReference: null,
    });
  });

  it('should number new policies sequentially within the year', async () => {
    await createDraft();
    const second = await createDraft();
    expect(second.policyKey).toBe('P-2026-002');
  });

  it('should save a partly written draft (only submission needs completeness)', async () => {
    const res = await post('/policies/drafts', analyst, {
      trendReportId,
      title: 'Early draft idea',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('');
  });

  it('should label a many-district region by its provinces and all districts as "All districts"', async () => {
    const western = await post('/analytics/trend-reports', analyst, {
      hazardType: 'Flood',
      districtIds: ['CMB', 'GPH', 'KLT', 'KEG', 'RAT'].map((c) => districtId(env.db, c)),
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    const all = await post('/analytics/trend-reports', analyst, {
      hazardType: 'Flood',
      districtIds: 'all',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    const a = await createDraft({ trendReportId: western.body.data.id });
    const b = await createDraft({ trendReportId: all.body.data.id });
    expect(a.regionLabel).toBe('Western & Sabaragamuwa Provinces');
    expect(b.regionLabel).toBe('All districts');
  });

  it('should return 404 when the trend report does not exist', async () => {
    const res = await post('/policies/drafts', analyst, completeDraft({ trendReportId: 999 }));
    expect(res.status).toBe(404);
  });

  it.each([
    ['a too short title', { title: 'abc' }],
    ['a title over 120 characters', { title: 'x'.repeat(121) }],
    ['a description over 2000 characters', { description: 'x'.repeat(2001) }],
    ['a measures section over 5000 characters', { resourceRules: 'x'.repeat(5001) }],
    ['a non-positive warning threshold', { warningRiskThreshold: 0 }],
    ['a client id that is not a UUID', { clientId: 'abc' }],
  ])('should return 400 for %s', async (_label, patch) => {
    const res = await post('/policies/drafts', analyst, completeDraft(patch));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should forbid the Director from drafting', async () => {
    const res = await post('/policies/drafts', director, completeDraft());
    expect(res.status).toBe(403);
  });

  it('should accept a boundary-length title (120) and a 2000-char description', async () => {
    const res = await post(
      '/policies/drafts',
      analyst,
      completeDraft({ title: 'x'.repeat(120), description: 'y'.repeat(2000) }),
    );
    expect(res.status).toBe(201);
  });

  describe('idempotency by clientId (extension 9a)', () => {
    it('should return the existing draft instead of creating a duplicate', async () => {
      const clientId = randomUUID();
      const first = await post('/policies/drafts', analyst, completeDraft({ clientId }));
      const again = await post('/policies/drafts', analyst, completeDraft({ clientId }));
      expect(first.status).toBe(201);
      expect(again.status).toBe(200);
      expect(again.body.data.id).toBe(first.body.data.id);
    });

    it('should refuse a client id that belongs to another analyst', async () => {
      const clientId = randomUUID();
      await post('/policies/drafts', analyst, completeDraft({ clientId }));
      const other = env.signIn(Role.DisasterAnalyst);
      const res = await post('/policies/drafts', other, completeDraft({ clientId }));
      expect(res.status).toBe(409);
    });
  });
});

describe('draft visibility', () => {
  it('should hide a draft from the Director (404, not 403)', async () => {
    const draft = await createDraft();
    expect((await get(`/policies/${draft.id}`, director)).status).toBe(404);
    expect((await get('/policies', director)).body.data).toEqual([]);
  });

  it('should hide a draft from another analyst but show it to its author', async () => {
    const draft = await createDraft();
    const other = env.signIn(Role.DisasterAnalyst);
    expect((await get(`/policies/${draft.id}`, other)).status).toBe(404);
    expect((await get(`/policies/${draft.id}`, analyst)).status).toBe(200);
  });

  it('should return 404 for an unknown policy', async () => {
    expect((await get('/policies/999', analyst)).status).toBe(404);
  });
});

describe('GET /policies (list)', () => {
  it('should page and filter by status and ownership', async () => {
    await createDraft();
    const pending = await submitted();
    const list = await get('/policies?status=PendingApproval', analyst);
    expect(list.body.data.map((p: { id: number }) => p.id)).toEqual([pending.id]);
    expect(list.body.meta).toEqual({ page: 1, pageSize: 20, total: 1 });

    const mine = await get('/policies?mine=true&pageSize=1&page=2', analyst);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2 });
  });

  it('should show the Director submitted policies', async () => {
    const pending = await submitted();
    const res = await get('/policies', director);
    expect(res.body.data.map((p: { id: number }) => p.id)).toEqual([pending.id]);
  });

  it('should reject an invalid status filter and an oversized page', async () => {
    expect((await get('/policies?status=Nope', analyst)).status).toBe(400);
    expect((await get('/policies?pageSize=1000', analyst)).status).toBe(400);
  });
});

describe('PATCH /policies/:id (edit a draft)', () => {
  it('should update the content of own draft', async () => {
    const draft = await createDraft();
    const res = await request(env.app)
      .patch(api(`/policies/${draft.id}`))
      .set(bearer(analyst.token))
      .send(completeDraft({ title: 'Updated title', trendReportId: undefined }));
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated title');
  });

  it("should forbid editing another analyst's draft (it is invisible) and a submitted policy", async () => {
    const draft = await createDraft();
    const other = env.signIn(Role.DisasterAnalyst);
    const hidden = await request(env.app)
      .patch(api(`/policies/${draft.id}`))
      .set(bearer(other.token))
      .send({ title: 'Hijacked' });
    expect(hidden.status).toBe(404);

    const pending = await submitted();
    const res = await request(env.app)
      .patch(api(`/policies/${pending.id}`))
      .set(bearer(analyst.token))
      .send({ title: 'Edited after submit' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should forbid a different analyst from editing a submitted policy they can see', async () => {
    const pending = await submitted();
    const other = env.signIn(Role.DisasterAnalyst);
    const res = await request(env.app)
      .patch(api(`/policies/${pending.id}`))
      .set(bearer(other.token))
      .send({ title: 'Not mine at all' });
    expect(res.status).toBe(403);
  });
});

describe('POST /policies/:id/submit (steps 8–9, 8a)', () => {
  it('should move the draft to PendingApproval and notify the Policy Director', async () => {
    const draft = await createDraft();
    const res = await post(`/policies/${draft.id}/submit`, analyst);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'PendingApproval', version: 1 });
    expect(res.body.data.submittedAt).not.toBeNull();
    expect(
      env.gateway.delivered.some(
        (m) => m.startsWith(director.user.email) && m.includes('awaiting approval'),
      ),
    ).toBe(true);
  });

  it('should list the Director notification as Sent', async () => {
    const policy = await submitted();
    const res = await get(`/policies/${policy.id}/notifications`, analyst);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        recipientName: 'Nimali Perera',
        recipientRole: 'PolicyDirector',
        deliveryStatus: 'Sent',
        retryCount: 0,
      }),
    ]);
  });

  it('should reject an incomplete policy with field errors', async () => {
    const draft = await createDraft({
      description: '',
      mitigationStrategies: '',
      landUseGuidelines: '',
      resourceRules: '',
    });
    const res = await post(`/policies/${draft.id}/submit`, analyst);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
      'description',
      'mitigationStrategies',
    ]);
  });

  it('8a: should block a policy that conflicts with a national standard and name the clause', async () => {
    const draft = await createDraft({
      landUseGuidelines: 'Residents may be rehoused. Allow construction in flood plain areas.',
    });
    const res = await post(`/policies/${draft.id}/submit`, analyst);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REGULATORY_CONFLICT');
    expect(res.body.error.details).toEqual([
      expect.objectContaining({
        ruleCode: 'REG-RIVER-RESERVE',
        field: 'landUseGuidelines',
        clause: 'Allow construction in flood plain areas.',
      }),
    ]);
    expect((await get(`/policies/${draft.id}`, analyst)).body.data.status).toBe('Draft');
  });

  it('8a: should let the analyst fix the clause and then submit', async () => {
    const draft = await createDraft({
      resourceRules: 'We will waive mandatory evacuation when roads are closed.',
    });
    const flagged = await get(`/policies/${draft.id}/conflicts`, analyst);
    expect(flagged.body.data).toHaveLength(1);

    await request(env.app)
      .patch(api(`/policies/${draft.id}`))
      .set(bearer(analyst.token))
      .send(completeDraft({ trendReportId: undefined }));
    expect((await get(`/policies/${draft.id}/conflicts`, analyst)).body.data).toEqual([]);
    expect((await post(`/policies/${draft.id}/submit`, analyst)).status).toBe(200);
  });

  it('should refuse to submit twice (409) and refuse another analyst (403/404)', async () => {
    const pending = await submitted();
    const again = await post(`/policies/${pending.id}/submit`, analyst);
    expect(again.status).toBe(409);
    const other = env.signIn(Role.DisasterAnalyst);
    expect((await post(`/policies/${pending.id}/submit`, other)).status).toBe(403);
  });

  it('should still submit when notification delivery fails and record the failure (12a)', async () => {
    env.gateway.failing = true;
    const policy = await submitted();
    expect(policy.status).toBe('PendingApproval');
    const notes = await get(`/policies/${policy.id}/notifications`, analyst);
    expect(notes.body.data[0]).toMatchObject({ deliveryStatus: 'Failed', retryCount: 1 });
  });
});

describe('POST /policies/:id/review (steps 10–13, 10a)', () => {
  const stakeholders = () => ({
    officer: env.signIn(Role.DutyOfficer, 'Kasun Fernando'),
    regional: env.signIn(Role.RegionalAdmin, 'Sampath Kumara'),
    field: env.signIn(Role.RescueTeamLeader, 'Chamara Bandara'),
  });

  it('should only let the Policy Director review', async () => {
    const pending = await submitted();
    expect(
      (await post(`/policies/${pending.id}/review`, analyst, { decision: 'Approved' })).status,
    ).toBe(403);
    const officer = env.signIn(Role.DutyOfficer);
    expect(
      (await post(`/policies/${pending.id}/review`, officer, { decision: 'Approved' })).status,
    ).toBe(403);
  });

  it('should approve, set the effective date, store the review and publish to stakeholders', async () => {
    const people = stakeholders();
    const pending = await submitted();

    const res = await post(`/policies/${pending.id}/review`, director, {
      decision: 'Approved',
      comments: 'Looks good.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'Approved',
      effectiveDate: '2026-10-09',
      review: { decision: 'Approved', comments: 'Looks good.', reviewerName: 'Nimali Perera' },
    });
    const delivered = env.gateway.delivered.join('\n');
    for (const person of Object.values(people)) expect(delivered).toContain(person.user.email);
    const notes = (await get(`/policies/${pending.id}/notifications`, director)).body.data;
    expect(
      notes.filter((n: { subject: string }) => n.subject.startsWith('New policy published')),
    ).toHaveLength(3);
  });

  it("should default the effective date to the analyst's proposed date, or today once that has passed", async () => {
    const proposed = await submitted({ proposedEffectiveDate: '2026-12-01' });
    const res = await post(`/policies/${proposed.id}/review`, director, { decision: 'Approved' });
    expect(res.body.data).toMatchObject({
      proposedEffectiveDate: '2026-12-01',
      effectiveDate: '2026-12-01',
    });

    const stale = await submitted({ proposedEffectiveDate: '2026-10-20' });
    env.clock.now = new Date('2026-10-25T10:00:00.000Z'); // the proposed date passed while it waited
    const late = await post(`/policies/${stale.id}/review`, director, { decision: 'Approved' });
    expect(late.body.data.effectiveDate).toBe('2026-10-25');
  });

  it('should refuse to submit a policy whose proposed date is already in the past', async () => {
    const draft = await createDraft({ proposedEffectiveDate: '2026-10-20' });
    env.clock.now = new Date('2026-10-25T10:00:00.000Z');
    const res = await post(`/policies/${draft.id}/submit`, analyst);
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('proposedEffectiveDate');
  });

  it('should accept a future effective date and refuse a past one', async () => {
    const pending = await submitted();
    const past = await post(`/policies/${pending.id}/review`, director, {
      decision: 'Approved',
      effectiveDate: '2026-10-08',
    });
    expect(past.status).toBe(400);
    const future = await post(`/policies/${pending.id}/review`, director, {
      decision: 'Approved',
      effectiveDate: '2026-11-01',
    });
    expect(future.body.data.effectiveDate).toBe('2026-11-01');
  });

  it('should apply the policy warning threshold to the settings read by UC-DIST-02 (DA #8)', async () => {
    const before = await get('/policies/active/warning-criteria', env.signIn(Role.DutyOfficer));
    expect(
      before.body.data.find((c: { hazardType: string }) => c.hazardType === 'Flood'),
    ).toMatchObject({ riskThreshold: 5, sourcePolicyKey: null });

    const pending = await submitted({ warningRiskThreshold: 8 });
    await post(`/policies/${pending.id}/review`, director, { decision: 'Approved' });

    const after = await get('/policies/active/warning-criteria', env.signIn(Role.SecondApprover));
    expect(
      after.body.data.find((c: { hazardType: string }) => c.hazardType === 'Flood'),
    ).toMatchObject({
      riskThreshold: 8,
      mediumRatio: 0.5,
      sourcePolicyKey: pending.policyKey,
    });
  });

  it('should not change settings when the policy carries no threshold or when it is rejected', async () => {
    const noThreshold = await submitted();
    await post(`/policies/${noThreshold.id}/review`, director, { decision: 'Approved' });
    const rejected = await submitted({ warningRiskThreshold: 99 });
    await post(`/policies/${rejected.id}/review`, director, {
      decision: 'Rejected',
      comments: 'Threshold too lax',
    });
    const settings = await get('/policies/settings', director);
    expect(
      settings.body.data.find((s: { hazardType: string }) => s.hazardType === 'Flood')
        .riskThreshold,
    ).toBe(5);
  });

  it('10a: should reject with comments, notify the analyst, then allow a revision as a new version', async () => {
    const pending = await submitted();
    const res = await post(`/policies/${pending.id}/review`, director, {
      decision: 'Rejected',
      comments: 'Needs a funding plan.',
    });
    expect(res.body.data).toMatchObject({
      status: 'Rejected',
      effectiveDate: null,
      review: { decision: 'Rejected', comments: 'Needs a funding plan.' },
    });
    expect(
      env.gateway.delivered.some(
        (m) => m.startsWith(analyst.user.email) && m.includes('Policy rejected'),
      ),
    ).toBe(true);

    const revised = await post(`/policies/${pending.id}/revise`, analyst);
    expect(revised.status).toBe(201);
    expect(revised.body.data).toMatchObject({
      policyKey: pending.policyKey,
      version: 2,
      status: 'Draft',
      title: pending.title,
      review: null,
    });
    expect(revised.headers.location).toContain(`/policies/${revised.body.data.id}`);

    const twice = await post(`/policies/${pending.id}/revise`, analyst);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('CONFLICT');
  });

  it('should require meaningful comments for a rejection', async () => {
    const pending = await submitted();
    for (const comments of [undefined, '', 'no']) {
      const res = await post(`/policies/${pending.id}/review`, director, {
        decision: 'Rejected',
        comments,
      });
      expect(res.status).toBe(400);
    }
    expect((await get(`/policies/${pending.id}`, director)).body.data.status).toBe(
      'PendingApproval',
    );
  });

  it('should refuse to review a policy that is not pending, and to review twice', async () => {
    const draft = await createDraft();
    expect(
      (await post(`/policies/${draft.id}/review`, director, { decision: 'Approved' })).status,
    ).toBe(404);

    const pending = await submitted();
    await post(`/policies/${pending.id}/review`, director, { decision: 'Approved' });
    const again = await post(`/policies/${pending.id}/review`, director, {
      decision: 'Rejected',
      comments: 'Changed my mind',
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should keep the decision when stakeholder delivery fails and retry it later (12a)', async () => {
    stakeholders();
    const pending = await submitted();
    env.gateway.failing = true;
    const res = await post(`/policies/${pending.id}/review`, director, { decision: 'Approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Approved');

    const failed = (await get(`/policies/${pending.id}/notifications`, director)).body.data.filter(
      (n: { deliveryStatus: string }) => n.deliveryStatus === 'Failed',
    );
    expect(failed).toHaveLength(3);
    expect(failed.every((n: { retryCount: number }) => n.retryCount === 1)).toBe(true);

    env.gateway.failing = false;
    expect(await env.ctx.notifications.retryFailed()).toBe(3);
    const after = (await get(`/policies/${pending.id}/notifications`, director)).body.data;
    expect(
      after.filter((n: { deliveryStatus: string }) => n.deliveryStatus === 'Sent'),
    ).toHaveLength(4);
  });

  it('should supersede the earlier approved version when a revised version is approved (A6)', async () => {
    const v1 = await submitted();
    await post(`/policies/${v1.id}/review`, director, { decision: 'Approved' });
    const v2 = (await post(`/policies/${v1.id}/revise`, analyst)).body.data;
    expect(v2.version).toBe(2);
    await post(`/policies/${v2.id}/submit`, analyst);
    await post(`/policies/${v2.id}/review`, director, { decision: 'Approved' });

    const old = (await get(`/policies/${v1.id}`, analyst)).body.data;
    expect(old).toMatchObject({ status: 'Approved', supersededBy: v2.id });
  });

  it('should refuse to revise a draft or pending policy and revising by someone else', async () => {
    const draft = await createDraft();
    expect((await post(`/policies/${draft.id}/revise`, analyst)).status).toBe(409);
    const pending = await submitted();
    await post(`/policies/${pending.id}/review`, director, {
      decision: 'Rejected',
      comments: 'Not yet ready',
    });
    const other = env.signIn(Role.DisasterAnalyst);
    expect((await post(`/policies/${pending.id}/revise`, other)).status).toBe(403);
  });
});

describe('simulation (step 7, optional)', () => {
  const input = { intensity: 6, teamsDeployed: 8, sheltersActivated: 15 };

  it('should run the model for the districts of the trend report and store the result', async () => {
    const draft = await createDraft();
    const res = await post(`/policies/${draft.id}/simulations`, analyst, input);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      reference: 'S-2026-0001',
      status: 'Success',
      hazardType: 'Flood',
      input,
    });
    // Ratnapura is in the trend report but has no verified reports, so it is not modelled.
    expect(res.body.data.districts.map((d: { name: string }) => d.name)).toEqual(['Kegalle']);
    const kegalle = res.body.data.districts[0];
    expect(kegalle.riskLevel).toBe('High'); // 6 verified reports > threshold 5
    expect(kegalle.exposedPopulation).toBe(Math.round(840648 * 0.6 * 1 * 0.2));
    expect(res.body.data.totals.exposedPopulation).toBe(kegalle.exposedPopulation);

    const detail = await get(`/policies/${draft.id}`, analyst);
    expect(detail.body.data.simulationReference).toBe('S-2026-0001');
    const list = await get(`/policies/${draft.id}/simulations`, analyst);
    expect(list.body.data).toHaveLength(1);
  });

  it('should keep every run, newest first, with unique references', async () => {
    const draft = await createDraft();
    await post(`/policies/${draft.id}/simulations`, analyst, input);
    const second = await post(`/policies/${draft.id}/simulations`, analyst, {
      ...input,
      intensity: 9,
    });
    expect(second.body.data.reference).toBe('S-2026-0002');
    const list = await get(`/policies/${draft.id}/simulations`, analyst);
    expect(list.body.data.map((s: { reference: string }) => s.reference)).toEqual([
      'S-2026-0002',
      'S-2026-0001',
    ]);
  });

  it('should model a Low-risk district only when it has at least one verified report', async () => {
    env.insertReport({ districtCode: 'RAT', reportedAt: '2026-09-12T00:00:00.000Z' });
    const trend = await post('/analytics/trend-reports', analyst, {
      hazardType: 'Flood',
      districtIds: [
        districtId(env.db, 'KEG'),
        districtId(env.db, 'RAT'),
        districtId(env.db, 'GAL'),
      ],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    const draft = await createDraft({ trendReportId: trend.body.data.id });
    const res = await post(`/policies/${draft.id}/simulations`, analyst, input);
    expect(
      res.body.data.districts.map((d: { name: string; riskLevel: string }) => [
        d.name,
        d.riskLevel,
      ]),
    ).toEqual([
      ['Kegalle', 'High'],
      ['Ratnapura', 'Low'],
    ]);
  });

  it('should refuse to simulate when no district has verified reports (422)', async () => {
    const empty = await post('/analytics/trend-reports', analyst, {
      hazardType: 'Landslide',
      districtIds: 'all',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    const draft = await createDraft({ trendReportId: empty.body.data.id });
    const res = await post(`/policies/${draft.id}/simulations`, analyst, input);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_AT_RISK_DISTRICTS');
  });

  it('should refuse hazards without a simulation profile (422)', async () => {
    const road = await post('/analytics/trend-reports', analyst, {
      hazardType: 'BlockedRoad',
      districtIds: 'all',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    const draft = await createDraft({ trendReportId: road.body.data.id });
    const res = await post(`/policies/${draft.id}/simulations`, analyst, input);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_HAZARD');
  });

  it('should refuse a simulation once the policy is no longer a draft, or by someone else', async () => {
    const pending = await submitted();
    expect((await post(`/policies/${pending.id}/simulations`, analyst, input)).status).toBe(409);
    const other = env.signIn(Role.DisasterAnalyst);
    expect((await post(`/policies/${pending.id}/simulations`, other, input)).status).toBe(403);
  });

  it.each([
    ['intensity above 10', { intensity: 11 }],
    ['intensity below 1', { intensity: 0 }],
    ['a fractional intensity', { intensity: 2.5 }],
    ['zero teams', { teamsDeployed: 0 }],
    ['negative shelters', { sheltersActivated: -1 }],
    ['a missing field', { teamsDeployed: undefined }],
  ])('should return 400 for %s', async (_label, patch) => {
    const draft = await createDraft();
    const res = await post(`/policies/${draft.id}/simulations`, analyst, { ...input, ...patch });
    expect(res.status).toBe(400);
  });

  it('should accept the boundary values 1 and 10 and zero shelters', async () => {
    const draft = await createDraft();
    expect(
      (
        await post(`/policies/${draft.id}/simulations`, analyst, {
          intensity: 1,
          teamsDeployed: 1,
          sheltersActivated: 0,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post(`/policies/${draft.id}/simulations`, analyst, {
          intensity: 10,
          teamsDeployed: 1000,
          sheltersActivated: 1000,
        })
      ).status,
    ).toBe(201);
  });
});

describe('POST /policies/sync (extension 9a, offline drafts)', () => {
  it('should create offline drafts once and report Existing on replay', async () => {
    const drafts = [randomUUID(), randomUUID()].map((clientId) =>
      completeDraft({ clientId, title: `Offline ${clientId.slice(0, 6)}` }),
    );
    const first = await post('/policies/sync', analyst, { drafts });
    expect(first.status).toBe(200);
    expect(first.body.data.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Created',
      'Created',
    ]);

    const replay = await post('/policies/sync', analyst, { drafts });
    expect(replay.body.data.map((r: { outcome: string }) => r.outcome)).toEqual([
      'Existing',
      'Existing',
    ]);
    expect(replay.body.data.map((r: { policyId: number }) => r.policyId)).toEqual(
      first.body.data.map((r: { policyId: number }) => r.policyId),
    );
    expect((await get('/policies?mine=true', analyst)).body.meta.total).toBe(2);
  });

  it('should report a Conflict for a draft whose trend report is gone without failing the batch', async () => {
    const good = completeDraft({ clientId: randomUUID() });
    const bad = completeDraft({ clientId: randomUUID(), trendReportId: 999 });
    const res = await post('/policies/sync', analyst, { drafts: [bad, good] });
    expect(res.body.data[0]).toMatchObject({
      outcome: 'Conflict',
      policyId: null,
      message: expect.stringContaining('Trend report'),
    });
    expect(res.body.data[1].outcome).toBe('Created');
  });

  it('should require a client id on every draft, and a non-empty batch', async () => {
    expect((await post('/policies/sync', analyst, { drafts: [completeDraft()] })).status).toBe(400);
    expect((await post('/policies/sync', analyst, { drafts: [] })).status).toBe(400);
  });
});

describe('policy settings and warning criteria', () => {
  it('should let the Director change a threshold, which the next trend report uses', async () => {
    const res = await request(env.app)
      .put(api('/policies/settings/Flood'))
      .set(bearer(director.token))
      .send({ riskThreshold: 10, mediumRatio: 0.4, minDataPoints: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      hazardType: 'Flood',
      riskThreshold: 10,
      mediumRatio: 0.4,
      minDataPoints: 2,
    });

    const trend = await post('/analytics/trend-reports', analyst, {
      hazardType: 'Flood',
      districtIds: [districtId(env.db, 'KEG')],
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    });
    expect(trend.body.data.districts[0].riskLevel).toBe('Medium'); // 6 ≤ 10 but ≥ 4
  });

  it.each([
    ['a zero threshold', { riskThreshold: 0, mediumRatio: 0.5, minDataPoints: 3 }],
    ['a medium ratio of 1', { riskThreshold: 5, mediumRatio: 1, minDataPoints: 3 }],
    ['a fractional minimum', { riskThreshold: 5, mediumRatio: 0.5, minDataPoints: 1.5 }],
  ])('should return 400 for %s', async (_label, body) => {
    const res = await request(env.app)
      .put(api('/policies/settings/Flood'))
      .set(bearer(director.token))
      .send(body);
    expect(res.status).toBe(400);
  });

  it('should forbid the Analyst from changing thresholds and return 400 for an unknown hazard', async () => {
    const body = { riskThreshold: 10, mediumRatio: 0.4, minDataPoints: 2 };
    expect(
      (
        await request(env.app)
          .put(api('/policies/settings/Flood'))
          .set(bearer(analyst.token))
          .send(body)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(env.app)
          .put(api('/policies/settings/Tsunami'))
          .set(bearer(director.token))
          .send(body)
      ).status,
    ).toBe(400);
  });

  it('should expose warning criteria to officers but not to citizens', async () => {
    const officer = env.signIn(Role.DutyOfficer);
    expect((await get('/policies/active/warning-criteria', officer)).body.data).toHaveLength(4);
    expect((await get('/policies/active/warning-criteria', env.signIn(Role.Citizen))).status).toBe(
      403,
    );
  });
});
