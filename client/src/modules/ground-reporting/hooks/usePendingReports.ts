import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReportSyncResultItem, SubmitReportInput } from '@dms/shared';
import { NetworkError } from '../../../shared/api/api-client';
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { groundReportingApi } from '../api/ground-reporting.api';
import { dataUrlToBlob } from '../lib/photo';
import {
  loadPendingReports,
  markPendingConflicts,
  removePendingReports,
  savePendingReport,
  type PendingReport,
} from '../lib/pending-reports';

export interface SyncSummary {
  uploaded: number;
  conflicts: number;
  /** Reports that were stored but whose photo could not be uploaded. */
  photosFailed: number;
}

interface Options {
  /** Signed-in reporter: only their reports are listed and synced. */
  ownerId: number;
  /** Called after a sync uploaded at least one report (e.g. to reload My Reports). */
  onSynced?: (summary: SyncSummary) => void;
}

const toInput = ({
  clientId,
  hazardType,
  description,
  latitude,
  longitude,
  locationSource,
  reportedAt,
}: PendingReport): SubmitReportInput & { clientId: string } => ({
  clientId,
  hazardType,
  description,
  latitude,
  longitude,
  locationSource,
  reportedAt,
});

const problemOf = (result: ReportSyncResultItem): string =>
  result.errors?.map((error) => error.message).join(' ') ||
  (result.outcome === 'Conflict'
    ? 'This report belongs to another account.'
    : 'The server could not accept this report.');

/**
 * Keeps offline reports and uploads them, oldest first, as soon as the device is online again
 * (UC-CV-003 extension 9b). The server de-duplicates by `clientId`, so retrying is always safe.
 */
export function usePendingReports({ ownerId, onSynced }: Options) {
  const online = useOnlineStatus();
  const [reports, setReports] = useState<PendingReport[]>(() => loadPendingReports(ownerId));
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary>();
  const [syncError, setSyncError] = useState<string>();
  const running = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refresh = useCallback(() => setReports(loadPendingReports(ownerId)), [ownerId]);

  const saveLocal = useCallback(
    (report: PendingReport): boolean => {
      const saved = savePendingReport(report);
      refresh();
      return saved;
    },
    [refresh],
  );

  const syncNow = useCallback(async () => {
    const pending = loadPendingReports(ownerId).filter((report) => !report.conflictMessage);
    if (running.current || pending.length === 0) return;
    running.current = true;
    setSyncing(true);
    setSyncError(undefined);
    try {
      const results = await groundReportingApi.sync(pending.map(toInput));
      const byId = new Map(pending.map((report) => [report.clientId, report]));
      const stored = results.filter((r) => r.outcome === 'Created' || r.outcome === 'Existing');
      const rejected = results.filter((r) => r.outcome === 'Invalid' || r.outcome === 'Conflict');

      let photosFailed = 0;
      for (const result of stored) {
        const photo = byId.get(result.clientId)?.photo;
        if (result.outcome === 'Created' && photo && result.report) {
          try {
            await groundReportingApi.uploadPhoto(result.report.id, dataUrlToBlob(photo.dataUrl));
          } catch {
            photosFailed += 1;
          }
        }
      }

      removePendingReports(stored.map((r) => r.clientId));
      markPendingConflicts(Object.fromEntries(rejected.map((r) => [r.clientId, problemOf(r)])));
      const result = { uploaded: stored.length, conflicts: rejected.length, photosFailed };
      setSummary(result);
      if (result.uploaded > 0) onSyncedRef.current?.(result);
    } catch (error) {
      // Being offline is expected (try again later); anything else is shown to the reporter.
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

  return { reports, online, syncing, summary, syncError, saveLocal, syncNow };
}
