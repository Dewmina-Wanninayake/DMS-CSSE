import type { FieldError, PolicyContentInput } from '@dms/shared';
import { ValidationError } from '../../../core/http/errors';

const isBlank = (text: string): boolean => text.trim().length === 0;

/**
 * Step 9 "validates the document format": a draft may be saved half-written, but it can only be
 * submitted when it has a description, at least one of the three measure sections and, if given,
 * a proposed effective date that is not in the past (`today` is a `YYYY-MM-DD` day).
 */
export function assertSubmittable(content: PolicyContentInput, today: string): void {
  const problems: FieldError[] = [];
  if (content.proposedEffectiveDate !== null && content.proposedEffectiveDate < today) {
    problems.push({
      field: 'proposedEffectiveDate',
      message: 'The proposed effective date cannot be in the past.',
    });
  }
  if (isBlank(content.description)) {
    problems.push({ field: 'description', message: 'Describe the policy before submitting it.' });
  }
  const measures = [content.mitigationStrategies, content.landUseGuidelines, content.resourceRules];
  if (measures.every(isBlank)) {
    problems.push({
      field: 'mitigationStrategies',
      message: 'Enter mitigation strategies, land-use guidelines or resource rules.',
    });
  }
  if (problems.length > 0) throw new ValidationError('The policy is incomplete.', problems);
}
