import { AlertTriangle, ArrowLeft, Calendar, MapPin, User } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DecisionRequest } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { DistrictMap } from '../../../shared/ui/DistrictMap';
import { Alert, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { DecisionForm } from '../components/DecisionForm';
import { DecisionSupportCard } from '../components/DecisionSupportCard';
import { NearbyReportsList } from '../components/NearbyReportsList';
import { useReportReview } from '../hooks/useReportReview';

export function ReportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();
  const { review, isLoading, isSubmitting, error, refresh, submitDecision } = useReportReview(reportId);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading report review data..." />;
  if (error || !review) return <ErrorState message={error ?? 'Report not found'} onRetry={refresh} />;

  const handleDecision = async (data: DecisionRequest) => {
    setSuccessMsg(null);
    await submitDecision(data);
    setSuccessMsg(`Decision '${data.decision}' recorded successfully and reporter notified.`);
  };

  const handleEscalate = () => {
    navigate(`/verification/reports/${reportId}/warn`);
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
          title={`Report Review #${review.id} — ${review.hazardType}`}
          subtitle={`Reported in ${review.districtName} district`}
        />
      </div>

      {successMsg && <Alert tone="success">{successMsg}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <Card title="Hazard Report Details" icon={AlertTriangle}>
          <dl className="summary">
            <div className="summary__row">
              <dt>Current Status</dt>
              <dd>
                <StatusBadge
                  tone={
                    review.status === 'Verified'
                      ? 'success'
                      : review.status === 'Rejected'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {review.status}
                </StatusBadge>
              </dd>
            </div>

            <div className="summary__row">
              <dt>Assigned Severity</dt>
              <dd>{review.severity ?? 'Unassigned'}</dd>
            </div>

            <div className="summary__row">
              <dt style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <User size={14} /> Reporter
              </dt>
              <dd>{review.reporterName} (ID #{review.reporterId})</dd>
            </div>

            <div className="summary__row">
              <dt style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <Calendar size={14} /> Timestamp
              </dt>
              <dd>{new Date(review.reportedAt).toLocaleString()}</dd>
            </div>

            <div className="summary__row">
              <dt style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <MapPin size={14} /> Location Source
              </dt>
              <dd>{review.locationSource}</dd>
            </div>
          </dl>

          <div style={{ marginTop: 'var(--space-3)' }}>
            <span style={{ fontSize: 'var(--text-label)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Description:</span>
            <p className="alert alert--neutral" style={{ margin: 0 }}>{review.description}</p>
          </div>

          {review.photoPath && (
            <div style={{ marginTop: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-label)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-1)' }}>Photo Evidence:</span>
              <img
                src={review.photoPath}
                alt="Hazard report evidence"
                style={{ maxHeight: '12rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border)', objectFit: 'cover' }}
              />
            </div>
          )}
        </Card>

        <Card title="Geographic Location Map">
          <DistrictMap
            districtName={review.districtName}
            latitude={review.latitude}
            longitude={review.longitude}
          />
        </Card>
      </div>

      <DecisionSupportCard
        evidence={review.evidence}
        sensor={review.latestSensor}
        criteria={review.warningCriteria}
      />

      <NearbyReportsList reports={review.nearby} />

      <DecisionForm
        currentDecision={review.decision}
        currentNotes={review.notes}
        evidence={review.evidence}
        onSubmit={handleDecision}
        onEscalateWarning={review.status === 'Verified' ? handleEscalate : undefined}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
