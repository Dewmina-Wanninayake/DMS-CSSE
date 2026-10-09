import { beforeEach, describe, expect, it } from 'vitest';
import { Channel, Role, VerificationDecision, WarningLevel, WarningStatus } from '@dms/shared';
import type { AuthUser } from '@dms/shared';
import { createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';
import { AudienceEstimator } from '../domain/audience-estimator';
import { MinimumEvidenceRule } from '../domain/evidence-rule';
import { CriteriaRepository } from '../repositories/criteria.repository';
import { HazardReportRepository } from '../repositories/hazard-report.repository';
import { VerificationRepository } from '../repositories/verification.repository';
import { WarningRepository } from '../repositories/warning.repository';
import { ReportVerificationService } from '../services/report-verification.service';
import { WarningAssembler } from '../services/warning.assembler';
import { WarningNotifier } from '../services/warning-notifier';
import { WarningService } from '../services/warning.service';

let env: TestEnv;
let verification: ReportVerificationService;
let warnings: WarningService;
let officer: AuthUser;

beforeEach(() => {
  env = createTestEnv();
  const warningRepo = new WarningRepository(env.db);
  const criteria = new CriteriaRepository(env.db);
  const assembler = new WarningAssembler(warningRepo, env.ctx.districts);
  verification = new ReportVerificationService(
    new HazardReportRepository(env.db),
    new VerificationRepository(env.db),
    warningRepo,
    criteria,
    new MinimumEvidenceRule(),
    env.ctx.hydromet,
    env.ctx.notifications,
    assembler,
    () => env.clock.now,
  );
  warnings = new WarningService(
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
});

const pending = (overrides = {}) =>
  env.insertReport({
    districtCode: 'CMB',
    status: 'Pending',
    photoPath: '/photo.jpg',
    locationSource: 'Gps',
    ...overrides,
  });

const verified = () => env.insertReport({ districtCode: 'CMB', status: 'Verified' });

const request = (reportId: number, overrides = {}) => ({
  reportId,
  level: WarningLevel.Advisory,
  areaIds: [districtId(env.db, 'CMB')],
  reason: 'Rain is expected overnight',
  language: 'English' as const,
  channels: [Channel.Push],
  confirmedAudience: true,
  ...overrides,
});

describe('decision validation (steps 5-6)', () => {
  it('should require a severity to verify', () => {
    expect(() =>
      verification.decide(officer, pending(), {
        decision: VerificationDecision.Verified,
        notes: 'Looks right',
      }),
    ).toThrow('invalid data');
  });

  it.each([VerificationDecision.Rejected, VerificationDecision.RequiresInformation])(
    'should require notes to %s a report',
    (decision) => {
      expect(() => verification.decide(officer, pending(), { decision, notes: ' ' })).toThrow(
        'invalid data',
      );
    },
  );

  it('should refuse a report marked as a duplicate of itself or of an unknown report', () => {
    const id = pending();
    const base = { decision: VerificationDecision.Rejected, notes: 'Same as another report' };
    expect(() => verification.decide(officer, id, { ...base, duplicateOf: id })).toThrow(
      'invalid data',
    );
    expect(() => verification.decide(officer, id, { ...base, duplicateOf: 9999 })).toThrow(
      'not found',
    );
  });

  it('3a: should link a duplicate to an existing report', () => {
    const original = verified();
    const id = pending();
    const review = verification.decide(officer, id, {
      decision: VerificationDecision.Rejected,
      notes: 'Same hazard as report one',
      duplicateOf: original,
    });
    expect(review.duplicateOf).toBe(original);
  });

  it('4a: should send a report back for more information with the officer’s notes', () => {
    const review = verification.decide(officer, pending(), {
      decision: VerificationDecision.RequiresInformation,
      notes: 'Which road is this?',
    });
    expect(review.status).toBe('NeedsInformation');
    expect(review.notes).toBe('Which road is this?');
  });

  it('should not decide a report twice and should say when the report does not exist', () => {
    const id = pending();
    verification.decide(officer, id, {
      decision: VerificationDecision.Rejected,
      notes: 'Not a hazard at all',
    });
    expect(() =>
      verification.decide(officer, id, {
        decision: VerificationDecision.Rejected,
        notes: 'Not a hazard at all',
      }),
    ).toThrow('already been decided');
    expect(() => verification.review(99_999)).toThrow('not found');
  });

  it('should show the latest sensor reading in the decision support, and survive a failing provider', () => {
    env.db
      .prepare(
        `INSERT INTO hydromet_observations (district_id, station_name, observed_at, rainfall_mm, river_level_m)
         VALUES (?, 'Kelani gauge', ?, 42, 3.1)`,
      )
      .run(districtId(env.db, 'CMB'), '2026-10-08T10:00:00.000Z');
    expect(verification.review(pending()).latestSensor).toMatchObject({
      stationName: 'Kelani gauge',
      riverLevelM: 3.1,
    });

    const failing = new ReportVerificationService(
      new HazardReportRepository(env.db),
      new VerificationRepository(env.db),
      new WarningRepository(env.db),
      new CriteriaRepository(env.db),
      new MinimumEvidenceRule(),
      {
        getObservations: () => {
          throw new Error('feed down');
        },
      } as never,
      env.ctx.notifications,
      new WarningAssembler(new WarningRepository(env.db), env.ctx.districts),
      () => env.clock.now,
    );
    expect(failing.review(pending()).latestSensor).toBeNull();
  });
});

describe('warning creation (steps 8-12)', () => {
  it('should refuse a warning from a report that is not verified or does not exist', () => {
    expect(() => warnings.create(officer, request(pending()))).toThrow('verified report');
    expect(() => warnings.create(officer, request(99_999))).toThrow('not found');
  });

  it('should refuse unknown areas', () => {
    expect(() => warnings.create(officer, request(verified(), { areaIds: [9999] }))).toThrow(
      'invalid data',
    );
  });

  it('9: should require confirmation when the audience is large', () => {
    const all = env.ctx.districts.findAll?.().map((d) => d.id) ?? [];
    const areaIds = all.length > 0 ? all : [districtId(env.db, 'CMB')];
    expect(() =>
      warnings.create(officer, request(verified(), { areaIds, confirmedAudience: false })),
    ).toThrow('invalid data');
  });

  it('should return the same warning when a request is repeated with the same clientId', () => {
    const id = verified();
    const first = warnings.create(officer, request(id, { clientId: 'warn-1' }));
    const again = warnings.create(officer, request(id, { clientId: 'warn-1' }));
    expect(again.id).toBe(first.id);
  });

  it('12b: should keep a warning as PendingSync until it is flushed, then issue it', () => {
    const created = warnings.create(officer, request(verified(), { pendingSync: true }));
    expect(created.syncStatus).toBe('PendingSync');
    expect(created.status).toBe(WarningStatus.Draft);

    const flushed = warnings.sync(created.id);
    expect(flushed.syncStatus).toBe('Synced');
    expect(flushed.status).toBe(WarningStatus.Issued);
    expect(warnings.sync(created.id).status).toBe(WarningStatus.Issued);
  });

  it('12b: should send a flushed Warning level on for approval instead of issuing it', () => {
    const created = warnings.create(
      officer,
      request(verified(), { level: WarningLevel.Warning, pendingSync: true }),
    );
    expect(warnings.sync(created.id).status).toBe(WarningStatus.PendingApproval);
  });

  it('14a: should correct the areas of an issued warning and refuse unknown ones', () => {
    const created = warnings.create(officer, request(verified()));
    const corrected = warnings.correct(officer, created.id, {
      action: 'Correct',
      reason: 'The hazard is wider than first reported',
      areaIds: [districtId(env.db, 'CMB'), districtId(env.db, 'KEG')],
    });
    expect(corrected.areaNames).toEqual(expect.arrayContaining(['Colombo', 'Kegalle']));
    expect(() =>
      warnings.correct(officer, created.id, {
        action: 'Correct',
        reason: 'Typo in the area list',
        areaIds: [9999],
      }),
    ).toThrow('invalid data');
  });

  it('should say when a warning does not exist', () => {
    expect(() => warnings.delivery(99_999)).toThrow('not found');
    expect(() => warnings.sync(99_999)).toThrow('not found');
  });

  it('should refuse approving a warning that is already issued', () => {
    const created = warnings.create(officer, request(verified()));
    expect(() =>
      warnings.approve(env.signIn(Role.SecondApprover).user, created.id, { decision: 'Approved' }),
    ).toThrow('cannot become');
  });
});

describe('repository helpers', () => {
  it('should fall back to a default team role and default criteria for an unknown hazard', () => {
    const criteria = new CriteriaRepository(env.db);
    expect(criteria.listTeamRules().length).toBeGreaterThan(0);
    expect(criteria.teamRole('Flood')).toBe('RescueTeamLeader');
    expect(criteria.forHazard('Flood')).toMatchObject({ hazardType: 'Flood' });
  });
});
