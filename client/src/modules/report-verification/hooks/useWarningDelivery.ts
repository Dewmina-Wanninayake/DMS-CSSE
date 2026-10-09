import { useCallback, useEffect, useState } from 'react';
import type { WarningDelivery } from '@dms/shared';
import { reportVerificationApi } from '../api/report-verification.api';

/** Per-channel delivery log of a warning. Failed sends are retried by the server, so this only needs to re-read the log. */
export function useWarningDelivery(warningId: number) {
  const [delivery, setDelivery] = useState<WarningDelivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelivery = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportVerificationApi.getWarningDelivery(warningId);
      setDelivery(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch warning delivery log.');
    } finally {
      setIsLoading(false);
    }
  }, [warningId]);

  useEffect(() => {
    if (warningId) void fetchDelivery();
  }, [warningId, fetchDelivery]);

  return { delivery, isLoading, error, refresh: fetchDelivery };
}
