import { HAZARD_TYPE_LABELS } from '@dms/shared';
import type { StepProps } from './wizard-types';

/** Step 5: summary for review before submitting. */
export function ReviewStep({ draft }: Pick<StepProps, 'draft'>) {
  return (
    <dl className="summary">
      <div className="summary__row">
        <dt>Hazard</dt>
        <dd>{draft.hazardType ? HAZARD_TYPE_LABELS[draft.hazardType] : '–'}</dd>
      </div>
      <div className="summary__row">
        <dt>Description</dt>
        <dd>{draft.description.trim() || 'No description'}</dd>
      </div>
      <div className="summary__row">
        <dt>Photo</dt>
        <dd>{draft.photo ? draft.photoName : 'None'}</dd>
      </div>
      <div className="summary__row">
        <dt>Location</dt>
        <dd>
          {draft.position
            ? `${draft.position.latitude.toFixed(4)}, ${draft.position.longitude.toFixed(4)} (${draft.locationSource === 'Gps' ? 'GPS' : 'pin'})`
            : '–'}
        </dd>
      </div>
    </dl>
  );
}
