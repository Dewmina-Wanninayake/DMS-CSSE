import {
  ReportStatus,
  VERIFICATION_LIMITS,
  VerificationDecision,
  VerificationErrorCode,
  type AuthUser,
  type DecisionRequest,
  type NearbyReport,
  type QueueReport,
  type ReportReview,
  type VerificationQueue,
  type WarningDto,
} from '@dms/shared';
import type { HydrometProvider } from '../../../core/hydromet/hydromet-provider';
import {
  InvalidStateError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../../core/http/errors';
import type { NotificationService } from '../../../core/notifications/notification.service';
import type { EvidenceRule } from '../domain/evidence-rule';
import { distanceKm } from '../domain/geo';
import type { CriteriaRepository } from '../repositories/criteria.repository';
import type { HazardReportRecord, HazardReportRepository } from '../repositories/hazard-report.repository';
import type { VerificationRepository } from '../repositories/verification.repository';
import type { WarningRepository } from '../repositories/warning.repository';
import type { WarningAssembler } from './warning.assembler';

const OPEN_STATUSES: readonly string[] = [ReportStatus.Pending, ReportStatus.NeedsInformation];

const toReportStatus = (decision: VerificationDecision): ReportStatus => {
  if (decision === VerificationDecision.RequiresInformation) return ReportStatus.NeedsInformation;
  return decision === VerificationDecision.Verified ? ReportStatus.Verified : ReportStatus.Rejected;
};

export class ReportVerificationService {
  constructor(
    private readonly reports: HazardReportRepository,
    private readonly verifications: VerificationRepository,
    private readonly warnings: WarningRepository,
    private readonly criteria: CriteriaRepository,
    private readonly evidence: EvidenceRule,
    private readonly hydromet: HydrometProvider,
    private readonly notifications: NotificationService,
    private readonly assembler: WarningAssembler,
    private readonly clock: () => Date,
  ) {}

  /** Step 1: pending reports plus warnings waiting for a second approver. */
  queue(): VerificationQueue {
    return {
      reports: this.reports.listPending().map(toQueueItem),
      pendingApprovals: this.warnings
        .listByStatus('PendingApproval')
        .map((w) => this.assembler.toDto(w))
        .map(toQueueWarning),
    };
  }

  /** Steps 2–4: report, map support (nearby 2 km / 2 h), latest sensor, evidence, M2 criteria. */
  review(id: number): ReportReview {
    const report = this.requireReport(id);
    const nearby = this.nearby(report);
    const evidence = this.evidence.assess({
      locationSource: report.locationSource,
      photoPath: report.photoPath,
      corroborationCount: nearby.length,
    });
    const existing = this.verifications.findByReportId(id);
    return {
      id: report.id,
      hazardType: report.hazardType,
      description: report.description,
      severity: report.severity,
      status: report.status,
      latitude: report.latitude,
      longitude: report.longitude,
      locationSource: report.locationSource,
      photoPath: report.photoPath,
      districtId: report.districtId,
      districtName: report.districtName,
      reporterId: report.reporterId,
      reporterName: report.reporterName,
      reportedAt: report.reportedAt,
      duplicateOf: report.duplicateOf,
      nearby,
      latestSensor: this.latestSensor(report.districtId),
      warningCriteria: this.criteria.forHazard(report.hazardType),
      evidence,
      decision: existing?.decision ?? null,
      notes: existing?.notes ?? null,
    };
  }

  /**
   * Steps 5–6 / 6a: record the decision, update the ground report, notify the reporter.
   * Verified requires the minimum evidence rule (DIST-02 #3).
   */
  decide(officer: AuthUser, reportId: number, input: DecisionRequest): ReportReview {
    const report = this.requireReport(reportId);
    if (!OPEN_STATUSES.includes(report.status)) {
      throw new InvalidStateError('This report has already been decided.');
    }
    this.assertDecision(input, reportId);
    const nearby = this.nearby(report);
    const evidence = this.evidence.assess({
      locationSource: report.locationSource,
      photoPath: report.photoPath,
      corroborationCount: nearby.length,
    });
    if (input.decision === VerificationDecision.Verified && !evidence.sufficient) {
      throw new UnprocessableError(
        VerificationErrorCode.InsufficientEvidence,
        'GPS plus a photo, or a nearby corroborating report, is required to verify.',
        evidence,
      );
    }

    const status = toReportStatus(input.decision);
    this.reports.applyDecision({
      id: reportId,
      status,
      severity: input.decision === VerificationDecision.Verified ? (input.severity ?? null) : report.severity,
      duplicateOf: input.duplicateOf ?? null,
      verifiedAt: status === ReportStatus.Verified ? this.clock().toISOString() : null,
    });
    this.verifications.insert({
      reportId,
      officerId: officer.id,
      decision: input.decision,
      notes: input.notes?.trim() || null,
      severity: input.severity ?? null,
      duplicateOf: input.duplicateOf ?? null,
    });

    void this.notifications.notifyUser(report.reporterId, {
      subject: `Report ${input.decision === VerificationDecision.RequiresInformation ? 'needs information' : input.decision.toLowerCase()}`,
      body:
        input.decision === VerificationDecision.Verified
          ? 'Your ground hazard report has been verified.'
          : (input.notes ?? 'Your report was reviewed.'),
      relatedType: 'hazard_report',
      relatedId: reportId,
    });

    return this.review(reportId);
  }

  private nearby(report: HazardReportRecord): NearbyReport[] {
    const reported = Date.parse(report.reportedAt);
    const windowMs = VERIFICATION_LIMITS.nearbyWindowHours * 60 * 60 * 1000;
    const from = new Date(reported - windowMs).toISOString();
    const to = new Date(reported + windowMs).toISOString();
    return this.reports
      .listNearbyCandidates(report.id, from, to)
      .map((other) => ({
        id: other.id,
        hazardType: other.hazardType,
        districtName: other.districtName,
        reportedAt: other.reportedAt,
        distanceKm: Math.round(distanceKm(report, other) * 100) / 100,
        status: other.status,
      }))
      .filter((n) => n.distanceKm <= VERIFICATION_LIMITS.nearbyRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private latestSensor(districtId: number) {
    try {
      const now = this.clock();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const rows = this.hydromet.getObservations({
        districtIds: [districtId],
        from,
        to: now.toISOString(),
      });
      const last = rows.at(-1);
      if (!last) return null;
      return {
        stationName: last.stationName,
        observedAt: last.observedAt,
        rainfallMm: last.rainfallMm,
        riverLevelM: last.riverLevelM,
      };
    } catch {
      return null;
    }
  }

  private assertDecision(input: DecisionRequest, reportId: number): void {
    if (input.decision === VerificationDecision.Verified && !input.severity) {
      throw new ValidationError('The request contains invalid data.', [
        { field: 'severity', message: 'Severity is required when the report is verified.' },
      ]);
    }
    if (
      (input.decision === VerificationDecision.Rejected ||
        input.decision === VerificationDecision.RequiresInformation) &&
      (input.notes?.trim().length ?? 0) < VERIFICATION_LIMITS.notesMin
    ) {
      throw new ValidationError('The request contains invalid data.', [
        { field: 'notes', message: 'Notes are required when rejecting or asking for information.' },
      ]);
    }
    if (input.duplicateOf !== undefined && input.duplicateOf !== null) {
      if (input.duplicateOf === reportId) {
        throw new ValidationError('The request contains invalid data.', [
          { field: 'duplicateOf', message: 'A report cannot be a duplicate of itself.' },
        ]);
      }
      if (!this.reports.findById(input.duplicateOf)) {
        throw new NotFoundError(`Report ${input.duplicateOf}`);
      }
    }
  }

  private requireReport(id: number): HazardReportRecord {
    const report = this.reports.findById(id);
    if (!report) throw new NotFoundError(`Report ${id}`);
    return report;
  }
}

function toQueueItem(r: HazardReportRecord): QueueReport {
  return {
    id: r.id,
    hazardType: r.hazardType,
    description: r.description,
    districtName: r.districtName,
    reportedAt: r.reportedAt,
    hasPhoto: Boolean(r.photoPath),
    locationSource: r.locationSource,
  };
}

function toQueueWarning(w: WarningDto) {
  return {
    id: w.id,
    level: w.level,
    hazardType: w.hazardType,
    reason: w.reason,
    status: w.status,
    estimatedAudience: w.estimatedAudience,
    createdAt: w.createdAt,
  };
}
