import { describe, expect, it } from 'vitest';
import { WarningLevel, WarningStatus } from '@dms/shared';
import {
  assertTransition,
  initialStatus,
  requiresSecondApproval,
} from '../domain/warning-state-machine';

describe('warning-state-machine', () => {
  it('7a: should require second approval for Warning and Emergency levels', () => {
    expect(requiresSecondApproval(WarningLevel.Warning)).toBe(true);
    expect(requiresSecondApproval(WarningLevel.Emergency)).toBe(true);
    expect(requiresSecondApproval(WarningLevel.Advisory)).toBe(false);
    expect(requiresSecondApproval(WarningLevel.Watch)).toBe(false);
    expect(requiresSecondApproval(WarningLevel.AllClear)).toBe(false);
  });

  it('7b: should set initial status to PendingApproval for Warning level', () => {
    expect(initialStatus(WarningLevel.Warning, false)).toBe(WarningStatus.PendingApproval);
    expect(initialStatus(WarningLevel.Emergency, false)).toBe(WarningStatus.PendingApproval);
  });

  it('7c: should set initial status to Issued for Advisory level when synced', () => {
    expect(initialStatus(WarningLevel.Advisory, false)).toBe(WarningStatus.Issued);
  });

  it('7d: should keep initial status as Draft if pending sync', () => {
    expect(initialStatus(WarningLevel.Warning, true)).toBe(WarningStatus.Draft);
    expect(initialStatus(WarningLevel.Advisory, true)).toBe(WarningStatus.Draft);
  });

  it('7e: should allow valid transitions', () => {
    expect(() =>
      assertTransition(WarningStatus.PendingApproval, WarningStatus.Issued),
    ).not.toThrow();
    expect(() => assertTransition(WarningStatus.Issued, WarningStatus.Corrected)).not.toThrow();
    expect(() => assertTransition(WarningStatus.Issued, WarningStatus.Withdrawn)).not.toThrow();
  });

  it('7f: should throw InvalidStateError for invalid transitions', () => {
    expect(() => assertTransition(WarningStatus.Withdrawn, WarningStatus.Issued)).toThrow();
  });
});
