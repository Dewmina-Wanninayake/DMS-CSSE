import { beforeEach, describe, expect, it } from 'vitest';
import { Channel, WarningLevel, WarningStatus } from '@dms/shared';
import { createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';
import { AudienceEstimator } from '../domain/audience-estimator';
import { CriteriaRepository } from '../repositories/criteria.repository';
import { HazardReportRepository } from '../repositories/hazard-report.repository';
import { WarningRepository } from '../repositories/warning.repository';
import { WarningAssembler } from '../services/warning.assembler';
import { WarningService } from '../services/warning.service';

let env: TestEnv;
let service: WarningService;

beforeEach(() => {
  env = createTestEnv();
  const reports = new HazardReportRepository(env.db);
  const warnings = new WarningRepository(env.db);
  const criteria = new CriteriaRepository(env.db);
  const assembler = new WarningAssembler(warnings, env.districts);
  service = new WarningService(
    reports,
    warnings,
    criteria,
    env.districts,
    env.notifications,
    assembler,
    new AudienceEstimator(),
    () => new Date('2026-10-09T12:00:00.000Z'),
  );
});

describe('WarningService', () => {
  it('6a: should preview estimated audience for target districts', () => {
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const preview = service.preview({
      reportId: r.id,
      level: WarningLevel.Warning,
      areaIds: [cmbId],
      language: 'English',
      channels: [Channel.Push, Channel.SMS],
    });

    expect(preview.estimatedAudience).toBeGreaterThan(1000);
    expect(preview.requiresApproval).toBe(true);
    expect(preview.requiresAudienceConfirm).toBe(true);
  });

  it('8a: should create warning in PendingApproval state for Warning level', () => {
    const officer = { id: 1, email: 'officer@dmc.gov.lk', role: 'DutyOfficer' as const };
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const warning = service.create(officer, {
      reportId: r.id,
      level: WarningLevel.Warning,
      areaIds: [cmbId],
      reason: 'Critical water level threshold reached',
      language: 'Sinhala',
      channels: [Channel.Push, Channel.SMS],
      confirmedAudience: true,
    });

    expect(warning.status).toBe(WarningStatus.PendingApproval);
    expect(warning.level).toBe(WarningLevel.Warning);
    expect(warning.areaNames).toContain('Colombo');
  });

  it('8b: should approve pending warning and change status to Issued', () => {
    const officer = { id: 1, email: 'officer@dmc.gov.lk', role: 'DutyOfficer' as const };
    const approver = { id: 2, email: 'approver@dmc.gov.lk', role: 'SecondApprover' as const };
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const created = service.create(officer, {
      reportId: r.id,
      level: WarningLevel.Warning,
      areaIds: [cmbId],
      reason: 'Critical water level threshold reached',
      language: 'Sinhala',
      channels: [Channel.Push],
      confirmedAudience: true,
    });

    const approved = service.approve(approver, created.id, {
      decision: 'Approved',
      notes: 'Second approval granted.',
    });

    expect(approved.status).toBe(WarningStatus.Issued);
    expect(approved.issuedAt).toBe('2026-10-09T12:00:00.000Z');
  });

  it('10a: should correct active warning details', () => {
    const officer = { id: 1, email: 'officer@dmc.gov.lk', role: 'DutyOfficer' as const };
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const created = service.create(officer, {
      reportId: r.id,
      level: WarningLevel.Advisory,
      areaIds: [cmbId],
      reason: 'Initial advisory',
      language: 'English',
      channels: [Channel.Push],
      confirmedAudience: true,
    });

    const corrected = service.correct(created.id, {
      action: 'Correct',
      level: WarningLevel.Watch,
      reason: 'Upgraded to watch due to continued rainfall',
    });

    expect(corrected.status).toBe(WarningStatus.Corrected);
    expect(corrected.level).toBe(WarningLevel.Watch);
  });

  it('10b: should withdraw active warning', () => {
    const officer = { id: 1, email: 'officer@dmc.gov.lk', role: 'DutyOfficer' as const };
    const r = env.insertReport({
      districtCode: 'CMB',
      status: 'Verified',
      severity: 'High',
      reportedAt: '2026-10-09T10:00:00.000Z',
    });
    const cmbId = districtId(env.db, 'CMB');

    const created = service.create(officer, {
      reportId: r.id,
      level: WarningLevel.Advisory,
      areaIds: [cmbId],
      reason: 'Initial advisory',
      language: 'English',
      channels: [Channel.Push],
      confirmedAudience: true,
    });

    const withdrawn = service.correct(created.id, {
      action: 'Withdraw',
    });

    expect(withdrawn.status).toBe(WarningStatus.Withdrawn);
  });
});
