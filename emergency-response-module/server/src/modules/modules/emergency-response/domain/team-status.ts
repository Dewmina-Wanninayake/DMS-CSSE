import { InvalidStateTransitionError } from '../errors';

export enum DispatchStatus {
  Dispatched = 'Dispatched',
  EnRoute = 'EnRoute',
  OnSite = 'OnSite',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

/**
 * JOINT #6 / A5a: the allowed transitions, in one place.
 * Rescue Team Leader drives Dispatched→EnRoute→OnSite→Completed;
 * Joint Ops Lead may cancel (A4a) only before the team is on site.
 */
const ALLOWED: Readonly<Record<DispatchStatus, readonly DispatchStatus[]>> = {
  [DispatchStatus.Dispatched]: [DispatchStatus.EnRoute, DispatchStatus.Cancelled],
  [DispatchStatus.EnRoute]: [DispatchStatus.OnSite, DispatchStatus.Cancelled],
  [DispatchStatus.OnSite]: [DispatchStatus.Completed],
  [DispatchStatus.Completed]: [],
  [DispatchStatus.Cancelled]: [],
};

/** Table-driven State machine for a dispatch's team status. Pure, no I/O. */
export class TeamStatusMachine {
  allowedFrom(status: DispatchStatus): readonly DispatchStatus[] {
    return ALLOWED[status];
  }

  canTransition(from: DispatchStatus, to: DispatchStatus): boolean {
    return ALLOWED[from].includes(to);
  }

  /** @throws InvalidStateTransitionError (HTTP 409) when the move is illegal. */
  assertTransition(from: DispatchStatus, to: DispatchStatus): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to, ALLOWED[from]);
    }
  }
}
