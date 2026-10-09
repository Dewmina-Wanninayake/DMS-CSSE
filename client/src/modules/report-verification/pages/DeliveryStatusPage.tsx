import { Edit3, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CorrectionRequest } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { reportVerificationApi } from '../api/report-verification.api';
import { CorrectionModal } from '../components/CorrectionModal';
import { useWarningDelivery } from '../hooks/useWarningDelivery';

/** Step 14: delivery status per channel, with correction and withdrawal (14a). */
export function DeliveryStatusPage() {
  const { id } = useParams<{ id: string }>();
  const warningId = Number(id);
  const { delivery, isLoading, error, refresh } = useWarningDelivery(warningId);

  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading broadcast delivery logs…" />;
  if (error || !delivery)
    return <ErrorState message={error ?? 'Warning delivery not found'} onRetry={refresh} />;

  const { warning, deliveries } = delivery;

  const handleCorrection = async (input: CorrectionRequest) => {
    setActionMsg(null);
    // A refusal (for example a Second Approver is needed, 14a) is thrown to the modal and shown there.
    await reportVerificationApi.correctWarning(warningId, input);
    await refresh();
    setActionMsg(
      input.action === 'Withdraw'
        ? 'Warning has been withdrawn.'
        : 'Warning corrected successfully.',
    );
  };

  return (
    <>
      <PageHeader
        title={`Warning #${warning.id} delivery`}
        subtitle={`Level: ${warning.level} | Status: ${warning.status}`}
        backTo="/verification"
      />
      <div className="shell__content stack stack--loose">
        {actionMsg && <Alert tone="success">{actionMsg}</Alert>}

        <Card title="Warning summary">
          <div className="grid-auto">
            <dl className="summary">
              <div className="summary__row">
                <dt>Hazard type</dt>
                <dd>{warning.hazardType}</dd>
              </div>
              <div className="summary__row">
                <dt>Target areas</dt>
                <dd>{warning.areaNames.join(', ')}</dd>
              </div>
              <div className="summary__row">
                <dt>Language</dt>
                <dd>{warning.language}</dd>
              </div>
              <div className="summary__row">
                <dt>Estimated audience</dt>
                <dd>{warning.estimatedAudience.toLocaleString()} citizens</dd>
              </div>
            </dl>

            <dl className="summary">
              <div className="summary__row">
                <dt>Warning status</dt>
                <dd>
                  <StatusBadge
                    tone={
                      warning.status === 'Issued'
                        ? 'success'
                        : warning.status === 'Withdrawn'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {warning.status}
                  </StatusBadge>
                </dd>
              </div>
              <div className="summary__row">
                <dt>Sync status</dt>
                <dd>{warning.syncStatus}</dd>
              </div>
              <div className="summary__row">
                <dt>Issued at</dt>
                <dd>
                  {warning.issuedAt
                    ? new Date(warning.issuedAt).toLocaleString()
                    : 'Not issued yet'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="row divider-top mt-4 pt-4">
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={() => void refresh()}
            >
              Refresh delivery status
            </Button>

            <Button
              icon={<Edit3 size={16} aria-hidden="true" />}
              onClick={() => setIsCorrectionOpen(true)}
            >
              Correct or withdraw warning
            </Button>
          </div>
        </Card>

        <Card title={`Delivery by channel (${deliveries.length})`}>
          {deliveries.length === 0 ? (
            <p className="muted flush">
              No per-channel notification delivery records available yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Channel</th>
                    <th>Recipient (team role)</th>
                    <th>Delivery status</th>
                    <th>Retries</th>
                    <th>Last error</th>
                    <th>Sent at</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td>#{d.id}</td>
                      <td>
                        <strong>{d.channel}</strong>
                      </td>
                      <td>{d.recipient}</td>
                      <td>
                        <StatusBadge
                          tone={
                            d.deliveryStatus === 'Sent'
                              ? 'success'
                              : d.deliveryStatus === 'Failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {d.deliveryStatus}
                        </StatusBadge>
                      </td>
                      <td>{d.retryCount}</td>
                      <td className="caption text-danger">{d.lastError ?? '-'}</td>
                      <td>{d.sentAt ? new Date(d.sentAt).toLocaleTimeString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <CorrectionModal
          warningId={warning.id}
          currentLevel={warning.level}
          isOpen={isCorrectionOpen}
          onClose={() => setIsCorrectionOpen(false)}
          onSubmit={handleCorrection}
        />
      </div>
    </>
  );
}
