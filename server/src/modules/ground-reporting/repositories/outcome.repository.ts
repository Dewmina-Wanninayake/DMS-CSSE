import { HAZARD_REPORT_RELATED_TYPE, type ReportOutcome } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

/**
 * Reads the decision messages UC-DIST-02 sent to the reporter (assumption 4: `report_verifications`
 * does not exist yet). Only notifications addressed to the report's own reporter count.
 */
export class OutcomeRepository {
  constructor(private readonly db: Db) {}

  /** Latest outcome per report id; reports without a decision are absent from the map. */
  latestFor(reportIds: number[]): Map<number, ReportOutcome> {
    const outcomes = new Map<number, ReportOutcome>();
    if (reportIds.length === 0) return outcomes;
    const marks = reportIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT n.related_id AS report_id, n.body, n.created_at
         FROM notifications n
         JOIN hazard_reports r ON r.id = n.related_id AND r.reporter_id = n.recipient_user_id
         WHERE n.related_type = ? AND n.related_id IN (${marks})
         ORDER BY n.id`,
      )
      .all(HAZARD_REPORT_RELATED_TYPE, ...reportIds) as {
      report_id: number;
      body: string;
      created_at: string;
    }[];
    for (const row of rows) outcomes.set(row.report_id, { message: row.body, at: row.created_at });
    return outcomes;
  }
}
