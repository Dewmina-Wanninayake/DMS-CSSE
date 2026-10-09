import { useEffect, useState } from 'react';
import type { WarningDelivery } from '@dms/shared';
import { reportVerificationApi } from '../api/reportVerificationApi';

export function useWarningDelivery(warningId: number) {
  const [delivery, setDelivery] = useState<WarningDelivery | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDelivery = async () => {
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
  };

  useEffect(() => {
    if (warningId) void fetchDelivery();
  }, [warningId]);

  return { delivery, isLoading, error, refresh: fetchDelivery };
}
