import { beforeEach, describe, expect, it } from 'vitest';
import { Role, VerificationDecision } from '@dms/shared';
import { createTestEnv, type TestEnv } from '../../../core/testing/test-env';
import { MinimumEvidenceRule } from '../domain/evidence-rule';
import { CriteriaRepository } from '../repositories/criteria.repository';
import { HazardReportRepository } from '../repositories/hazard-report.repository';
import { VerificationRepository } from '../repositories/verification.repository';
import { WarningRepository } from '../repositories/warning.repository';
import { ReportVerificationService } from '../services/report-verification.service';
import { WarningAssembler } from '../services/warning.assembler';

let env: TestEnv;
let service: ReportVerificationService;

beforeEach(() => {
  env = createTestEnv();
  const reports = new HazardReportRepository(env.db);
  const verifications = new VerificationRepository(env.db);
  const warnings = new WarningRepository(env.db);
  const criteria = new CriteriaRepository(env.db);
  const assembler = new WarningAssembler(warnings, env.ctx.districts);
  service = new ReportVerificationService(
    reports,
    verifications,
    warnings,
    criteria,
    new MinimumEvidenceRule(),
    env.ctx.hydromet,
    env.ctx.notifications,
    assembler,
    () => new Date('2026-10-09T12:00:00.000Z'),
  );
});

describe('ReportVerificationService', () => {
  it('1a: should list pending reports and pending warning approvals in queue', () => {
    env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Test flood',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const queue = service.queue();
    expect(queue.reports.length).toBeGreaterThan(0);
    expect(queue.reports[0].description).toBe('Test flood');
  });

  it('2a: should return report review with nearby reports and decision support', () => {
    const r1 = env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Report 1',
      reportedAt: '2026-10-09T10:00:00.000Z',
      latitude: 6.9271,
      longitude: 79.8612,
    });
    env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Report 2 nearby',
      reportedAt: '2026-10-09T10:30:00.000Z',
      latitude: 6.928,
      longitude: 79.862,
    });

    const review = service.review(r1);
    expect(review.id).toBe(r1);
    expect(review.nearby.length).toBe(1);
    expect(review.evidence.sufficient).toBe(true);
  });

  it('5a: should record decision Verified when evidence is sufficient', () => {
    const officer = env.signIn(Role.DutyOfficer).user;
    const r = env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Report with photo and GPS',
      photoPath: '/photo.png',
      locationSource: 'Gps',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });

    const review = service.decide(officer, r, {
      decision: VerificationDecision.Verified,
      severity: 'High',
      notes: 'Verified via photo and GPS.',
    });

    expect(review.status).toBe('Verified');
    expect(review.severity).toBe('High');
  });

  it('5b: should throw error when verifying with insufficient evidence', () => {
    const officer = env.signIn(Role.DutyOfficer).user;
    const r = env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Manual report without photo',
      photoPath: null,
      locationSource: 'Manual',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });

    expect(() =>
      service.decide(officer, r, {
        decision: VerificationDecision.Verified,
        severity: 'High',
        notes: 'Trying to verify without evidence.',
      }),
    ).toThrow('GPS plus a photo, or a nearby corroborating report, is required to verify.');
  });

  it('5c: should record Rejected decision with notes', () => {
    const officer = env.signIn(Role.DutyOfficer).user;
    const r = env.insertReport({
      status: 'Pending',
      districtCode: 'CMB',
      description: 'Invalid report',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });

    const review = service.decide(officer, r, {
      decision: VerificationDecision.Rejected,
      notes: 'False alarm reported.',
    });

    expect(review.status).toBe('Rejected');
    expect(review.notes).toBe('False alarm reported.');
  });
});
