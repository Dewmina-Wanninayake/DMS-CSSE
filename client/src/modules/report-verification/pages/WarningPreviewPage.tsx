import { AlertTriangle, ArrowLeft, Radio, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Channel,
  Language,
  VERIFICATION_LIMITS,
  WarningLevel,
  type WarningPreview,
} from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Alert, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { Select, Textarea } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StepProgress } from '../../../shared/ui/StepProgress';
import { reportVerificationApi } from '../api/reportVerificationApi';
import { useReportReview } from '../hooks/useReportReview';
import { useWarningPreview } from '../hooks/useWarningPreview';

export function WarningPreviewPage() {
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
    if (review && areaIds.length === 0) {
      setAreaIds([review.districtId]);
    }
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
  }, [reportId, level, areaIds, language, channels]);

  if (reviewLoading) return <LoadingState label="Loading report data..." />;

  const toggleChannel = (ch: Channel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Link to={`/verification/reports/${reportId}`}>
          <Button variant="secondary" size="sm" icon={ArrowLeft}>
            Back to Report
          </Button>
        </Link>
        <PageHeader
          title="Escalate Warning & Audience Preview"
          subtitle={`Escalating ground report #${reportId} (${review?.hazardType ?? 'Hazard'})`}
        />
      </div>

      <StepProgress
        steps={[
          { label: 'Ground Verification', status: 'complete' },
          { label: 'Warning Parameters', status: 'current' },
          { label: 'Channel Delivery', status: 'upcoming' },
        ]}
      />

      {!navigator.onLine && (
        <OfflineBanner>
          You are currently offline. Warning will be queued locally with <strong>PendingSync</strong> status.
        </OfflineBanner>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <Card title="Warning Configuration Parameters" icon={AlertTriangle}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            <Select
              label="Warning Severity Level"
              value={level}
              onChange={(e) => setLevel(e.target.value as WarningLevel)}
              options={[
                { value: WarningLevel.Advisory, label: 'Advisory (Information only)' },
                { value: WarningLevel.Watch, label: 'Watch (Be prepared)' },
                { value: WarningLevel.Warning, label: 'Warning (Take action - Second Approver needed)' },
                { value: WarningLevel.Emergency, label: 'Emergency (Immediate danger - Second Approver needed)' },
                { value: WarningLevel.AllClear, label: 'AllClear (Hazard ended)' },
              ]}
            />

            <Textarea
              label="Public Warning Reason & Directives"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear reasons, affected areas, and recommended safety precautions for citizens..."
              rows={4}
            />

            <Select
              label="Primary Notification Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              options={[
                { value: Language.Sinhala, label: 'Sinhala' },
                { value: Language.Tamil, label: 'Tamil' },
                { value: Language.English, label: 'English' },
              ]}
            />

            <fieldset className="fieldset">
              <legend style={{ marginBottom: 'var(--space-2)' }}>Notification Broadcast Channels</legend>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {(['Push', 'SMS', 'AudibleAlert'] as Channel[]).map((ch) => (
                  <label key={ch} className="choice">
                    <input
                      type="checkbox"
                      checked={channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                    />
                    <span>{ch}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
              <Button type="submit" loading={isSubmitting || previewLoading}>
                {preview?.requiresApproval
                  ? 'Submit for Second Approval'
                  : 'Issue & Broadcast Warning'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Estimated Audience & Rules Preview" icon={Users}>
          {previewLoading ? (
            <LoadingState label="Calculating audience size..." />
          ) : preview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="alert alert--info" style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600, fontSize: 'var(--text-body)', marginBottom: 'var(--space-1)' }}>
                  <Radio size={20} />
                  <span>Estimated Target Audience:</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {preview.estimatedAudience.toLocaleString()} citizens
                </div>
                <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-caption)' }}>
                  Targeting district: {preview.districts.map((d) => d.name).join(', ')}
                </p>
              </div>

              {preview.requiresApproval && (
                <div className="alert alert--warning" style={{ fontSize: 'var(--text-caption)' }}>
                  <strong>Second Approver Required (DIST-02 #7):</strong> Warnings of level '{level}' require authorization from a Second Approver before final broadcast.
                </div>
              )}

              {preview.requiresAudienceConfirm && (
                <div className="alert alert--info" style={{ fontSize: 'var(--text-caption)' }}>
                  <strong>Large Audience Check (Interaction #2):</strong> Audience size exceeds 10,000 citizens. Confirmation will be required upon submission.
                </div>
              )}

              {preview.warningCriteria && (
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                  <strong>Active Policy Thresholds:</strong> Hazard risk threshold {preview.warningCriteria.riskThreshold}
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
              Select target parameters to preview estimated broadcast audience.
            </p>
          )}
        </Card>
      </div>

      {showAudienceConfirm && preview && (
        <ConfirmDialog
          title="Confirm Large Broadcast Audience"
          message={`Are you sure you want to broadcast this '${level}' warning to an estimated ${preview.estimatedAudience.toLocaleString()} people across ${preview.districts.map((d) => d.name).join(', ')}?`}
          confirmLabel="Yes, Confirm Broadcast"
          cancelLabel="Cancel"
          onConfirm={() => {
            setShowAudienceConfirm(false);
            void handleSubmit(true);
          }}
          onCancel={() => setShowAudienceConfirm(false)}
        />
      )}
    </div>
  );
}
