import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { QueueWarning } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../../../shared/ui/feedback';
import { TextArea } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { reportVerificationApi } from '../api/report-verification.api';
import { useVerificationQueue } from '../hooks/useVerificationQueue';

/** Step 10: Warning and Emergency levels are only issued after a Second Approver approves or rejects them (DIST-02 #7). */
export function SecondApproverPage() {
  const { queue, isLoading, error, refresh } = useVerificationQueue();
  const [selected, setSelected] = useState<QueueWarning | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading pending authorization queue…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!queue) return null;

  const handleDecision = async (decision: 'Approved' | 'Rejected') => {
    if (!selected) return;
    setActionError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await reportVerificationApi.approveWarning(selected.id, {
        decision,
        notes: notes.trim() || undefined,
      });
      setSuccessMsg(`Warning #${selected.id} has been ${decision.toLowerCase()} successfully.`);
      setSelected(null);
      setNotes('');
      await refresh();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Authorization decision failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack stack--loose">
      <PageHeader
        title="Approval queue"
        subtitle="Review and authorize escalated high-severity warnings (Warning / Emergency levels)"
      />

      {successMsg && <Alert tone="success">{successMsg}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <div className="grid-auto grid-auto--wide">
        <Card title={`Warnings waiting for approval (${queue.pendingApprovals.length})`}>
          {queue.pendingApprovals.length === 0 ? (
            <EmptyState
              title="No pending warnings"
              description="There are currently no warnings awaiting second authorization."
            />
          ) : (
            <ul className="list">
              {queue.pendingApprovals.map((w) => (
                <li
                  key={w.id}
                  className={`list-item list-item--selectable${selected?.id === w.id ? ' list-item--selected' : ''}`}
                  onClick={() => setSelected(w)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelected(w);
                  }}
                  tabIndex={0}
                  aria-current={selected?.id === w.id}
                >
                  <div className="row row--between mb-1">
                    <span className="text-label strong-700">Warning #{w.id}</span>
                    <StatusBadge tone="warning">{w.level}</StatusBadge>
                  </div>
                  <p className="text-body flush medium">{w.reason}</p>
                  <p className="caption muted mt-2 flush-x">
                    Est. Audience: {w.estimatedAudience.toLocaleString()} | Created:{' '}
                    {new Date(w.createdAt).toLocaleTimeString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Approval decision">
          {selected ? (
            <div className="stack">
              <div className="divider-bottom pb-3">
                <span className="caption strong muted">Selected warning</span>
                <h3 className="text-title strong-700 mt-1 flush-x">
                  #{selected.id} — Level: {selected.level}
                </h3>
                <p className="alert alert--neutral mt-2 flush-x">{selected.reason}</p>
              </div>

              <dl className="summary">
                <div className="summary__row">
                  <dt>Hazard type</dt>
                  <dd>{selected.hazardType}</dd>
                </div>
                <div className="summary__row">
                  <dt>Estimated audience</dt>
                  <dd>{selected.estimatedAudience.toLocaleString()} citizens</dd>
                </div>
                <div className="summary__row">
                  <dt>Created at</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              <TextArea
                label="Approver notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes explaining your approval or rejection decision..."
                rows={3}
              />

              <div className="row">
                <Button
                  onClick={() => void handleDecision('Approved')}
                  loading={isSubmitting}
                  icon={<CheckCircle2 size={16} aria-hidden="true" />}
                >
                  Approve and send
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleDecision('Rejected')}
                  loading={isSubmitting}
                  icon={<XCircle size={16} aria-hidden="true" />}
                >
                  Reject warning
                </Button>
              </div>
            </div>
          ) : (
            <p className="muted flush">
              Select a pending warning from the queue to review and authorize.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
