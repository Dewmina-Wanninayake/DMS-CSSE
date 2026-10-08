import type { HazardType, RiskThresholds } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import { NotFoundError } from '../../../core/http/errors';

export interface PolicySetting extends RiskThresholds {
  hazardType: HazardType;
  sourcePolicyId: number | null;
  sourcePolicyKey: string | null;
}

interface Row {
  hazard_type: HazardType;
  risk_threshold: number;
  medium_ratio: number;
  min_data_points: number;
  source_policy_id: number | null;
  source_policy_key: string | null;
}

const SELECT = `SELECT s.*, p.policy_key AS source_policy_key
                FROM policy_settings s LEFT JOIN policies p ON p.id = s.source_policy_id`;

const toSetting = (row: Row): PolicySetting => ({
  hazardType: row.hazard_type,
  riskThreshold: row.risk_threshold,
  mediumRatio: row.medium_ratio,
  minDataPoints: row.min_data_points,
  sourcePolicyId: row.source_policy_id,
  sourcePolicyKey: row.source_policy_key,
});

/** The "policy settings" that hold risk thresholds (revised step 4). */
export class SettingsRepository {
  constructor(private readonly db: Db) {}

  get(hazardType: HazardType): PolicySetting {
    const row = this.db.prepare(`${SELECT} WHERE s.hazard_type = ?`).get(hazardType) as
      Row | undefined;
    if (!row) throw new NotFoundError(`Policy settings for ${hazardType}`);
    return toSetting(row);
  }

  list(): PolicySetting[] {
    return (this.db.prepare(`${SELECT} ORDER BY s.hazard_type`).all() as Row[]).map(toSetting);
  }

  update(hazardType: HazardType, thresholds: RiskThresholds, sourcePolicyId: number | null): void {
    this.db
      .prepare(
        `UPDATE policy_settings
         SET risk_threshold = ?, medium_ratio = ?, min_data_points = ?, source_policy_id = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE hazard_type = ?`,
      )
      .run(
        thresholds.riskThreshold,
        thresholds.mediumRatio,
        thresholds.minDataPoints,
        sourcePolicyId,
        hazardType,
      );
  }
}
