import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Channel,
  Language,
  VERIFICATION_LIMITS,
  WarningLevel,
  type WarningPreview,
} from '@dms/shared';
import { reportVerificationApi } from '../api/report-verification.api';
import { useReportReview } from '../hooks/useReportReview';
import { useWarningPreview } from '../hooks/useWarningPreview';

/**
 * State and actions of the warning form (steps 8-9). The preview is recalculated whenever the level,
 * areas, language or channels change; submitting checks the reason and channels, asks for explicit
 * confirmation when the audience is large, and opens the delivery page once the warning exists.
 */
export function useWarningForm() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();

  const { review, isLoading: reviewLoading } = useReportReview(reportId);
  const { fetchPreview, isLoading: previewLoading } = useWarningPreview();

  const [level, setLevel] = useState<WarningLevel>(WarningLevel.Warning);
  const [reason, setReason] = useState<string>('');
  const [language, setLanguage] = useState<Language>(Language.Sinhala);
  const [channels, setChannels] = useState<Channel[]>([Channel.Push, Channel.SMS]);
  const [areaIds, setAreaIds] = useState<number[]>([]);

  const [preview, setPreview] = useState<WarningPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAudienceConfirm, setShowAudienceConfirm] = useState(false);

  useEffect(() => {
    // Start with the district the report came from; the officer can widen it afterwards.
    if (review) setAreaIds((current) => (current.length === 0 ? [review.districtId] : current));
  }, [review]);

  useEffect(() => {
    if (reportId && areaIds.length > 0) {
      void fetchPreview({
        reportId,
        level,
        areaIds,
        language,
        channels,
      })
        .then((res) => setPreview(res))
        .catch(() => setPreview(null));
    }
  }, [reportId, level, areaIds, language, channels, fetchPreview]);

  const toggleChannel = (ch: Channel) => {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]));
  };

  const handleSubmit = async (confirmed = false) => {
    setError(null);
    if (reason.trim().length < VERIFICATION_LIMITS.reasonMin) {
      setError(`Warning reason is required (minimum ${VERIFICATION_LIMITS.reasonMin} characters).`);
      return;
    }
    if (channels.length === 0) {
      setError('At least one notification broadcast channel must be selected.');
      return;
    }
    if (preview?.requiresAudienceConfirm && !confirmed) {
      setShowAudienceConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const isOnline = navigator.onLine;
      const created = await reportVerificationApi.createWarning({
        reportId,
        level,
        areaIds,
        reason: reason.trim(),
        language,
        channels,
        confirmedAudience: true,
        pendingSync: !isOnline,
      });
      navigate(`/warnings/${created.id}/delivery`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to issue warning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    reportId,
    review,
    reviewLoading,
    previewLoading,
    preview,
    level,
    setLevel,
    reason,
    setReason,
    language,
    setLanguage,
    channels,
    toggleChannel,
    error,
    isSubmitting,
    showAudienceConfirm,
    setShowAudienceConfirm,
    handleSubmit,
  };
}
