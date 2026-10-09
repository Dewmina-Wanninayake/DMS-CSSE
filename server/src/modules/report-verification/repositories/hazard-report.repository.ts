import type { HazardType, ReportStatus, Severity } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface HazardReportRecord {
  id: number;
  reporterId: number;
  reporterName: string;
  hazardType: HazardType;
  description: string;
  severity: Severity | null;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  locationSource: 'Gps' | 'Manual';
  photoPath: string | null;
  districtId: number;
  districtName: string;
  duplicateOf: number | null;
  reportedAt: string;
}

interface Row {
  id: number;
  reporter_id: number;
  reporter_name: string;
  hazard_type: HazardType;
  description: string;
  severity: Severity | null;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  location_source: 'Gps' | 'Manual';
  photo_path: string | null;
  district_id: number;
  district_name: string;
  duplicate_of: number | null;
  reported_at: string;
}

const SELECT = `SELECT r.*, u.full_name AS reporter_name, d.name AS district_name
  FROM hazard_reports r
  JOIN users u ON u.id = r.reporter_id
  JOIN districts d ON d.id = r.district_id`;

const toRecord = (r: Row): HazardReportRecord => ({
  id: r.id,
  reporterId: r.reporter_id,
  reporterName: r.reporter_name,
  hazardType: r.hazard_type,
  description: r.description,
  severity: r.severity,
  status: r.status,
  latitude: r.latitude,
  longitude: r.longitude,
  locationSource: r.location_source,
  photoPath: r.photo_path,
  districtId: r.district_id,
  districtName: r.district_name,
  duplicateOf: r.duplicate_of,
  reportedAt: r.reported_at,
});

/** The officer's view of `hazard_reports`, which UC-CV-003 writes. This module only changes status, severity and the duplicate link. */
export class HazardReportRepository {
  constructor(private readonly db: Db) {}

  findById(id: number): HazardReportRecord | undefined {
    const row = this.db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  listPending(): HazardReportRecord[] {
    return (
      this.db
        .prepare(
          `${SELECT} WHERE r.status IN ('Pending','NeedsInformation') ORDER BY r.reported_at DESC`,
        )
        .all() as Row[]
    ).map(toRecord);
  }

  listNearbyCandidates(excludeId: number, fromIso: string, toIso: string): HazardReportRecord[] {
    return (
      this.db
        .prepare(
          `${SELECT} WHERE r.id != ? AND r.reported_at >= ? AND r.reported_at <= ?
           AND r.status IN ('Pending','Verified','NeedsInformation')`,
        )
        .all(excludeId, fromIso, toIso) as Row[]
    ).map(toRecord);
  }

  applyDecision(input: {
    id: number;
    status: ReportStatus;
    severity: Severity | null;
    duplicateOf: number | null;
    verifiedAt: string | null;
  }): void {
    this.db
      .prepare(
        `UPDATE hazard_reports
         SET status = ?, severity = ?, duplicate_of = ?, verified_at = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      )
      .run(input.status, input.severity, input.duplicateOf, input.verifiedAt, input.id);
  }
}
