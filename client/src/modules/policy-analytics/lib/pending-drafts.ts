import type { PolicyDraftInput } from '@dms/shared';

/**
 * Extension 9a: drafts written while the server is unreachable stay on the device as
 * "Pending Sync" and are uploaded when the connection returns. Storage may be blocked or full
 * (private windows), so every access is guarded and failures report `false` instead of throwing.
 */

const STORAGE_KEY = 'dms.policyAnalytics.pendingDrafts';

export interface PendingDraft extends PolicyDraftInput {
  clientId: string;
  /** The analyst who wrote it; a draft is only ever shown to and synced by its owner. */
  ownerId: number;
  savedAt: string;
  /** Set when the server refused the draft on sync, so the analyst can see why it is stuck. */
  conflictMessage?: string;
}

function loadAll(): PendingDraft[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingDraft[]) : [];
  } catch {
    return [];
  }
}

export function loadPendingDrafts(ownerId: number): PendingDraft[] {
  return loadAll().filter((d) => d.ownerId === ownerId);
}

function persist(drafts: PendingDraft[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

/** Inserts or replaces the draft with the same `clientId`. */
export function savePendingDraft(draft: PendingDraft): boolean {
  const others = loadAll().filter((d) => d.clientId !== draft.clientId);
  return persist([...others, draft]);
}

export function removePendingDrafts(clientIds: string[]): void {
  persist(loadAll().filter((d) => !clientIds.includes(d.clientId)));
}

export function markPendingConflicts(conflicts: Record<string, string>): void {
  persist(
    loadAll().map((d) =>
      conflicts[d.clientId] ? { ...d, conflictMessage: conflicts[d.clientId] } : d,
    ),
  );
}
