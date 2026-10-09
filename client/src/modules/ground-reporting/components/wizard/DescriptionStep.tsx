import { MAX_DESCRIPTION_LENGTH } from '@dms/shared';
import { TextArea } from '../../../../shared/ui/fields';
import type { StepProps } from './wizard-types';

/** Step 2: short description (up to 200 characters; required for "Other"). */
export function DescriptionStep({
  draft,
  onChange,
  errors,
  required,
}: StepProps & { required: boolean }) {
  return (
    <TextArea
      label="Describe what you see"
      hint={
        required
          ? `Required for other hazards. ${draft.description.length} of ${MAX_DESCRIPTION_LENGTH} characters.`
          : `Optional. ${draft.description.length} of ${MAX_DESCRIPTION_LENGTH} characters.`
      }
      value={draft.description}
      maxLength={MAX_DESCRIPTION_LENGTH}
      onChange={(event) => onChange({ description: event.target.value })}
      error={errors.description}
    />
  );
}
