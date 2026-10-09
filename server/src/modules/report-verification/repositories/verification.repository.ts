import type { Severity, VerificationDecision } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface VerificationRecord {
  reportId: number;
  officerId: number;
  decision: VerificationDecision;
  notes: string | null;
  severity: Severity | null;
  duplicateOf: number | null;
  decidedAt: string;
}

interface Row {
  report_id: number;
  officer_id: number;
  decision: VerificationDecision;
  notes: string | null;
  severity: Severity | null;
  duplicate_of: number | null;
  decided_at: string;
}

const toRecord = (r: Row): VerificationRecord => ({
  reportId: r.report_id,
  officerId: r.officer_id,
  decision: r.decision,
  notes: r.notes,
  severity: r.severity,
  duplicateOf: r.duplicate_of,
  decidedAt: r.decided_at,
});

export class VerificationRepository {
  constructor(private readonly db: Db) {}

  findByReportId(reportId: number): VerificationRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM report_verifications WHERE report_id = ?')
      .get(reportId) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  insert(record: Omit<VerificationRecord, 'decidedAt'>): void {
    this.db
      .prepare(
        `INSERT INTO report_verifications (report_id, officer_id, decision, notes, severity, duplicate_of)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.reportId,
        record.officerId,
        record.decision,
        record.notes,
        record.severity,
        record.duplicateOf,
      );
  }
}
