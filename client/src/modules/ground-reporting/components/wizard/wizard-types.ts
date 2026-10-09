import type { HazardType, LocationSource } from '@dms/shared';
import type { Position } from '../../lib/location';

/** What the reporter has entered so far; lives in the wizard so Back never loses anything. */
export interface ReportDraft {
  hazardType?: HazardType;
  description: string;
  photo?: Blob;
  photoName?: string;
  position?: Position;
  locationSource: LocationSource;
}

export interface StepProps {
  draft: ReportDraft;
  onChange: (changes: Partial<ReportDraft>) => void;
  /** Field errors from this step's validation or from the server. */
  errors: Record<string, string>;
}
