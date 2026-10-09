import { useEffect, useState } from 'react';
import type { VerificationQueue } from '@dms/shared';
import { reportVerificationApi } from '../api/reportVerificationApi';

export function useVerificationQueue() {
  const [queue, setQueue] = useState<VerificationQueue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportVerificationApi.getQueue();
      setQueue(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch verification queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, []);

  return { queue, isLoading, error, refresh: fetchQueue };
}
