import { PolicyStatus } from '@dms/shared';
import { InvalidStateError } from '../../../core/http/errors';

/**
 * State pattern for the policy lifecycle (revised class diagram, Table 13 `PolicyStatus`):
 * Draft → PendingApproval → Approved | Rejected. A rejected policy is never edited in place;
 * revising it creates a new version (extension 10a), so Approved and Rejected are terminal.
 */
const ALLOWED: Record<PolicyStatus, readonly PolicyStatus[]> = {
  [PolicyStatus.Draft]: [PolicyStatus.PendingApproval],
  [PolicyStatus.PendingApproval]: [PolicyStatus.Approved, PolicyStatus.Rejected],
  [PolicyStatus.Approved]: [],
  [PolicyStatus.Rejected]: [],
};

export function canTransition(from: PolicyStatus, to: PolicyStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: PolicyStatus, to: PolicyStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidStateError(`A policy that is ${from} cannot become ${to}.`);
  }
}

export function isEditable(status: PolicyStatus): boolean {
  return status === PolicyStatus.Draft;
}
