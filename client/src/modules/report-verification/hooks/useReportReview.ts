import { useCallback, useEffect, useState } from 'react';
import type { DecisionRequest, ReportReview } from '@dms/shared';
import { reportVerificationApi } from '../api/report-verification.api';

/** Loads one report with its decision support and saves the officer's decision. `submitDecision` rethrows so the form can show the server's reason. */
export function useReportReview(id: number) {
  const [review, setReview] = useState<ReportReview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await reportVerificationApi.getReportReview(id);
      setReview(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const submitDecision = async (input: DecisionRequest) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await reportVerificationApi.submitDecision(id, input);
      setReview(updated);
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save decision.';
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (id) void fetchReview();
  }, [id, fetchReview]);

  return { review, isLoading, isSubmitting, error, refresh: fetchReview, submitDecision };
}
