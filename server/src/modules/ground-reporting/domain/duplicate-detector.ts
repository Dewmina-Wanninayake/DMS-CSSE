import { ReportStatus, type HazardType } from '@dms/shared';
import { distanceMeters, type GeoPoint } from './geo';

export interface ReportSnapshot extends GeoPoint {
  hazardType: HazardType;
  /** ISO-8601 UTC. */
  reportedAt: string;
}

export interface ExistingReport extends ReportSnapshot {
  id: number;
  status: ReportStatus;
  duplicateOf: number | null;
}

/** Strategy: what makes two reports "the same incident". Operators tune it via `report_settings`. */
export interface DuplicateRule {
  matches(candidate: ReportSnapshot, existing: ReportSnapshot): boolean;
}

/** Same hazard type, within `radiusMeters` and `windowMinutes` of each other (both inclusive). */
export class RadiusTimeWindowRule implements DuplicateRule {
  constructor(
    private readonly radiusMeters: number,
    private readonly windowMinutes: number,
  ) {}

  matches(candidate: ReportSnapshot, existing: ReportSnapshot): boolean {
    if (candidate.hazardType !== existing.hazardType) return false;
    const gapMs = Math.abs(Date.parse(candidate.reportedAt) - Date.parse(existing.reportedAt));
    if (!(gapMs <= this.windowMinutes * 60_000)) return false;
    return distanceMeters(candidate, existing) <= this.radiusMeters;
  }
}

/**
 * Critique CV-003 #6: duplicates are linked, never blocked. Returns the id the new report should
 * point to in `duplicate_of`, or null when it is a new incident.
 */
export class DuplicateDetector {
  constructor(private readonly rule: DuplicateRule) {}

  /**
   * Links to the earliest matching report (lowest id on a tie). If that report is itself a
   * duplicate, its original is returned so links never form chains. Rejected reports never match.
   */
  findOriginalId(candidate: ReportSnapshot, existing: readonly ExistingReport[]): number | null {
    let earliest: ExistingReport | null = null;
    for (const report of existing) {
      if (report.status === ReportStatus.Rejected) continue;
      if (!this.rule.matches(candidate, report)) continue;
      if (earliest === null || isEarlier(report, earliest)) earliest = report;
    }
    return earliest === null ? null : (earliest.duplicateOf ?? earliest.id);
  }
}

function isEarlier(a: ExistingReport, b: ExistingReport): boolean {
  const diff = Date.parse(a.reportedAt) - Date.parse(b.reportedAt);
  return diff < 0 || (diff === 0 && a.id < b.id);
}
