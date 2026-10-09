import { ArrowLeft, Edit3, RefreshCw, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CorrectionRequest } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { CorrectionModal } from '../components/CorrectionModal';
import { useWarningDelivery } from '../hooks/useWarningDelivery';

export function DeliveryStatusPage() {
  const { id } = useParams<{ id: string }>();
  const warningId = Number(id);
  const { delivery, isLoading, error, refresh } = useWarningDelivery(warningId);

  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading broadcast delivery logs..." />;
  if (error || !delivery) return <ErrorState message={error ?? 'Warning delivery not found'} onRetry={refresh} />;

  const { warning, deliveries } = delivery;

  const handleCorrection = async (input: CorrectionRequest) => {
    setActionMsg(null);
    await refresh();
    setActionMsg(input.action === 'Withdraw' ? 'Warning has been withdrawn.' : 'Warning corrected successfully.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <Link to="/verification">
          <Button variant="secondary" size="sm" icon={ArrowLeft}>
            Back to Queue
          </Button>
        </Link>
        <PageHeader
          title={`Warning #${warning.id} Broadcast & Delivery Tracking`}
          subtitle={`Level: ${warning.level} | Status: ${warning.status}`}
        />
      </div>

      {actionMsg && <Alert tone="success">{actionMsg}</Alert>}

      <Card title="Warning Summary Details" icon={Send}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          <dl className="summary">
            <div className="summary__row">
              <dt>Hazard Type</dt>
              <dd>{warning.hazardType}</dd>
            </div>
            <div className="summary__row">
              <dt>Target Areas</dt>
              <dd>{warning.areaNames.join(', ')}</dd>
            </div>
            <div className="summary__row">
              <dt>Language</dt>
              <dd>{warning.language}</dd>
            </div>
            <div className="summary__row">
              <dt>Estimated Audience</dt>
              <dd>{warning.estimatedAudience.toLocaleString()} citizens</dd>
            </div>
          </dl>

          <dl className="summary">
            <div className="summary__row">
              <dt>Warning Status</dt>
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
              <dt>Sync Status</dt>
              <dd>{warning.syncStatus}</dd>
            </div>
            <div className="summary__row">
              <dt>Issued At</dt>
              <dd>{warning.issuedAt ? new Date(warning.issuedAt).toLocaleString() : 'Not issued yet'}</dd>
            </div>
          </dl>
        </div>

        <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="secondary" icon={RefreshCw} onClick={() => void refresh()}>
            Refresh Delivery Status
          </Button>

          <Button icon={Edit3} onClick={() => setIsCorrectionOpen(true)}>
            Correct / Withdraw Warning
          </Button>
        </div>
      </Card>

      <Card title={`Per-Channel Broadcast Log (${deliveries.length})`}>
        {deliveries.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
            No per-channel notification delivery records available yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Channel</th>
                  <th>Recipient / Team Role</th>
                  <th>Delivery Status</th>
                  <th>Retries</th>
                  <th>Last Error</th>
                  <th>Sent At</th>
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
                    <td style={{ fontSize: 'var(--text-caption)', color: 'var(--color-danger)' }}>{d.lastError ?? '-'}</td>
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
  );
}
