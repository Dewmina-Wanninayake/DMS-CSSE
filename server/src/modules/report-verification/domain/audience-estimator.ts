import { VERIFICATION_LIMITS } from '@dms/shared';

export interface AreaPopulation {
  id: number;
  name: string;
  population: number;
}

/** Sums resident population of selected districts (preview audience size, Interaction #2). */
export class AudienceEstimator {
  estimate(areas: AreaPopulation[]): {
    estimatedAudience: number;
    requiresAudienceConfirm: boolean;
    districts: AreaPopulation[];
  } {
    const estimatedAudience = areas.reduce((sum, area) => sum + area.population, 0);
    return {
      estimatedAudience,
      requiresAudienceConfirm: estimatedAudience >= VERIFICATION_LIMITS.audienceConfirmAt,
      districts: areas,
    };
  }
}
