import { LEVELS_REQUIRING_APPROVAL, WarningStatus, type WarningLevel } from '@dms/shared';
import { InvalidStateError } from '../../../core/http/errors';

const ALLOWED: Record<WarningStatus, readonly WarningStatus[]> = {
  [WarningStatus.Draft]: [WarningStatus.Issued, WarningStatus.PendingApproval],
  [WarningStatus.PendingApproval]: [WarningStatus.Issued, WarningStatus.Withdrawn],
  [WarningStatus.Issued]: [WarningStatus.Corrected, WarningStatus.Withdrawn],
  [WarningStatus.Corrected]: [WarningStatus.Corrected, WarningStatus.Withdrawn],
  [WarningStatus.Withdrawn]: [],
};

export function requiresSecondApproval(level: WarningLevel): boolean {
  return (LEVELS_REQUIRING_APPROVAL as readonly string[]).includes(level);
}

export function initialStatus(level: WarningLevel, pendingSync: boolean): WarningStatus {
  if (pendingSync) return WarningStatus.Draft;
  return requiresSecondApproval(level) ? WarningStatus.PendingApproval : WarningStatus.Issued;
}

export function assertTransition(from: WarningStatus, to: WarningStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new InvalidStateError(`A warning that is ${from} cannot become ${to}.`);
  }
}
