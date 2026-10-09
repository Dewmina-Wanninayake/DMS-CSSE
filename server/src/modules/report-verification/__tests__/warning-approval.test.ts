import { beforeEach, describe, expect, it } from 'vitest';
import { APPROVAL_RESPONSE_MINUTES, Channel, Role, WarningLevel, WarningStatus } from '@dms/shared';
import type { AuthUser } from '@dms/shared';
import { ForbiddenError } from '../../../core/http/errors';
import { createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';
import { AudienceEstimator } from '../domain/audience-estimator';
import { CriteriaRepository } from '../repositories/criteria.repository';
import { HazardReportRepository } from '../repositories/hazard-report.repository';
import { WarningRepository } from '../repositories/warning.repository';
import { WarningAssembler } from '../services/warning.assembler';
import { WarningNotifier } from '../services/warning-notifier';
import { WarningService } from '../services/warning.service';

let env: TestEnv;
let service: WarningService;
let officer: AuthUser;
let approvers: AuthUser[];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function raise(level: WarningLevel) {
  const reportId = env.insertReport({ districtCode: 'CMB', status: 'Verified', severity: 'High' });
  return service.create(officer, {
    reportId,
    level,
    areaIds: [districtId(env.db, 'CMB')],
    reason: 'Water level above the danger mark',
    language: 'English',
    channels: [Channel.Push],
    confirmedAudience: true,
  });
}

const notificationsTo = (user: AuthUser) =>
  env.db
    .prepare('SELECT subject FROM notifications WHERE recipient_user_id = ? ORDER BY id')
    .all(user.id)
    .map((row) => (row as { subject: string }).subject);

beforeEach(() => {
  env = createTestEnv();
  const warningRepo = new WarningRepository(env.db);
  const criteria = new CriteriaRepository(env.db);
  const assembler = new WarningAssembler(warningRepo, env.ctx.districts);
  service = new WarningService(
    new HazardReportRepository(env.db),
    warningRepo,
    criteria,
    env.ctx.districts,
    new WarningNotifier(warningRepo, criteria, assembler, env.ctx.notifications, env.ctx.users),
    assembler,
    new AudienceEstimator(),
    () => env.clock.now,
  );
  officer = env.signIn(Role.DutyOfficer).user;
  approvers = [env.signIn(Role.SecondApprover).user, env.signIn(Role.SecondApprover).user];
});

describe('10a: the Second Approver rejects', () => {
  it('should issue nothing and tell the officer why', async () => {
    const warning = raise(WarningLevel.Emergency);
    const result = service.approve(approvers[0], warning.id, {
      decision: 'Rejected',
      notes: 'Water level is falling',
    });
    await flush();

    expect(result.status).toBe(WarningStatus.Withdrawn);
    expect(result.issuedAt).toBeNull();
    const toOfficer = env.db
      .prepare('SELECT subject, body FROM notifications WHERE recipient_user_id = ?')
      .get(officer.id) as { subject: string; body: string };
    expect(toOfficer.subject).toBe('Warning not approved');
    expect(toOfficer.body).toContain('Water level is falling');
  });
});

describe('10b: no approver responds in time', () => {
  it('should alert the first approver when the warning is raised', async () => {
    raise(WarningLevel.Warning);
    await flush();
    expect(notificationsTo(approvers[0])).toEqual(['Warning awaiting your approval']);
    expect(notificationsTo(approvers[1])).toEqual([]);
  });

  it('should not alert anyone for a level that needs no approval', async () => {
    raise(WarningLevel.Advisory);
    await flush();
    expect(notificationsTo(approvers[0])).toEqual([]);
  });

  it('should pass an overdue warning to the next approver on the roster, then wrap round', async () => {
    const warning = raise(WarningLevel.Warning);
    await flush();

    env.clock.now = new Date(env.clock.now.getTime() + (APPROVAL_RESPONSE_MINUTES - 1) * 60_000);
    expect(await service.escalateOverdueApprovals()).toBe(0);

    env.clock.now = new Date(env.clock.now.getTime() + 2 * 60_000);
    expect(await service.escalateOverdueApprovals()).toBe(1);
    expect(notificationsTo(approvers[1])).toEqual(['Warning still awaiting approval']);

    // Not overdue again until another full response window has passed since the last hand-over.
    expect(await service.escalateOverdueApprovals()).toBe(0);
    env.clock.now = new Date(env.clock.now.getTime() + APPROVAL_RESPONSE_MINUTES * 60_000);
    expect(await service.escalateOverdueApprovals()).toBe(1);
    expect(notificationsTo(approvers[0])).toEqual([
      'Warning awaiting your approval',
      'Warning still awaiting approval',
    ]);
    expect(warning.status).toBe(WarningStatus.PendingApproval);
  });

  it('should stop once the warning is decided', async () => {
    const warning = raise(WarningLevel.Warning);
    service.approve(approvers[0], warning.id, { decision: 'Approved' });
    env.clock.now = new Date(env.clock.now.getTime() + 60 * 60_000);
    expect(await service.escalateOverdueApprovals()).toBe(0);
  });

  it('should report no one alerted when there is no approver at all', async () => {
    env.db.prepare("DELETE FROM users WHERE role = 'SecondApprover'").run();
    raise(WarningLevel.Warning);
    env.clock.now = new Date(env.clock.now.getTime() + 60 * 60_000);
    expect(await service.escalateOverdueApprovals()).toBe(0);
  });
});

describe('14a: correcting a warning issued in error follows the approval rule', () => {
  it('should let the officer correct a lower-level warning', () => {
    const warning = raise(WarningLevel.Advisory);
    const corrected = service.correct(officer, warning.id, {
      action: 'Correct',
      level: WarningLevel.AllClear,
      reason: 'The river has fallen below the alert level',
    });
    expect(corrected.level).toBe(WarningLevel.AllClear);
  });

  it('should refuse the officer a withdrawal of a Warning or Emergency', () => {
    const warning = raise(WarningLevel.Warning);
    service.approve(approvers[0], warning.id, { decision: 'Approved' });
    expect(() => service.correct(officer, warning.id, { action: 'Withdraw' })).toThrow(
      ForbiddenError,
    );
    expect(service.correct(approvers[0], warning.id, { action: 'Withdraw' }).status).toBe(
      WarningStatus.Withdrawn,
    );
  });

  it('should refuse the officer a correction that raises a warning to Emergency', () => {
    const warning = raise(WarningLevel.Advisory);
    expect(() =>
      service.correct(officer, warning.id, {
        action: 'Correct',
        level: WarningLevel.Emergency,
        reason: 'The dam has been breached',
      }),
    ).toThrow('Second Approver must confirm');
  });

  it('should let a Second Approver lower a Warning to AllClear', () => {
    const warning = raise(WarningLevel.Warning);
    service.approve(approvers[0], warning.id, { decision: 'Approved' });
    const corrected = service.correct(approvers[1], warning.id, {
      action: 'Correct',
      level: WarningLevel.AllClear,
      reason: 'The hazard has passed',
    });
    expect(corrected.level).toBe(WarningLevel.AllClear);
  });
});
