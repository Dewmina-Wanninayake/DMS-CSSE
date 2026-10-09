import type { SubmitReportInput } from '@dms/shared';

/**
 * Extension 9b: a report written while the server is unreachable stays on the device as
 * `PendingSync` and is uploaded when the connection returns ("offline reports stay on the device
 * until synced", critique CV-003 #6). Storage may be blocked or full, so every access is guarded
 * and failures report `false` instead of throwing.
 */

const STORAGE_KEY = 'dms.groundReporting.pendingReports';

export interface PendingPhoto {
  /** The compressed photo as a data URL (localStorage holds strings only). */
  dataUrl: string;
  mimeType: string;
}

export interface PendingReport extends SubmitReportInput {
  clientId: string;
  /** The reporter who wrote it; a report is only ever shown to and synced by its owner. */
  ownerId: number;
  savedAt: string;
  photo?: PendingPhoto;
  /** Set when the server refused the report on sync, so the reporter can see why it is stuck. */
  conflictMessage?: string;
}

function loadAll(): PendingReport[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingReport[]) : [];
  } catch {
    return [];
  }
}

/** Oldest first, so the server records them in the order they were captured. */
export function loadPendingReports(ownerId: number): PendingReport[] {
  return loadAll()
    .filter((report) => report.ownerId === ownerId)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
}

function persist(reports: PendingReport[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    return true;
  } catch {
    return false;
  }
}

/** Inserts or replaces the report with the same `clientId`. */
export function savePendingReport(report: PendingReport): boolean {
  const others = loadAll().filter((r) => r.clientId !== report.clientId);
  return persist([...others, report]);
}

/** Called only after the server has stored the report (Created or Existing). Dropping earlier would lose the report if the upload then failed. */
export function removePendingReports(clientIds: string[]): void {
  persist(loadAll().filter((report) => !clientIds.includes(report.clientId)));
}

/** Keeps a refused report on the device with the reason, instead of retrying it forever or deleting what the reporter wrote. */
export function markPendingConflicts(conflicts: Record<string, string>): void {
  persist(
    loadAll().map((report) =>
      conflicts[report.clientId]
        ? { ...report, conflictMessage: conflicts[report.clientId] }
        : report,
    ),
  );
}
