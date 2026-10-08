import type { PolicyRecord } from '../repositories/policy.repository';

/** Notification texts for the policy workflow (steps 9, 12 and extension 10a). */

export const POLICY_NOTIFICATION_TYPE = 'Policy';

const label = (policy: PolicyRecord): string =>
  `${policy.policyKey} v${policy.version} "${policy.title}"`;

export function submittedMessage(policy: PolicyRecord, authorName: string) {
  return {
    subject: `Policy awaiting approval: ${label(policy)}`,
    body: `${authorName} submitted ${label(policy)} for your approval.`,
  };
}

export function publishedMessage(policy: PolicyRecord) {
  return {
    subject: `New policy published: ${label(policy)}`,
    body: `${label(policy)} is now in force${policy.effectiveDate ? ` from ${policy.effectiveDate}` : ''}.`,
  };
}

export function rejectedMessage(policy: PolicyRecord, comments: string) {
  return {
    subject: `Policy rejected: ${label(policy)}`,
    body: `The Policy Director rejected ${label(policy)}. Comments: ${comments}`,
  };
}
