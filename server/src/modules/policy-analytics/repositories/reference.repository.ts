import type { HazardType } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import type { SimulationProfile } from '../domain/simulation-model';
import type { RegulatoryRule } from '../domain/regulatory-conflict-checker';

/** Read-only configuration tables: simulation parameters and regulatory rules. */
export class ReferenceRepository {
  constructor(private readonly db: Db) {}

  getHazardProfile(hazardType: HazardType): SimulationProfile | undefined {
    const row = this.db
      .prepare('SELECT * FROM hazard_profiles WHERE hazard_type = ?')
      .get(hazardType) as
      | {
          footprint_ratio: number;
          evacuation_rate_per_team_hr: number;
          water_litres_per_person_day: number;
          food_kg_per_person_day: number;
          medicine_kits_per_100_people: number;
          planning_days: number;
          avg_shelter_capacity: number;
        }
      | undefined;
    if (!row) return undefined;
    return {
      footprintRatio: row.footprint_ratio,
      evacuationRatePerTeamHour: row.evacuation_rate_per_team_hr,
      waterLitresPerPersonDay: row.water_litres_per_person_day,
      foodKgPerPersonDay: row.food_kg_per_person_day,
      medicineKitsPer100People: row.medicine_kits_per_100_people,
      planningDays: row.planning_days,
      avgShelterCapacity: row.avg_shelter_capacity,
    };
  }

  listRegulatoryRules(): RegulatoryRule[] {
    return (
      this.db.prepare('SELECT * FROM regulatory_rules ORDER BY code').all() as {
        code: string;
        description: string;
        forbidden_phrases: string;
      }[]
    ).map((row) => ({
      code: row.code,
      description: row.description,
      forbiddenPhrases: JSON.parse(row.forbidden_phrases) as string[],
    }));
  }
}
