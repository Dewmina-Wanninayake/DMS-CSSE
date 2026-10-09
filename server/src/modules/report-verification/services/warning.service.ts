import {
  Channel,
  ReportStatus,
  SyncStatus,
  WarningStatus,
  type ApprovalRequest,
  type AuthUser,
  type CorrectionRequest,
  type CreateWarningRequest,
  type WarningDelivery,
  type WarningDto,
  type WarningPreview,
  type WarningPreviewRequest,
} from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from '../../../core/http/errors';
import type { NotificationService } from '../../../core/notifications/notification.service';
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

export class WarningService {
  constructor(
    private readonly reports: HazardReportRepository,
    private readonly warnings: WarningRepository,
    private readonly criteria: CriteriaRepository,
    private readonly districts: DistrictRepository,
    private readonly notifications: NotificationService,
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
      areaIds: input.areaIds,
      channels: input.channels,
    });
    if (status === WarningStatus.Issued) {
      void this.issueNotifications(record.id);
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
    if (status === WarningStatus.Issued) void this.issueNotifications(id);
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
      void this.issueNotifications(id);
    } else {
      assertTransition(warning.status, WarningStatus.Withdrawn);
      this.warnings.updateStatus(id, WarningStatus.Withdrawn);
      this.warnings.insertApproval(id, approver.id, input.decision, input.notes ?? null);
    }
    return this.assembler.toDto(this.warnings.getById(id));
  }

  /** DIST-02 #7 / #8: correct (including lower level / AllClear) or withdraw an issued warning. */
  correct(id: number, input: CorrectionRequest): WarningDto {
    const warning = this.requireWarning(id);
    if (input.action === 'Withdraw') {
      assertTransition(warning.status, WarningStatus.Withdrawn);
      this.warnings.updateStatus(id, WarningStatus.Withdrawn);
      void this.notifications.notifyRoles({
        roles: [this.criteria.teamRole(warning.hazardType)],
        subject: 'Warning withdrawn',
        body: warning.reason,
        relatedType: 'warning',
        relatedId: id,
        channel: Channel.Push,
      });
    } else {
      assertTransition(warning.status, WarningStatus.Corrected);
      if (input.areaIds) this.requireAreas(input.areaIds);
      this.warnings.updateStatus(id, WarningStatus.Corrected, {
        level: input.level,
        reason: input.reason,
      });
      if (input.areaIds) this.warnings.replaceAreas(id, input.areaIds);
      void this.issueNotifications(id);
    }
    return this.assembler.toDto(this.warnings.getById(id));
  }

  delivery(id: number): WarningDelivery {
    const warning = this.requireWarning(id);
    const deliveries = this.notifications.listFor('warning', id).map((n) => ({
      id: n.id,
      channel: n.channel,
      recipient: n.recipient,
      deliveryStatus: n.deliveryStatus,
      retryCount: n.retryCount,
      lastError: n.lastError,
      sentAt: n.sentAt,
    }));
    return { warning: this.assembler.toDto(warning), deliveries };
  }

  retryFailed(): Promise<number> {
    return this.notifications.retryFailed();
  }

  private async issueNotifications(warningId: number): Promise<void> {
    const warning = this.warnings.getById(warningId);
    const dto = this.assembler.toDto(warning);
    const body = `${dto.level}: ${dto.reason} (${dto.areaNames.join(', ')})`;
    const teamRole = this.criteria.teamRole(warning.hazardType);
    for (const channel of dto.channels) {
      await this.notifications.notifyRoles({
        roles: [teamRole],
        subject: `${dto.level} warning`,
        body,
        relatedType: 'warning',
        relatedId: warningId,
        channel,
      });
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
