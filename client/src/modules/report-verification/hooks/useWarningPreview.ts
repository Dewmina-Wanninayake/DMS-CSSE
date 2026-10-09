import { useCallback, useState } from 'react';
import type { WarningPreview, WarningPreviewRequest } from '@dms/shared';
import { reportVerificationApi } from '../api/report-verification.api';

/** Audience size and approval rule for the current level, areas and channels, shown before the officer confirms (Interaction #2). */
export function useWarningPreview() {
  const [preview, setPreview] = useState<WarningPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async (input: WarningPreviewRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportVerificationApi.previewWarning(input);
      setPreview(data);
      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to calculate warning preview.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { preview, isLoading, error, fetchPreview };
}
