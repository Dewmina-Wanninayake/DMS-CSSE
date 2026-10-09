import { describe, expect, it } from 'vitest';
import { DispatchStatus, TeamStatusMachine } from '../domain/team-status';
import { InvalidStateTransitionError } from '../errors';

const S = DispatchStatus;
const LEGAL: [DispatchStatus, DispatchStatus][] = [
  [S.Dispatched, S.EnRoute],
  [S.Dispatched, S.Cancelled],
  [S.EnRoute, S.OnSite],
  [S.EnRoute, S.Cancelled],
  [S.OnSite, S.Completed],
];
const ALL = Object.values(S);

describe('TeamStatusMachine', () => {
  const machine = new TeamStatusMachine();

  it.each(LEGAL)('A5: allows %s → %s', (from, to) => {
    expect(machine.canTransition(from, to)).toBe(true);
    expect(() => machine.assertTransition(from, to)).not.toThrow();
  });

  const illegal = ALL.flatMap((from) => ALL.map((to) => [from, to] as const)).filter(
    ([from, to]) => !LEGAL.some(([f, t]) => f === from && t === to),
  );

  it.each(illegal)('A5a: rejects %s → %s with INVALID_STATE_TRANSITION (409)', (from, to) => {
    expect(machine.canTransition(from, to)).toBe(false);
    expect(() => machine.assertTransition(from, to)).toThrow(InvalidStateTransitionError);
  });

  it('A5a: error names the allowed next states', () => {
    try {
      machine.assertTransition(S.Dispatched, S.Completed);
      expect.unreachable();
    } catch (e) {
      const err = e as InvalidStateTransitionError;
      expect(err.status).toBe(409);
      expect(err.details).toEqual({ from: 'Dispatched', to: 'Completed', allowed: ['EnRoute', 'Cancelled'] });
    }
  });

  it('terminal states have no way out', () => {
    expect(machine.allowedFrom(S.Completed)).toEqual([]);
    expect(machine.allowedFrom(S.Cancelled)).toEqual([]);
  });
});
