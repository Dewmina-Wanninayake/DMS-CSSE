import type { HazardType, TrendReport } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import { NotFoundError } from '../../../core/http/errors';

/** A trend report before the database assigns its id and timestamp. */
export type NewTrendReport = Omit<TrendReport, 'id' | 'createdAt'>;

interface Row {
  id: number;
  analyst_id: number;
  hazard_type: HazardType;
  district_ids: string;
  result_json: string;
  created_at: string;
}

const toReport = (row: Row): TrendReport => ({
  ...(JSON.parse(row.result_json) as NewTrendReport),
  id: row.id,
  createdAt: row.created_at,
});

export class TrendReportRepository {
  constructor(private readonly db: Db) {}

  insert(analystId: number, districtIds: number[], report: NewTrendReport): TrendReport {
    const result = this.db
      .prepare(
        `INSERT INTO trend_reports
           (analyst_id, hazard_type, district_ids, period_start, period_end, sparse, result_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        analystId,
        report.hazardType,
        JSON.stringify(districtIds),
        report.periodStart,
        report.periodEnd,
        report.sparse ? 1 : 0,
        JSON.stringify(report),
      );
    return this.getById(Number(result.lastInsertRowid));
  }

  getById(id: number): TrendReport {
    const row = this.db.prepare('SELECT * FROM trend_reports WHERE id = ?').get(id) as
      Row | undefined;
    if (!row) throw new NotFoundError('Trend report');
    return toReport(row);
  }

  /** District ids a report was generated for (needed to pre-fill a policy draft). */
  getDistrictIds(id: number): number[] {
    const row = this.db.prepare('SELECT district_ids FROM trend_reports WHERE id = ?').get(id) as
      { district_ids: string } | undefined;
    if (!row) throw new NotFoundError('Trend report');
    return JSON.parse(row.district_ids) as number[];
  }

  listRecent(limit: number): TrendReport[] {
    return (
      this.db.prepare('SELECT * FROM trend_reports ORDER BY id DESC LIMIT ?').all(limit) as Row[]
    ).map(toReport);
  }
}
