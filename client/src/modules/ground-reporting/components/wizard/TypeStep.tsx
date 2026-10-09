import { type HazardTypeOption } from '@dms/shared';
import { Radio } from '../../../../shared/ui/fields';
import type { StepProps } from './wizard-types';

/** Step 1: hazard type. */
export function TypeStep({
  draft,
  onChange,
  errors,
  options,
}: StepProps & { options: HazardTypeOption[] }) {
  return (
    <fieldset className="fieldset stack">
      <legend>What is happening?</legend>
      {options.map((option) => (
        <Radio
          key={option.value}
          name="hazardType"
          label={option.label}
          checked={draft.hazardType === option.value}
          onChange={() => onChange({ hazardType: option.value })}
        />
      ))}
      {errors.hazardType && (
        <span className="field__error" role="alert">
          {errors.hazardType}
        </span>
      )}
    </fieldset>
  );
}
