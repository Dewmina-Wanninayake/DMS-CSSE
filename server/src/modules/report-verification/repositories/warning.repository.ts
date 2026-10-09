import type {
  Channel,
  HazardType,
  Language,
  SyncStatus,
  WarningLevel,
  WarningStatus,
} from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface WarningRecord {
  id: number;
  reportId: number;
  hazardType: HazardType;
  level: WarningLevel;
  reason: string;
  language: Language;
  status: WarningStatus;
  syncStatus: SyncStatus;
  estimatedAudience: number;
  createdBy: number;
  clientId: string | null;
  issuedAt: string | null;
  createdAt: string;
}

export interface NewWarning {
  reportId: number;
  hazardType: HazardType;
  level: WarningLevel;
  reason: string;
  language: Language;
  status: WarningStatus;
  syncStatus: SyncStatus;
  estimatedAudience: number;
  createdBy: number;
  clientId: string | null;
  issuedAt: string | null;
  /** From the injected clock, so waiting time (extension 10b) is measured on the same clock. */
  createdAt: string;
  areaIds: number[];
  channels: Channel[];
}

interface Row {
  id: number;
  report_id: number;
  hazard_type: HazardType;
  level: WarningLevel;
  reason: string;
  language: Language;
  status: WarningStatus;
  sync_status: SyncStatus;
  estimated_audience: number;
  created_by: number;
  client_id: string | null;
  issued_at: string | null;
  created_at: string;
}

const toRecord = (r: Row): WarningRecord => ({
  id: r.id,
  reportId: r.report_id,
  hazardType: r.hazard_type,
  level: r.level,
  reason: r.reason,
  language: r.language,
  status: r.status,
  syncStatus: r.sync_status,
  estimatedAudience: r.estimated_audience,
  createdBy: r.created_by,
  clientId: r.client_id,
  issuedAt: r.issued_at,
  createdAt: r.created_at,
});

/** Data access for warnings and their areas, channels and approvals. Status rules live in `warning-state-machine.ts`. */
export class WarningRepository {
  constructor(private readonly db: Db) {}

  insert(input: NewWarning): WarningRecord {
    const result = this.db
      .prepare(
        `INSERT INTO warnings
           (report_id, hazard_type, level, reason, language, status, sync_status,
            estimated_audience, created_by, client_id, issued_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.reportId,
        input.hazardType,
        input.level,
        input.reason,
        input.language,
        input.status,
        input.syncStatus,
        input.estimatedAudience,
        input.createdBy,
        input.clientId,
        input.issuedAt,
        input.createdAt,
        input.createdAt,
      );
    const id = Number(result.lastInsertRowid);
    const area = this.db.prepare(
      'INSERT INTO warning_areas (warning_id, district_id) VALUES (?, ?)',
    );
    for (const districtId of input.areaIds) area.run(id, districtId);
    const ch = this.db.prepare('INSERT INTO warning_channels (warning_id, channel) VALUES (?, ?)');
    for (const channel of input.channels) ch.run(id, channel);
    return this.getById(id);
  }

  getById(id: number): WarningRecord {
    const row = this.db.prepare('SELECT * FROM warnings WHERE id = ?').get(id) as Row | undefined;
    if (!row) throw new Error(`Warning ${id} missing after insert`);
    return toRecord(row);
  }

  findById(id: number): WarningRecord | undefined {
    const row = this.db.prepare('SELECT * FROM warnings WHERE id = ?').get(id) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  findByClientId(clientId: string): WarningRecord | undefined {
    const row = this.db.prepare('SELECT * FROM warnings WHERE client_id = ?').get(clientId) as
      Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  listByStatus(status: WarningStatus): WarningRecord[] {
    return (
      this.db.prepare('SELECT * FROM warnings WHERE status = ? ORDER BY id').all(status) as Row[]
    ).map(toRecord);
  }

  areaIds(warningId: number): number[] {
    return (
      this.db
        .prepare('SELECT district_id FROM warning_areas WHERE warning_id = ?')
        .all(warningId) as { district_id: number }[]
    ).map((r) => r.district_id);
  }

  channels(warningId: number): Channel[] {
    return (
      this.db
        .prepare('SELECT channel FROM warning_channels WHERE warning_id = ?')
        .all(warningId) as { channel: Channel }[]
    ).map((r) => r.channel);
  }

  updateStatus(
    id: number,
    status: WarningStatus,
    extras: { issuedAt?: string | null; level?: WarningLevel; reason?: string } = {},
  ): void {
    this.db
      .prepare(
        `UPDATE warnings SET status = ?,
           issued_at = COALESCE(?, issued_at),
           level = COALESCE(?, level),
           reason = COALESCE(?, reason),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      )
      .run(status, extras.issuedAt ?? null, extras.level ?? null, extras.reason ?? null, id);
  }

  replaceAreas(warningId: number, areaIds: number[]): void {
    this.db.prepare('DELETE FROM warning_areas WHERE warning_id = ?').run(warningId);
    const insert = this.db.prepare(
      'INSERT INTO warning_areas (warning_id, district_id) VALUES (?, ?)',
    );
    for (const id of areaIds) insert.run(warningId, id);
  }

  insertApproval(
    warningId: number,
    approverId: number,
    decision: string,
    notes: string | null,
  ): void {
    this.db
      .prepare(
        'INSERT INTO warning_approvals (warning_id, approver_id, decision, notes) VALUES (?, ?, ?, ?)',
      )
      .run(warningId, approverId, decision, notes);
  }

  markSynced(id: number): void {
    this.db.prepare(`UPDATE warnings SET sync_status = 'Synced' WHERE id = ?`).run(id);
  }

  /**
   * 10b: warnings still waiting for a Second Approver since before `cutoff` (their creation, or the
   * last time they were passed on).
   */
  listAwaitingApprovalSince(cutoff: string): { id: number; escalationCount: number }[] {
    return (
      this.db
        .prepare(
          `SELECT id, escalation_count FROM warnings
           WHERE status = 'PendingApproval' AND COALESCE(last_escalated_at, created_at) <= ?
           ORDER BY id`,
        )
        .all(cutoff) as { id: number; escalation_count: number }[]
    ).map((row) => ({ id: row.id, escalationCount: row.escalation_count }));
  }

  recordEscalation(id: number, at: string): void {
    this.db
      .prepare(
        'UPDATE warnings SET escalation_count = escalation_count + 1, last_escalated_at = ? WHERE id = ?',
      )
      .run(at, id);
  }
}
