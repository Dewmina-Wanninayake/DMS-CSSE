import type { HazardType, RiskThresholds, WarningCriterion } from '@dms/shared';
import type { PolicySetting, SettingsRepository } from '../repositories/settings.repository';

/**
 * Risk thresholds and the warning criteria derived from them. UC-DIST-02's decision support
 * reads `activeWarningCriteria()` (critique DA #8); the Policy Director may adjust a threshold
 * directly, and approving a policy that carries one updates it too.
 */
export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  list(): PolicySetting[] {
    return this.settings.list();
  }

  update(hazardType: HazardType, thresholds: RiskThresholds): PolicySetting {
    this.settings.update(hazardType, thresholds, null);
    return this.settings.get(hazardType);
  }

  activeWarningCriteria(): WarningCriterion[] {
    return this.settings.list().map((s) => ({
      hazardType: s.hazardType,
      riskThreshold: s.riskThreshold,
      mediumRatio: s.mediumRatio,
      minDataPoints: s.minDataPoints,
      sourcePolicyKey: s.sourcePolicyKey,
    }));
  }
}
