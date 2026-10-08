import { RiskLevel, type RiskThresholds } from '@dms/shared';

/** Strategy: how a district's verified-report count becomes a risk level. */
export interface RiskClassifier {
  classify(verifiedCount: number, thresholds: RiskThresholds): RiskLevel;
}

/**
 * Critique DA #4 — the testable rule:
 *  - count **above** the threshold   → High   (Risk Zone A in the hi-fi overlay)
 *  - count ≥ threshold × mediumRatio → Medium (Zone B)
 *  - otherwise                       → Low    (Zone C)
 */
export class ThresholdRiskClassifier implements RiskClassifier {
  classify(verifiedCount: number, { riskThreshold, mediumRatio }: RiskThresholds): RiskLevel {
    if (verifiedCount > riskThreshold) return RiskLevel.High;
    if (verifiedCount >= riskThreshold * mediumRatio) return RiskLevel.Medium;
    return RiskLevel.Low;
  }
}
