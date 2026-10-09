import { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkError } from '../../../shared/api/api-client';
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import {
  loadPendingDrafts,
  markPendingConflicts,
  removePendingDrafts,
  savePendingDraft,
  type PendingDraft,
} from '../lib/pending-drafts';

export interface SyncSummary {
  uploaded: number;
  conflicts: number;
}

interface Options {
  /** Signed-in analyst: only their drafts are listed and synced. */
  ownerId: number;
  /** Called after a sync uploaded at least one draft (e.g. to reload a list). */
  onSynced?: (summary: SyncSummary) => void;
}

/**
 * Keeps locally saved drafts and uploads them as soon as the browser is online again
 * (UC-DA-001 extension 9a). The server de-duplicates by `clientId`, so retrying is always safe.
 */
export function usePendingDrafts({ ownerId, onSynced }: Options) {
  const online = useOnlineStatus();
  const [drafts, setDrafts] = useState<PendingDraft[]>(() => loadPendingDrafts(ownerId));
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary>();
  const [syncError, setSyncError] = useState<string>();
  const running = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refresh = useCallback(() => setDrafts(loadPendingDrafts(ownerId)), [ownerId]);

  const saveLocal = useCallback(
    (draft: PendingDraft): boolean => {
      const saved = savePendingDraft(draft);
      refresh();
      return saved;
    },
    [refresh],
  );

  const syncNow = useCallback(async () => {
    const pending = loadPendingDrafts(ownerId);
    if (running.current || pending.length === 0) return;
    running.current = true;
    setSyncing(true);
    setSyncError(undefined);
    try {
      const results = await policyAnalyticsApi.syncDrafts(
        pending.map(({ savedAt: _s, conflictMessage: _m, ownerId: _o, ...input }) => input),
      );
      const done = results.filter((r) => r.outcome !== 'Conflict').map((r) => r.clientId);
      const conflicts = Object.fromEntries(
        results
          .filter((r) => r.outcome === 'Conflict')
          .map((r) => [r.clientId, r.message ?? 'Rejected']),
      );
      removePendingDrafts(done);
      markPendingConflicts(conflicts);
      const result = { uploaded: done.length, conflicts: Object.keys(conflicts).length };
      setSummary(result);
      if (result.uploaded > 0) onSyncedRef.current?.(result);
    } catch (error) {
      // Being offline is expected (try again later); anything else is shown to the analyst.
      if (!(error instanceof NetworkError)) {
        setSyncError(error instanceof Error ? error.message : 'Synchronisation failed.');
      }
    } finally {
      running.current = false;
      setSyncing(false);
      refresh();
    }
  }, [ownerId, refresh]);

  useEffect(() => {
    if (online) void syncNow();
  }, [online, syncNow]);

  return { drafts, online, syncing, summary, syncError, saveLocal, syncNow };
}
