import type { ReportUpdateItem, ReportUpdateKind } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

interface Row {
  id: number;
  kind: ReportUpdateKind;
  note: string;
  author_name: string;
  created_at: string;
}

const SELECT = `SELECT u.id, u.kind, u.note, u.created_at, a.full_name AS author_name
                FROM report_updates u JOIN users a ON a.id = u.author_id`;

const toItem = (row: Row): ReportUpdateItem => ({
  id: row.id,
  kind: row.kind,
  note: row.note,
  authorName: row.author_name,
  createdAt: row.created_at,
});

/** History of citizen answers and volunteer field updates on a report. */
export class UpdateRepository {
  constructor(private readonly db: Db) {}

  insert(
    reportId: number,
    authorId: number,
    kind: ReportUpdateKind,
    note: string,
  ): ReportUpdateItem {
    const result = this.db
      .prepare('INSERT INTO report_updates (report_id, author_id, kind, note) VALUES (?, ?, ?, ?)')
      .run(reportId, authorId, kind, note);
    const row = this.db.prepare(`${SELECT} WHERE u.id = ?`).get(Number(result.lastInsertRowid));
    return toItem(row as Row);
  }

  listForReport(reportId: number): ReportUpdateItem[] {
    const rows = this.db
      .prepare(`${SELECT} WHERE u.report_id = ? ORDER BY u.created_at, u.id`)
      .all(reportId) as Row[];
    return rows.map(toItem);
  }
}
