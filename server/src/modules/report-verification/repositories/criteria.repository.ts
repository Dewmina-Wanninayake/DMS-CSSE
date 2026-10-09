import type { HazardType, Role, WarningCriterion } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

const DEFAULTS: Omit<WarningCriterion, 'hazardType'> = {
  riskThreshold: 5,
  mediumRatio: 0.5,
  minDataPoints: 3,
  sourcePolicyKey: null,
};

/** Reads M2's published criteria; falls back to the same defaults when none are published. */
export class CriteriaRepository {
  constructor(private readonly db: Db) {}

  forHazard(hazardType: HazardType): WarningCriterion {
    const row = this.db
      .prepare(
        `SELECT s.hazard_type AS hazardType, s.risk_threshold AS riskThreshold,
                s.medium_ratio AS mediumRatio, s.min_data_points AS minDataPoints,
                p.policy_key AS sourcePolicyKey
         FROM policy_settings s
         LEFT JOIN policies p ON p.id = s.source_policy_id
         WHERE s.hazard_type = ?`,
      )
      .get(hazardType) as WarningCriterion | undefined;
    return row ?? { hazardType, ...DEFAULTS };
  }

  teamRole(hazardType: HazardType): Role {
    const row = this.db
      .prepare('SELECT role FROM hazard_team_rules WHERE hazard_type = ?')
      .get(hazardType) as { role: Role } | undefined;
    return row?.role ?? 'RescueTeamLeader';
  }

  listTeamRules(): { hazardType: HazardType; role: Role }[] {
    return this.db
      .prepare('SELECT hazard_type AS hazardType, role FROM hazard_team_rules')
      .all() as {
      hazardType: HazardType;
      role: Role;
    }[];
  }
}
