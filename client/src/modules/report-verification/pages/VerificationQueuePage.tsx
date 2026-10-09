import { Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { useVerificationQueue } from '../hooks/useVerificationQueue';

/** Step 1: the officer's queue of pending ground reports, and the approvals waiting for a Second Approver. */
export function VerificationQueuePage() {
  const { queue, isLoading, error, refresh } = useVerificationQueue();

  if (isLoading) return <LoadingState label="Loading verification queue…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!queue) return null;

  return (
    <div className="stack stack--loose">
      <PageHeader
        title="Verification queue"
        subtitle="Review unverified citizen ground reports and manage pending warning approvals"
      />

      {queue.pendingApprovals.length > 0 && (
        <Card title={`Warnings waiting for approval (${queue.pendingApprovals.length})`}>
          <div className="alert alert--warning mb-4">
            Warning and Emergency level alerts require second-approver authorization before public
            broadcast.
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Warning ID</th>
                  <th>Level</th>
                  <th>Hazard</th>
                  <th>Reason</th>
                  <th>Estimated audience</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.pendingApprovals.map((w) => (
                  <tr key={w.id}>
                    <td>#{w.id}</td>
                    <td>
                      <StatusBadge tone="warning">{w.level}</StatusBadge>
                    </td>
                    <td>{w.hazardType}</td>
                    <td>{w.reason}</td>
                    <td>{w.estimatedAudience.toLocaleString()} people</td>
                    <td>
                      <Link to="/verification/approvals">
                        <Button variant="secondary">Review authorization</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={`Reports waiting for verification (${queue.reports.length})`}>
        {queue.reports.length === 0 ? (
          <EmptyState
            title="No pending reports"
            description="All ground hazard reports have been reviewed and decided."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Hazard</th>
                  <th>District</th>
                  <th>Description</th>
                  <th>Reported at</th>
                  <th>Evidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.reports.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.id}</td>
                    <td>
                      <strong>{r.hazardType}</strong>
                    </td>
                    <td>{r.districtName}</td>
                    <td className="max-w-16 truncate">{r.description}</td>
                    <td>{new Date(r.reportedAt).toLocaleString()}</td>
                    <td>
                      <div className="row row--tight">
                        {r.hasPhoto && <span className="badge badge--info">Photo</span>}
                        <span className="badge badge--neutral">{r.locationSource}</span>
                      </div>
                    </td>
                    <td>
                      <Link to={`/verification/reports/${r.id}`}>
                        <Button icon={<Eye size={16} aria-hidden="true" />}>
                          Review and decide
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
