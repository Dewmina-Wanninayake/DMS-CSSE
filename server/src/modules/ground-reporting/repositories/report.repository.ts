import type { HazardType, LocationSource, ReportStatus, SyncStatus } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import type { ExistingReport } from '../domain/duplicate-detector';

export interface ReportRecord {
  id: number;
  clientId: string | null;
  reporterId: number;
  hazardType: HazardType;
  description: string;
  status: ReportStatus;
  syncStatus: SyncStatus;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  districtId: number;
  districtName: string;
  reportedAt: string;
  duplicateOf: number | null;
  hasPhoto: boolean;
}

export interface NewReport {
  clientId: string | null;
  reporterId: number;
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  districtId: number;
  duplicateOf: number | null;
  reportedAt: string;
}

/** Fields a citizen may change while answering a NeedsInformation request (undefined = keep). */
export interface ReportChanges {
  description?: string;
  latitude?: number;
  longitude?: number;
  locationSource?: LocationSource;
  districtId?: number;
  status: ReportStatus;
}

interface Row {
  id: number;
  client_id: string | null;
  reporter_id: number;
  hazard_type: HazardType;
  description: string;
  status: ReportStatus;
  sync_status: SyncStatus;
  latitude: number;
  longitude: number;
  location_source: LocationSource;
  district_id: number;
  district_name: string;
  reported_at: string;
  duplicate_of: number | null;
  has_photo: number;
}

const SELECT = `SELECT r.*, d.name AS district_name,
                       EXISTS (SELECT 1 FROM report_photos p WHERE p.report_id = r.id) AS has_photo
                FROM hazard_reports r JOIN districts d ON d.id = r.district_id`;

const toRecord = (row: Row): ReportRecord => ({
  id: row.id,
  clientId: row.client_id,
  reporterId: row.reporter_id,
  hazardType: row.hazard_type,
  description: row.description,
  status: row.status,
  syncStatus: row.sync_status,
  latitude: row.latitude,
  longitude: row.longitude,
  locationSource: row.location_source,
  districtId: row.district_id,
  districtName: row.district_name,
  reportedAt: row.reported_at,
  duplicateOf: row.duplicate_of,
  hasPhoto: row.has_photo === 1,
});

/** Data access for `hazard_reports` as written by UC-CV-003 (no business rules here). */
export class ReportRepository {
  constructor(private readonly db: Db) {}

  findById(id: number): ReportRecord | null {
    const row = this.db.prepare(`${SELECT} WHERE r.id = ?`).get(id) as Row | undefined;
    return row ? toRecord(row) : null;
  }

  findByClientId(clientId: string): ReportRecord | null {
    const row = this.db.prepare(`${SELECT} WHERE r.client_id = ?`).get(clientId) as Row | undefined;
    return row ? toRecord(row) : null;
  }

  /** Pending sync is a device-side state, so the server always stores `Synced` (assumption). */
  insert(report: NewReport): ReportRecord {
    const result = this.db
      .prepare(
        `INSERT INTO hazard_reports
           (client_id, reporter_id, hazard_type, description, status, sync_status, latitude,
            longitude, location_source, district_id, duplicate_of, reported_at)
         VALUES (?, ?, ?, ?, 'Pending', 'Synced', ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        report.clientId,
        report.reporterId,
        report.hazardType,
        report.description,
        report.latitude,
        report.longitude,
        report.locationSource,
        report.districtId,
        report.duplicateOf,
        report.reportedAt,
      );
    return this.findById(Number(result.lastInsertRowid)) as ReportRecord;
  }

  listByReporter(
    reporterId: number,
    status: ReportStatus | undefined,
    limit: number,
    offset: number,
  ): { items: ReportRecord[]; total: number } {
    const filter = 'r.reporter_id = ? AND (? IS NULL OR r.status = ?)';
    const args = [reporterId, status ?? null, status ?? null];
    const rows = this.db
      .prepare(`${SELECT} WHERE ${filter} ORDER BY r.reported_at DESC, r.id DESC LIMIT ? OFFSET ?`)
      .all(...args, limit, offset) as Row[];
    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM hazard_reports r WHERE ${filter}`)
      .get(...args) as { total: number };
    return { items: rows.map(toRecord), total };
  }

  /** Reports of one hazard type inside a time range: the pool the DuplicateDetector scans. */
  findDuplicateCandidates(
    hazardType: HazardType,
    fromIso: string,
    toIso: string,
  ): ExistingReport[] {
    const rows = this.db
      .prepare(
        `SELECT id, hazard_type, latitude, longitude, reported_at, status, duplicate_of
         FROM hazard_reports WHERE hazard_type = ? AND reported_at BETWEEN ? AND ?`,
      )
      .all(hazardType, fromIso, toIso) as Pick<
      Row,
      'id' | 'hazard_type' | 'latitude' | 'longitude' | 'reported_at' | 'status' | 'duplicate_of'
    >[];
    return rows.map((row) => ({
      id: row.id,
      hazardType: row.hazard_type,
      latitude: row.latitude,
      longitude: row.longitude,
      reportedAt: row.reported_at,
      status: row.status,
      duplicateOf: row.duplicate_of,
    }));
  }

  applyChanges(id: number, changes: ReportChanges): void {
    this.db
      .prepare(
        `UPDATE hazard_reports SET
           description = COALESCE(?, description),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude),
           location_source = COALESCE(?, location_source),
           district_id = COALESCE(?, district_id),
           status = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      )
      .run(
        changes.description ?? null,
        changes.latitude ?? null,
        changes.longitude ?? null,
        changes.locationSource ?? null,
        changes.districtId ?? null,
        changes.status,
        id,
      );
  }
}
