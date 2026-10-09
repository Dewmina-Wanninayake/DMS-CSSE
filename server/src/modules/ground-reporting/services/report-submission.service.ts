import type { AuthUser, ReportSummary, SubmitReportInput } from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../../core/http/errors';
import { DuplicateDetector, RadiusTimeWindowRule } from '../domain/duplicate-detector';
import { nearestDistrict } from '../domain/geo';
import { validateReportedAt } from '../domain/report-rules';
import type { ReportRepository } from '../repositories/report.repository';
import type { ReportSettingsRepository } from '../repositories/settings.repository';
import type { ReportAssembler } from './report.assembler';

export interface SubmitResult {
  report: ReportSummary;
  /** False when the same `clientId` had already been stored (idempotent replay). */
  created: boolean;
}

/** Submit: validate, resolve the district, link duplicates, queue for the officer. */
export class ReportSubmissionService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly settings: ReportSettingsRepository,
    private readonly districts: DistrictRepository,
    private readonly assembler: ReportAssembler,
    private readonly clock: () => Date,
  ) {}

  /**
   * Stores a report as `Pending` (it *is* the officer queue). Repeating a `clientId` returns the
   * stored report instead of a second row, so offline retries are safe.
   */
  submit(reporter: AuthUser, input: SubmitReportInput): SubmitResult {
    if (input.clientId) {
      const existing = this.reports.findByClientId(input.clientId);
      if (existing) {
        if (existing.reporterId !== reporter.id) {
          throw new ConflictError('This client id already belongs to another report.');
        }
        return { report: this.assembler.summary(existing), created: false };
      }
    }

    const reportedAt = this.resolveReportedAt(input.reportedAt);
    const match = nearestDistrict(input, this.districts.findAll());
    if (!match) throw new NotFoundError('District');

    const duplicateOf = this.findOriginalId(input, reportedAt);
    const record = this.reports.insert({
      clientId: input.clientId ?? null,
      reporterId: reporter.id,
      hazardType: input.hazardType,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
      locationSource: input.locationSource,
      districtId: match.district.id,
      duplicateOf,
      reportedAt,
    });
    return { report: this.assembler.summary(record), created: true };
  }

  private resolveReportedAt(reportedAt: string | undefined): string {
    const now = this.clock();
    if (reportedAt === undefined) return now.toISOString();
    const problem = validateReportedAt(reportedAt, now);
    if (problem) {
      throw new ValidationError('The request contains invalid data.', [
        { field: 'reportedAt', message: problem },
      ]);
    }
    return new Date(reportedAt).toISOString();
  }

  /** Critique CV-003 #6: duplicates are linked, never blocked. */
  private findOriginalId(input: SubmitReportInput, reportedAt: string): number | null {
    const { radiusMeters, windowMinutes } = this.settings.duplicateSettings();
    const spanMs = windowMinutes * 60_000;
    const time = Date.parse(reportedAt);
    const candidates = this.reports.findDuplicateCandidates(
      input.hazardType,
      new Date(time - spanMs).toISOString(),
      new Date(time + spanMs).toISOString(),
    );
    return new DuplicateDetector(
      new RadiusTimeWindowRule(radiusMeters, windowMinutes),
    ).findOriginalId(
      {
        hazardType: input.hazardType,
        latitude: input.latitude,
        longitude: input.longitude,
        reportedAt,
      },
      candidates,
    );
  }
}
