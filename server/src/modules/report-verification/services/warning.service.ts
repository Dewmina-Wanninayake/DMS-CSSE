import {
  APPROVAL_RESPONSE_MINUTES,
  ReportStatus,
  Role,
  SyncStatus,
  WarningStatus,
  type ApprovalRequest,
  type AuthUser,
  type CorrectionRequest,
  type CreateWarningRequest,
  type WarningDelivery,
  type WarningDto,
  type WarningLevel,
  type WarningPreview,
  type WarningPreviewRequest,
} from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from '../../../core/http/errors';
import { AudienceEstimator } from '../domain/audience-estimator';
import {
  assertTransition,
  initialStatus,
  requiresSecondApproval,
} from '../domain/warning-state-machine';
import type { CriteriaRepository } from '../repositories/criteria.repository';
import type { HazardReportRepository } from '../repositories/hazard-report.repository';
import type { WarningRepository } from '../repositories/warning.repository';
import type { WarningAssembler } from './warning.assembler';
import type { WarningNotifier } from './warning-notifier';

/**
 * Steps 8-14: preview, create, approve, correct and track delivery of a warning. Decides what is
 * allowed (levels, approval, transitions); who is told, and how, is `WarningNotifier`.
 */
export class WarningService {
  constructor(
    private readonly reports: HazardReportRepository,
    private readonly warnings: WarningRepository,
    private readonly criteria: CriteriaRepository,
    private readonly districts: DistrictRepository,
    private readonly notifier: WarningNotifier,
    private readonly assembler: WarningAssembler,
    private readonly audience: AudienceEstimator,
    private readonly clock: () => Date,
  ) {}

  preview(input: WarningPreviewRequest): WarningPreview {
    const report = this.requireVerified(input.reportId);
    const areas = this.requireAreas(input.areaIds);
    const estimate = this.audience.estimate(areas);
    return {
      ...estimate,
      requiresApproval: requiresSecondApproval(input.level),
      warningCriteria: this.criteria.forHazard(report.hazardType),
      language: input.language,
      channels: input.channels,
    };
  }

  /**
   * Steps 8–12: create the warning, optionally wait for a second approver, then issue via the
   * notification gateway. Offline clients send `pendingSync` (Interaction #3).
   */
  create(officer: AuthUser, input: CreateWarningRequest): WarningDto {
    if (input.clientId) {
      const existing = this.warnings.findByClientId(input.clientId);
      if (existing) return this.assembler.toDto(existing);
    }
    const report = this.requireVerified(input.reportId);
    const areas = this.requireAreas(input.areaIds);
    const estimate = this.audience.estimate(areas);
    if (estimate.requiresAudienceConfirm && !input.confirmedAudience) {
      throw new ValidationError('The request contains invalid data.', [
        {
          field: 'confirmedAudience',
          message: `Confirm sending to about ${estimate.estimatedAudience.toLocaleString('en-GB')} people.`,
        },
      ]);
    }
    const pendingSync = Boolean(input.pendingSync);
    const status = initialStatus(input.level, pendingSync);
    const issuedAt = status === WarningStatus.Issued ? this.clock().toISOString() : null;
    const record = this.warnings.insert({
      reportId: report.id,
      hazardType: report.hazardType,
      level: input.level,
      reason: input.reason,
      language: input.language,
      status,
      syncStatus: pendingSync ? SyncStatus.PendingSync : SyncStatus.Synced,
      estimatedAudience: estimate.estimatedAudience,
      createdBy: officer.id,
      clientId: input.clientId ?? null,
      issuedAt,
      createdAt: this.clock().toISOString(),
      areaIds: input.areaIds,
      channels: input.channels,
    });
    if (status === WarningStatus.Issued) {
      void this.notifier.issued(record.id);
    } else if (status === WarningStatus.PendingApproval) {
      void this.notifier.alertApprover(record.id, 0);
    }
    return this.assembler.toDto(record);
  }

  /** Flushes a PendingSync warning once the device is back online. */
  sync(id: number): WarningDto {
    const warning = this.requireWarning(id);
    if (warning.syncStatus !== SyncStatus.PendingSync) return this.assembler.toDto(warning);
    const status = initialStatus(warning.level, false);
    this.warnings.markSynced(id);
    this.warnings.updateStatus(id, status, {
      issuedAt: status === WarningStatus.Issued ? this.clock().toISOString() : null,
    });
    if (status === WarningStatus.Issued) void this.notifier.issued(id);
    return this.assembler.toDto(this.warnings.getById(id));
  }

