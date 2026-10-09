import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { Channel, Role, VerificationDecision, WarningLevel } from '@dms/shared';
import { bearer, createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';

let env: TestEnv;
let dutyOfficer: { token: string; user: { id: number } };
let secondApprover: { token: string; user: { id: number } };

beforeEach(() => {
  env = createTestEnv();
  dutyOfficer = env.signIn(Role.DutyOfficer);
  secondApprover = env.signIn(Role.SecondApprover);
});

describe('Report Verification Routes Access Control & Workflow', () => {
  it('should reject unauthenticated requests to verification queue with 401', async () => {
    const res = await request(env.app).get('/api/v1/verification/queue');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('should allow DutyOfficer and SecondApprover to view verification queue', async () => {
    const resOfficer = await request(env.app)
      .get('/api/v1/verification/queue')
      .set(bearer(dutyOfficer.token));
    expect(resOfficer.status).toBe(200);
    expect(resOfficer.body.data).toHaveProperty('reports');
    expect(resOfficer.body.data).toHaveProperty('pendingApprovals');

    const resApprover = await request(env.app)
      .get('/api/v1/verification/queue')
      .set(bearer(secondApprover.token));
    expect(resApprover.status).toBe(200);
  });

  it('should forbid Citizen from accessing verification queue', async () => {
    const citizen = env.signIn(Role.Citizen);
    const res = await request(env.app).get('/api/v1/verification/queue').set(bearer(citizen.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should allow DutyOfficer to fetch report review details', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Pending',
      description: 'Pending report review',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });

    const res = await request(env.app)
      .get(`/api/v1/verification/reports/${r}`)
      .set(bearer(dutyOfficer.token));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(r);
    expect(res.body.data.districtName).toBe('Colombo');
  });

  it('should allow DutyOfficer to record verification decision', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Pending',
      description: 'Report with photo and GPS',
      photoPath: '/uploads/img.png',
      locationSource: 'Gps',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });

    const res = await request(env.app)
      .post(`/api/v1/verification/reports/${r}/decision`)
      .set(bearer(dutyOfficer.token))
      .send({
        decision: VerificationDecision.Verified,
        severity: 'High',
        notes: 'Verified against photo and location.',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('Verified');
  });

  it('should forbid SecondApprover from posting verification decision', async () => {
    const r = env.insertReport({ districtCode: 'CMB', reportedAt: '2026-10-09T10:00:00.000Z' });
    const res = await request(env.app)
      .post(`/api/v1/verification/reports/${r}/decision`)
      .set(bearer(secondApprover.token))
      .send({
        decision: VerificationDecision.Verified,
        severity: 'High',
      });

    expect(res.status).toBe(403);
  });

  it('should calculate warning preview', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const res = await request(env.app)
      .post('/api/v1/warnings/preview')
      .set(bearer(dutyOfficer.token))
      .send({
        reportId: r,
        level: WarningLevel.Warning,
        areaIds: [cmbId],
        language: 'Sinhala',
        channels: [Channel.Push, Channel.SMS],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.requiresApproval).toBe(true);
    expect(res.body.data.estimatedAudience).toBeGreaterThan(0);
  });

  it('should create warning and set location header', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const res = await request(env.app)
      .post('/api/v1/warnings')
      .set(bearer(dutyOfficer.token))
      .send({
        reportId: r,
        level: WarningLevel.Advisory,
        areaIds: [cmbId],
        reason: 'Water level rising slowly in low areas.',
        language: 'English',
        channels: [Channel.Push],
        confirmedAudience: true,
      });

    expect(res.status).toBe(201);
    expect(res.headers.location).toMatch(/\/warnings\/\d+\/delivery$/);
    expect(res.body.data.status).toBe('Issued');
  });

  it('should allow SecondApprover to approve pending warning', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const createRes = await request(env.app)
      .post('/api/v1/warnings')
      .set(bearer(dutyOfficer.token))
      .send({
        reportId: r,
        level: WarningLevel.Warning,
        areaIds: [cmbId],
        reason: 'Severe inundation threat.',
        language: 'Sinhala',
        channels: [Channel.Push],
        confirmedAudience: true,
      });

    const warningId = createRes.body.data.id;

    const approvalRes = await request(env.app)
      .post(`/api/v1/warnings/${warningId}/approval`)
      .set(bearer(secondApprover.token))
      .send({
        decision: 'Approved',
        notes: 'Confirmed by second officer.',
      });

    expect(approvalRes.status).toBe(200);
    expect(approvalRes.body.data.status).toBe('Issued');
  });

  it('should retrieve delivery log for warning', async () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const createRes = await request(env.app)
      .post('/api/v1/warnings')
      .set(bearer(dutyOfficer.token))
      .send({
        reportId: r,
        level: WarningLevel.Advisory,
        areaIds: [cmbId],
        reason: 'Water level advisory.',
        language: 'English',
        channels: [Channel.Push],
        confirmedAudience: true,
      });

    const warningId = createRes.body.data.id;

    const deliveryRes = await request(env.app)
      .get(`/api/v1/warnings/${warningId}/delivery`)
      .set(bearer(dutyOfficer.token));

    expect(deliveryRes.status).toBe(200);
    expect(deliveryRes.body.data).toHaveProperty('warning');
    expect(deliveryRes.body.data).toHaveProperty('deliveries');
  });

  it('should list hazard team rules', async () => {
    const res = await request(env.app)
      .get('/api/v1/hazard-team-rules')
      .set(bearer(dutyOfficer.token));

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
