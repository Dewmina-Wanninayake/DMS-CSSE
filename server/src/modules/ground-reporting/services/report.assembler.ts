import type { ReportDetail, ReportSummary } from '@dms/shared';
import type { OutcomeRepository } from '../repositories/outcome.repository';
import type { ReportRecord } from '../repositories/report.repository';
import type { UpdateRepository } from '../repositories/update.repository';

/** Turns repository records into the API's DTOs (outcome text and update history attached). */
export class ReportAssembler {
  constructor(
    private readonly outcomes: OutcomeRepository,
    private readonly updates: UpdateRepository,
  ) {}

  summaries(records: ReportRecord[]): ReportSummary[] {
    const outcomes = this.outcomes.latestFor(records.map((r) => r.id));
    return records.map((record) => ({
      id: record.id,
      hazardType: record.hazardType,
      description: record.description,
      status: record.status,
      syncStatus: record.syncStatus,
      districtName: record.districtName,
      locationSource: record.locationSource,
      reportedAt: record.reportedAt,
      hasPhoto: record.hasPhoto,
      duplicateOf: record.duplicateOf,
      outcome: outcomes.get(record.id) ?? null,
    }));
  }

  summary(record: ReportRecord): ReportSummary {
    return this.summaries([record])[0] as ReportSummary;
  }

  detail(record: ReportRecord): ReportDetail {
    return {
      ...this.summary(record),
      latitude: record.latitude,
      longitude: record.longitude,
      updates: this.updates.listForReport(record.id),
    };
  }
}
