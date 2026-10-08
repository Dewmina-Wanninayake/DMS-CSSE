import type { HazardType, LatestVerifiedReport } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface DataScope {
  hazardType: HazardType;
  districtIds: number[];
  /** Inclusive ISO instants (see `toBounds`). */
  from: string;
  to: string;
}

export interface MonthlyCounts {
  verified: Map<string, number>;
  historical: Map<string, number>;
}

const placeholders = (ids: number[]): string => ids.map(() => '?').join(',');

/**
 * Read-only access to the data UC-DA-001 analyses. Only **Verified** reports count, and a report
 * linked as a duplicate of another is excluded so one event is not counted twice (UC-CV-003 10a).
 */
export class HazardDataRepository {
  constructor(private readonly db: Db) {}

  countVerifiedByDistrict(scope: DataScope): Map<number, number> {
    return this.groupCount(
      `SELECT district_id AS id, COUNT(*) AS n FROM hazard_reports
       WHERE status = 'Verified' AND duplicate_of IS NULL AND hazard_type = ?
         AND district_id IN (${placeholders(scope.districtIds)}) AND reported_at BETWEEN ? AND ?
       GROUP BY district_id`,
      scope,
    );
  }

  countHistoricalByDistrict(scope: DataScope): Map<number, number> {
    return this.groupCount(
      `SELECT district_id AS id, COUNT(*) AS n FROM historical_incidents
       WHERE hazard_type = ? AND district_id IN (${placeholders(scope.districtIds)})
         AND occurred_at BETWEEN ? AND ?
       GROUP BY district_id`,
      scope,
    );
  }

  monthlyCounts(scope: DataScope): MonthlyCounts {
    const query = (table: string, column: string, extra: string): Map<string, number> => {
      const rows = this.db
        .prepare(
          `SELECT substr(${column}, 1, 7) AS id, COUNT(*) AS n FROM ${table}
           WHERE ${extra} hazard_type = ? AND district_id IN (${placeholders(scope.districtIds)})
             AND ${column} BETWEEN ? AND ?
           GROUP BY substr(${column}, 1, 7)`,
        )
        .all(scope.hazardType, ...scope.districtIds, scope.from, scope.to) as {
        id: string;
        n: number;
      }[];
      return new Map(rows.map((row) => [row.id, row.n]));
    };
    return {
      verified: query(
        'hazard_reports',
        'reported_at',
        "status = 'Verified' AND duplicate_of IS NULL AND",
      ),
      historical: query('historical_incidents', 'occurred_at', ''),
    };
  }

  latestVerified(limit: number): LatestVerifiedReport[] {
    const rows = this.db
      .prepare(
        `SELECT r.id, r.hazard_type, r.description, d.name AS district_name,
                COALESCE(r.verified_at, r.reported_at) AS verified_at
         FROM hazard_reports r JOIN districts d ON d.id = r.district_id
         WHERE r.status = 'Verified' AND r.duplicate_of IS NULL
         ORDER BY COALESCE(r.verified_at, r.reported_at) DESC, r.id DESC LIMIT ?`,
      )
      .all(limit) as {
      id: number;
      hazard_type: HazardType;
      description: string;
      district_name: string;
      verified_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      hazardType: row.hazard_type,
      description: row.description,
      districtName: row.district_name,
      verifiedAt: row.verified_at,
    }));
  }

  private groupCount(sql: string, scope: DataScope): Map<number, number> {
    const rows = this.db
      .prepare(sql)
      .all(scope.hazardType, ...scope.districtIds, scope.from, scope.to) as {
      id: number;
      n: number;
    }[];
    return new Map(rows.map((row) => [row.id, row.n]));
  }
}
