import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, ApiError } from '../../../shared/api/api-client';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import {
  loadPendingDrafts,
  markPendingConflicts,
  removePendingDrafts,
  savePendingDraft,
  type PendingDraft,
} from '../lib/pending-drafts';
import { usePendingDrafts } from '../hooks/usePendingDrafts';

vi.mock('../api/policy-analytics.api');

const draft = (overrides: Partial<PendingDraft> = {}): PendingDraft => ({
  clientId: 'c1',
  ownerId: 1,
  savedAt: '2026-10-09T08:00:00.000Z',
  trendReportId: 5,
  title: 'Offline policy',
  description: 'd',
  mitigationStrategies: 'm',
  landUseGuidelines: '',
  resourceRules: '',
  warningRiskThreshold: null,
  proposedEffectiveDate: null,
  ...overrides,
});

describe('pending draft store (extension 9a)', () => {
  it('should save, replace by client id and list only the owner’s drafts', () => {
    expect(savePendingDraft(draft())).toBe(true);
    savePendingDraft(draft({ title: 'Edited' }));
    savePendingDraft(draft({ clientId: 'c2', ownerId: 2 }));
    expect(loadPendingDrafts(1).map((d) => d.title)).toEqual(['Edited']);
    expect(loadPendingDrafts(2)).toHaveLength(1);
  });

  it('should remove drafts and mark sync conflicts', () => {
    savePendingDraft(draft());
    savePendingDraft(draft({ clientId: 'c2' }));
    markPendingConflicts({ c2: 'Trend report not found' });
    expect(loadPendingDrafts(1).find((d) => d.clientId === 'c2')?.conflictMessage).toBe(
      'Trend report not found',
    );
    removePendingDrafts(['c1']);
    expect(loadPendingDrafts(1).map((d) => d.clientId)).toEqual(['c2']);
  });

  it('should treat corrupt or non-array storage as empty', () => {
    window.localStorage.setItem('dms.policyAnalytics.pendingDrafts', '{not json');
    expect(loadPendingDrafts(1)).toEqual([]);
    window.localStorage.setItem('dms.policyAnalytics.pendingDrafts', '{"a":1}');
    expect(loadPendingDrafts(1)).toEqual([]);
  });

  it('should report false instead of throwing when storage is full or blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(savePendingDraft(draft())).toBe(false);
    spy.mockRestore();
  });
});

describe('usePendingDrafts', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('should not call the server when nothing is pending', async () => {
    renderHook(() => usePendingDrafts({ ownerId: 1 }));
    await Promise.resolve();
    expect(policyAnalyticsApi.syncDrafts).not.toHaveBeenCalled();
  });

  it('should upload pending drafts when online, strip local fields and clear them', async () => {
    savePendingDraft(draft());
    vi.mocked(policyAnalyticsApi.syncDrafts).mockResolvedValue([
      { clientId: 'c1', outcome: 'Created', policyId: 9 },
    ]);
    const onSynced = vi.fn();

    const { result } = renderHook(() => usePendingDrafts({ ownerId: 1, onSynced }));

    await waitFor(() => expect(result.current.drafts).toEqual([]));
    const sent = vi.mocked(policyAnalyticsApi.syncDrafts).mock.calls[0]?.[0][0];
    expect(sent).toMatchObject({ clientId: 'c1', title: 'Offline policy' });
    expect(sent).not.toHaveProperty('ownerId');
    expect(sent).not.toHaveProperty('savedAt');
    expect(result.current.summary).toEqual({ uploaded: 1, conflicts: 0 });
    expect(onSynced).toHaveBeenCalledWith({ uploaded: 1, conflicts: 0 });
  });

  it('should keep rejected drafts and show why', async () => {
    savePendingDraft(draft());
    vi.mocked(policyAnalyticsApi.syncDrafts).mockResolvedValue([
      {
        clientId: 'c1',
        outcome: 'Conflict',
        policyId: null,
        message: 'Trend report was not found.',
      },
    ]);
    const { result } = renderHook(() => usePendingDrafts({ ownerId: 1 }));
    await waitFor(() => expect(result.current.summary).toEqual({ uploaded: 0, conflicts: 1 }));
    expect(result.current.drafts[0]?.conflictMessage).toBe('Trend report was not found.');
  });

  it('should stay quiet and keep the drafts while the server is unreachable', async () => {
    savePendingDraft(draft());
    vi.mocked(policyAnalyticsApi.syncDrafts).mockRejectedValue(new NetworkError());
    const { result } = renderHook(() => usePendingDrafts({ ownerId: 1 }));
    await waitFor(() => expect(policyAnalyticsApi.syncDrafts).toHaveBeenCalled());
    await waitFor(() => expect(result.current.syncing).toBe(false));
    expect(result.current.drafts).toHaveLength(1);
    expect(result.current.syncError).toBeUndefined();
  });

  it('should surface a server error and let the analyst retry with syncNow', async () => {
    savePendingDraft(draft());
    vi.mocked(policyAnalyticsApi.syncDrafts)
      .mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Not allowed'))
      .mockResolvedValueOnce([{ clientId: 'c1', outcome: 'Existing', policyId: 9 }]);
    const { result } = renderHook(() => usePendingDrafts({ ownerId: 1 }));
    await waitFor(() => expect(result.current.syncError).toBe('Not allowed'));

    await act(async () => result.current.syncNow());
    await waitFor(() => expect(result.current.drafts).toEqual([]));
    expect(result.current.syncError).toBeUndefined();
  });

  it('should store a new draft locally and expose it', () => {
    const { result } = renderHook(() => usePendingDrafts({ ownerId: 1 }));
    let saved = false;
    act(() => {
      saved = result.current.saveLocal(draft({ clientId: 'new' }));
    });
    expect(saved).toBe(true);
    expect(result.current.drafts.map((d) => d.clientId)).toEqual(['new']);
  });

  it('should not sync another user’s drafts', async () => {
    savePendingDraft(draft({ ownerId: 2 }));
    renderHook(() => usePendingDrafts({ ownerId: 1 }));
    await Promise.resolve();
    expect(policyAnalyticsApi.syncDrafts).not.toHaveBeenCalled();
  });
});
