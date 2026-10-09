import { Radio } from 'lucide-react';
import { Channel, Language, WarningLevel } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Alert, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { Select, TextArea } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StepProgress } from '../../../shared/ui/StepProgress';
import { useWarningForm } from '../hooks/useWarningForm';

/**
 * Steps 8-9: choose level, areas, language and channels, and see who will be alerted before confirming.
 * A large audience needs an explicit confirmation. The form logic is in `useWarningForm`.
 */
export function WarningPreviewPage() {
  const {
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
  } = useWarningForm();

  if (reviewLoading) return <LoadingState label="Loading report data…" />;

  return (
    <>
      <PageHeader
        title="Raise a warning"
        subtitle={`Escalating ground report #${reportId} (${review?.hazardType ?? 'Hazard'})`}
        backTo={`/verification/reports/${reportId}`}
      />
      <div className="shell__content stack stack--loose">
        <StepProgress current={2} total={3} title="Warning parameters" />

        {!navigator.onLine && (
          <OfflineBanner>
            You are currently offline. Warning will be queued locally with{' '}
            <strong>PendingSync</strong> status.
          </OfflineBanner>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid-auto grid-auto--wide">
          <Card title="Warning details">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="stack"
            >
              <Select
                label="Warning level"
                value={level}
                onChange={(e) => setLevel(e.target.value as WarningLevel)}
              >
                <option value={WarningLevel.Advisory}>Advisory (information only)</option>
                <option value={WarningLevel.Watch}>Watch (be prepared)</option>
                <option value={WarningLevel.Warning}>
                  Warning (take action; second approver needed)
                </option>
                <option value={WarningLevel.Emergency}>
                  Emergency (immediate danger; second approver needed)
                </option>
                <option value={WarningLevel.AllClear}>AllClear (hazard ended)</option>
              </Select>

              <TextArea
                label="Reason and advice for the public"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State clear reasons, affected areas, and recommended safety precautions for citizens..."
                rows={4}
              />

              <Select
                label="Message language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value={Language.Sinhala}>Sinhala</option>
                <option value={Language.Tamil}>Tamil</option>
                <option value={Language.English}>English</option>
              </Select>

              <fieldset className="fieldset">
                <legend className="legend-gap">Notification channels</legend>
                <div className="row row--loose">
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

              <div className="divider-top pt-4">
                <Button type="submit" loading={isSubmitting || previewLoading}>
                  {preview?.requiresApproval ? 'Send for second approval' : 'Issue warning'}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Audience and approval rule">
            {previewLoading ? (
              <LoadingState label="Calculating audience size…" />
            ) : preview ? (
              <div className="stack">
                <div className="alert alert--info alert--block">
                  <div className="row row--tight strong text-body mb-1">
                    <Radio size={20} />
                    <span>Estimated Target Audience:</span>
                  </div>
                  <div className="figure">
                    {preview.estimatedAudience.toLocaleString()} citizens
                  </div>
                  <p className="caption mt-1 flush-x">
                    Targeting district: {preview.districts.map((d) => d.name).join(', ')}
                  </p>
                </div>

                {preview.requiresApproval && (
                  <div className="alert alert--warning caption">
                    <strong>Second approver required:</strong> Warnings of level '{level}' require
                    authorization from a Second Approver before final broadcast.
                  </div>
                )}

                {preview.requiresAudienceConfirm && (
                  <div className="alert alert--info caption">
                    <strong>Large Audience Check (Interaction #2):</strong> Audience size exceeds
                    10,000 citizens. Confirmation will be required upon submission.
                  </div>
                )}

                {preview.warningCriteria && (
                  <div className="caption muted divider-top pt-3">
                    <strong>Active Policy Thresholds:</strong> Hazard risk threshold{' '}
                    {preview.warningCriteria.riskThreshold}
                  </div>
                )}
              </div>
            ) : (
              <p className="muted flush">
                Select target parameters to preview estimated broadcast audience.
              </p>
            )}
          </Card>
        </div>

        {showAudienceConfirm && preview && (
          <ConfirmDialog
            title="Confirm large audience"
            confirmLabel="Yes, send the warning"
            cancelLabel="Cancel"
            onConfirm={() => {
              setShowAudienceConfirm(false);
              void handleSubmit(true);
            }}
            onCancel={() => setShowAudienceConfirm(false)}
          >
            <p>{`Are you sure you want to broadcast this '${level}' warning to an estimated ${preview.estimatedAudience.toLocaleString()} people across ${preview.districts.map((d) => d.name).join(', ')}?`}</p>
          </ConfirmDialog>
        )}
      </div>
    </>
  );
}
