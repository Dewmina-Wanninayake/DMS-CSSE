import { VERIFICATION_LIMITS, type EvidenceAssessment } from '@dms/shared';

export interface EvidenceInput {
  locationSource: 'Gps' | 'Manual';
  photoPath: string | null;
  corroborationCount: number;
}

/**
 * Strategy: GPS + photo, or at least one nearby corroborating report (DIST-02 #3).
 */
export interface EvidenceRule {
  assess(input: EvidenceInput): EvidenceAssessment;
}

/** Verified needs GPS and a photo, or one nearby corroborating report. A manual pin without a photo or a neighbour is not enough. */
export class MinimumEvidenceRule implements EvidenceRule {
  assess(input: EvidenceInput): EvidenceAssessment {
    const hasGps = input.locationSource === 'Gps';
    const hasPhoto = Boolean(input.photoPath);
    const primary = hasGps && hasPhoto;
    const corroboration = input.corroborationCount >= 1;
    const sufficient = primary || corroboration;
    const reasons: string[] = [];
    if (!hasGps) reasons.push('The report was not pinned with GPS.');
    if (!hasPhoto) reasons.push('No photo was attached.');
    if (!corroboration) {
      reasons.push(
        `No other report within ${VERIFICATION_LIMITS.nearbyRadiusKm} km / ${VERIFICATION_LIMITS.nearbyWindowHours} h.`,
      );
    }
    if (sufficient) reasons.length = 0;
    if (sufficient && primary)
      reasons.push('GPS location and photo meet the minimum evidence rule.');
    if (sufficient && !primary) reasons.push('A nearby report corroborates this one.');
    return {
      sufficient,
      hasGps,
      hasPhoto,
      corroborationCount: input.corroborationCount,
      reasons,
    };
  }
}
