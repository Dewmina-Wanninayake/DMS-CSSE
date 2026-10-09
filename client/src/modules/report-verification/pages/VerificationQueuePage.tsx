import { CheckSquare, Eye, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { useVerificationQueue } from '../hooks/useVerificationQueue';

export function VerificationQueuePage() {
  const { queue, isLoading, error, refresh } = useVerificationQueue();

  if (isLoading) return <LoadingState label="Loading verification queue..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!queue) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <PageHeader
        title="Hazard Report Verification Queue"
        subtitle="Review unverified citizen ground reports and manage pending warning approvals"
      />

      {queue.pendingApprovals.length > 0 && (
        <Card title={`Pending Warning Approvals (${queue.pendingApprovals.length})`} icon={ShieldAlert}>
          <div className="alert alert--warning" style={{ marginBottom: 'var(--space-4)' }}>
            Warning and Emergency level alerts require second-approver authorization before public broadcast.
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Warning ID</th>
                  <th>Level</th>
                  <th>Hazard</th>
                  <th>Reason</th>
                  <th>Estimated Audience</th>
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
                        <Button size="sm" variant="secondary">
                          Review Authorization
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={`Ground Hazard Reports Pending Verification (${queue.reports.length})`} icon={CheckSquare}>
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
                  <th>Reported At</th>
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
                    <td style={{ maxWidth: '16rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.description}
                    </td>
                    <td>{new Date(r.reportedAt).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        {r.hasPhoto && (
                          <span className="badge badge--info">Photo</span>
                        )}
                        <span className="badge badge--neutral">{r.locationSource}</span>
                      </div>
                    </td>
                    <td>
                      <Link to={`/verification/reports/${r.id}`}>
                        <Button size="sm" icon={Eye}>
                          Review & Decide
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
