import { LEVELS_REQUIRING_APPROVAL, WarningStatus, type WarningLevel } from '@dms/shared';
import { InvalidStateError } from '../../../core/http/errors';

const ALLOWED: Record<WarningStatus, readonly WarningStatus[]> = {
  [WarningStatus.Draft]: [WarningStatus.Issued, WarningStatus.PendingApproval],
  [WarningStatus.PendingApproval]: [WarningStatus.Issued, WarningStatus.Withdrawn],
  [WarningStatus.Issued]: [WarningStatus.Corrected, WarningStatus.Withdrawn],
  [WarningStatus.Corrected]: [WarningStatus.Corrected, WarningStatus.Withdrawn],
  [WarningStatus.Withdrawn]: [],
};

/** Only the two highest levels reach many people at once, so only they wait for a Second Approver (DIST-02 #7). */
export function requiresSecondApproval(level: WarningLevel): boolean {
  return (LEVELS_REQUIRING_APPROVAL as readonly string[]).includes(level);
}

/** A warning saved while offline stays a Draft until it is flushed; otherwise the level decides whether it waits for approval. */
export function initialStatus(level: WarningLevel, pendingSync: boolean): WarningStatus {
  if (pendingSync) return WarningStatus.Draft;
  return requiresSecondApproval(level) ? WarningStatus.PendingApproval : WarningStatus.Issued;
}

/** @throws InvalidStateError (409) when the move is not in the table above. */
export function assertTransition(from: WarningStatus, to: WarningStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidStateError(`A warning that is ${from} cannot become ${to}.`);
  }
}
