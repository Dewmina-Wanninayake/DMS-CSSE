import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { QueueWarning } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { Textarea } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { reportVerificationApi } from '../api/reportVerificationApi';
import { useVerificationQueue } from '../hooks/useVerificationQueue';

export function SecondApproverPage() {
  const { queue, isLoading, error, refresh } = useVerificationQueue();
  const [selected, setSelected] = useState<QueueWarning | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading pending authorization queue..." />;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Second Approver Authorization Queue"
        subtitle="Review and authorize escalated high-severity warnings (Warning / Emergency levels)"
      />

      {successMsg && <Alert tone="success">{successMsg}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <Card title={`Pending Warnings (${queue.pendingApprovals.length})`} icon={ShieldAlert}>
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
                  onClick={() => setSelected(w)}
                  className="list-item"
                  style={{
                    cursor: 'pointer',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    borderColor: selected?.id === w.id ? 'var(--color-primary)' : 'var(--color-border)',
                    background: selected?.id === w.id ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-label)' }}>Warning #{w.id}</span>
                    <StatusBadge tone="warning">{w.level}</StatusBadge>
                  </div>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 'var(--text-body)' }}>{w.reason}</p>
                  <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                    Est. Audience: {w.estimatedAudience.toLocaleString()} | Created:{' '}
                    {new Date(w.createdAt).toLocaleTimeString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Authorization Review Panel" icon={CheckCircle2}>
          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                  Selected Warning
                </span>
                <h3 style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-title)', fontWeight: 700 }}>
                  #{selected.id} — Level: {selected.level}
                </h3>
                <p className="alert alert--neutral" style={{ margin: 'var(--space-2) 0 0 0' }}>{selected.reason}</p>
              </div>

              <dl className="summary">
                <div className="summary__row">
                  <dt>Hazard Type</dt>
                  <dd>{selected.hazardType}</dd>
                </div>
                <div className="summary__row">
                  <dt>Estimated Audience</dt>
                  <dd>{selected.estimatedAudience.toLocaleString()} citizens</dd>
                </div>
                <div className="summary__row">
                  <dt>Creation Timestamp</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              <Textarea
                label="Approver Notes / Authorization Rationale"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes explaining your approval or rejection decision..."
                rows={3}
              />

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                <Button
                  onClick={() => void handleDecision('Approved')}
                  loading={isSubmitting}
                  icon={CheckCircle2}
                >
                  Approve & Broadcast
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void handleDecision('Rejected')}
                  loading={isSubmitting}
                  icon={XCircle}
                >
                  Reject Warning
                </Button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 'var(--text-body)', color: 'var(--color-text-muted)' }}>
              Select a pending warning from the queue to review and authorize.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
