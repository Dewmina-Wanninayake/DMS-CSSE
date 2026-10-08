import { POLICY_LIMITS, type PolicyContentInput } from '@dms/shared';
import { TextArea, TextInput } from '../../../shared/ui/fields';

/** String-valued form state; converted to `PolicyContentInput` when saving. */
export interface PolicyFormValues {
  title: string;
  description: string;
  proposedEffectiveDate: string;
  mitigationStrategies: string;
  landUseGuidelines: string;
  resourceRules: string;
  warningRiskThreshold: string;
}

export const EMPTY_POLICY_FORM: PolicyFormValues = {
  title: '',
  description: '',
  proposedEffectiveDate: '',
  mitigationStrategies: '',
  landUseGuidelines: '',
  resourceRules: '',
  warningRiskThreshold: '',
};

export function toContent(form: PolicyFormValues): PolicyContentInput {
  const threshold = form.warningRiskThreshold.trim();
  return {
    title: form.title.trim(),
    description: form.description,
    mitigationStrategies: form.mitigationStrategies,
    landUseGuidelines: form.landUseGuidelines,
    resourceRules: form.resourceRules,
    warningRiskThreshold: threshold === '' ? null : Number(threshold),
    proposedEffectiveDate: form.proposedEffectiveDate === '' ? null : form.proposedEffectiveDate,
  };
}

export function toFormValues(content: PolicyContentInput): PolicyFormValues {
  return {
    title: content.title,
    description: content.description,
    proposedEffectiveDate: content.proposedEffectiveDate ?? '',
    mitigationStrategies: content.mitigationStrategies,
    landUseGuidelines: content.landUseGuidelines,
    resourceRules: content.resourceRules,
    warningRiskThreshold:
      content.warningRiskThreshold === null ? '' : String(content.warningRiskThreshold),
  };
}

/** Client-side checks for step 1 (the server repeats them). Returns field → message. */
export function validateDetail(form: PolicyFormValues, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const title = form.title.trim();
  if (title.length < POLICY_LIMITS.titleMin) {
    errors.title = `Enter a title of at least ${POLICY_LIMITS.titleMin} characters.`;
  } else if (title.length > POLICY_LIMITS.titleMax) {
    errors.title = `Use at most ${POLICY_LIMITS.titleMax} characters.`;
  }
  if (form.description.length > POLICY_LIMITS.descriptionMax) {
    errors.description = `Use at most ${POLICY_LIMITS.descriptionMax} characters.`;
  }
  if (form.proposedEffectiveDate && form.proposedEffectiveDate < today) {
    errors.proposedEffectiveDate = 'Choose today or a later date.';
  }
  return errors;
}

interface StepProps {
  values: PolicyFormValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<PolicyFormValues>) => void;
  today: string;
}

/** Step 1 — "Policy detail" (hi-fi: description and date). */
export function PolicyDetailStep({ values, errors, onChange, today }: StepProps) {
  return (
    <div className="card stack">
      <TextInput
        label="Policy title"
        value={values.title}
        maxLength={POLICY_LIMITS.titleMax}
        onChange={(e) => onChange({ title: e.target.value })}
        error={errors.title}
      />
      <TextArea
        label="Description"
        placeholder="Describe what the policy is for and what it changes."
        value={values.description}
        maxLength={POLICY_LIMITS.descriptionMax}
        onChange={(e) => onChange({ description: e.target.value })}
        error={errors.description}
        hint={`${values.description.length} / ${POLICY_LIMITS.descriptionMax}`}
      />
      <TextInput
        label="Proposed effective date"
        type="date"
        min={today}
        value={values.proposedEffectiveDate}
        onChange={(e) => onChange({ proposedEffectiveDate: e.target.value })}
        error={errors.proposedEffectiveDate}
        hint="Optional. The Policy Director confirms the final date when approving."
      />
    </div>
  );
}

/** Step 2 — measures (low-fi "policy drafting": mitigation measures, deployment strategy). */
export function PolicyMeasuresStep({ values, errors, onChange }: Omit<StepProps, 'today'>) {
  return (
    <div className="card stack">
      <TextArea
        label="Mitigation strategies"
        value={values.mitigationStrategies}
        maxLength={POLICY_LIMITS.sectionMax}
        onChange={(e) => onChange({ mitigationStrategies: e.target.value })}
        error={errors.mitigationStrategies}
      />
      <TextArea
        label="Land-use guidelines"
        value={values.landUseGuidelines}
        maxLength={POLICY_LIMITS.sectionMax}
        onChange={(e) => onChange({ landUseGuidelines: e.target.value })}
        error={errors.landUseGuidelines}
      />
      <TextArea
        label="Emergency resource allocation rules"
        value={values.resourceRules}
        maxLength={POLICY_LIMITS.sectionMax}
        onChange={(e) => onChange({ resourceRules: e.target.value })}
        error={errors.resourceRules}
      />
      <TextInput
        label="Warning threshold (verified reports per district)"
        type="number"
        min={1}
        step="any"
        value={values.warningRiskThreshold}
        onChange={(e) => onChange({ warningRiskThreshold: e.target.value })}
        error={errors.warningRiskThreshold}
        hint="Optional. Once approved, Duty Officers' decision support and the risk rule use this value for the hazard type."
      />
    </div>
  );
}