  approve(approver: AuthUser, id: number, input: ApprovalRequest): WarningDto {
    const warning = this.requireWarning(id);
    if (input.decision === 'Approved') {
      assertTransition(warning.status, WarningStatus.Issued);
      this.warnings.updateStatus(id, WarningStatus.Issued, {
        issuedAt: this.clock().toISOString(),
      });
      this.warnings.insertApproval(id, approver.id, input.decision, input.notes ?? null);
      void this.notifier.issued(id);
    } else {
      assertTransition(warning.status, WarningStatus.Withdrawn);
      this.warnings.updateStatus(id, WarningStatus.Withdrawn);
      this.warnings.insertApproval(id, approver.id, input.decision, input.notes ?? null);
      // 10a: no warning is issued, the officer is told why, and the report stays Verified.
      void this.notifier.notApproved(warning, input.notes);
    }
    return this.assembler.toDto(this.warnings.getById(id));
  }

  /** DIST-02 #7 / #8: correct (including lower level / AllClear) or withdraw an issued warning. */
  correct(actor: AuthUser, id: number, input: CorrectionRequest): WarningDto {
    const warning = this.requireWarning(id);
    this.assertMayCorrect(actor, warning.level, input);
    if (input.action === 'Withdraw') {
      assertTransition(warning.status, WarningStatus.Withdrawn);
      this.warnings.updateStatus(id, WarningStatus.Withdrawn);
      void this.notifier.withdrawn(warning);
    } else {
      assertTransition(warning.status, WarningStatus.Corrected);
      if (input.areaIds) this.requireAreas(input.areaIds);
      this.warnings.updateStatus(id, WarningStatus.Corrected, {
        level: input.level,
        reason: input.reason,
      });
      if (input.areaIds) this.warnings.replaceAreas(id, input.areaIds);
      void this.notifier.issued(id);
    }
    return this.assembler.toDto(this.warnings.getById(id));
  }

  delivery(id: number): WarningDelivery {
    const warning = this.requireWarning(id);
    const deliveries = this.notifier.deliveries(id);
    return { warning: this.assembler.toDto(warning), deliveries };
  }

  /**
   * 10b: alerts the next approver on the roster for every warning that has waited longer than
   * APPROVAL_RESPONSE_MINUTES. Returns how many approvers were alerted.
   */
  async escalateOverdueApprovals(): Promise<number> {
    const now = this.clock();
    const cutoff = new Date(now.getTime() - APPROVAL_RESPONSE_MINUTES * 60_000).toISOString();
    let alerted = 0;
    for (const { id, escalationCount } of this.warnings.listAwaitingApprovalSince(cutoff)) {
      this.warnings.recordEscalation(id, now.toISOString());
      if (await this.notifier.alertApprover(id, escalationCount + 1)) alerted += 1;
    }
    return alerted;
  }

  retryFailed(): Promise<number> {
    return this.notifier.retryFailed();
  }

  /**
   * 14a / DIST-02 #8: correcting, lowering or withdrawing a Warning or Emergency follows the same
   * approval rule as raising one, so a Second Approver must confirm it.
   */
  private assertMayCorrect(actor: AuthUser, current: WarningLevel, input: CorrectionRequest): void {
    const touchesHighLevel =
      requiresSecondApproval(current) ||
      (input.action === 'Correct' &&
        input.level !== undefined &&
        requiresSecondApproval(input.level));
    if (touchesHighLevel && actor.role !== Role.SecondApprover) {
      throw new ForbiddenError(
        'A Second Approver must confirm a correction or withdrawal of a Warning or Emergency.',
      );
    }
  }

  private requireVerified(reportId: number) {
    const report = this.reports.findById(reportId);
    if (!report) throw new NotFoundError(`Report ${reportId}`);
    if (report.status !== ReportStatus.Verified) {
      throw new InvalidStateError('A warning can only be raised from a verified report.');
    }
    return report;
  }

  private requireWarning(id: number) {
    const warning = this.warnings.findById(id);
    if (!warning) throw new NotFoundError(`Warning ${id}`);
    return warning;
  }

  private requireAreas(areaIds: number[]) {
    const areas = this.districts.findByIds(areaIds);
    if (areas.length !== areaIds.length) {
      throw new ValidationError('The request contains invalid data.', [
        { field: 'areaIds', message: 'Every area must be a known district.' },
      ]);
    }
    return areas.map((d) => ({ id: d.id, name: d.name, population: d.population }));
  }
}
