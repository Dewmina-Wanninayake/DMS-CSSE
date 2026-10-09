import { Calendar, MapPin, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DecisionRequest } from '@dms/shared';
import { AuthImage } from '../../../shared/ui/AuthImage';
import { Card } from '../../../shared/ui/Card';
import { DistrictMap } from '../../../shared/ui/DistrictMap';
import { Alert, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { DecisionForm } from '../components/DecisionForm';
import { DecisionSupportCard } from '../components/DecisionSupportCard';
import { NearbyReportsList } from '../components/NearbyReportsList';
import { useReportReview } from '../hooks/useReportReview';

/** Steps 3-6: the report on the map with nearby reports, the sensor reading and the evidence verdict, then the decision form. */
export function ReportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const navigate = useNavigate();
  const { review, isLoading, isSubmitting, error, refresh, submitDecision } =
    useReportReview(reportId);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isLoading) return <LoadingState label="Loading report review data…" />;
  if (error || !review)
    return <ErrorState message={error ?? 'Report not found'} onRetry={refresh} />;

  const handleDecision = async (data: DecisionRequest) => {
    setSuccessMsg(null);
    await submitDecision(data);
    setSuccessMsg(`Decision '${data.decision}' recorded successfully and reporter notified.`);
  };

  const handleEscalate = () => {
    navigate(`/verification/reports/${reportId}/warn`);
  };

  return (
    <>
      <PageHeader
        title={`Review report #${review.id} (${review.hazardType})`}
        subtitle={`Reported in ${review.districtName} district`}
        backTo="/verification"
      />
      <div className="shell__content stack stack--loose">
        {successMsg && <Alert tone="success">{successMsg}</Alert>}

        <div className="grid-auto grid-auto--wide">
          <Card title="Report details">
            <dl className="summary">
              <div className="summary__row">
                <dt>Current status</dt>
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
                <dt>Assigned severity</dt>
                <dd>{review.severity ?? 'Unassigned'}</dd>
              </div>

              <div className="summary__row">
                <dt className="row row--tight">
                  <User size={14} /> Reporter
                </dt>
                <dd>
                  {review.reporterName} (ID #{review.reporterId})
                </dd>
              </div>

              <div className="summary__row">
                <dt className="row row--tight">
                  <Calendar size={14} /> Timestamp
                </dt>
                <dd>{new Date(review.reportedAt).toLocaleString()}</dd>
              </div>

              <div className="summary__row">
                <dt className="row row--tight">
                  <MapPin size={14} /> Location Source
                </dt>
                <dd>{review.locationSource}</dd>
              </div>
            </dl>

            <div className="mt-3">
              <span className="text-label strong block mb-1">Description:</span>
              <p className="alert alert--neutral flush">{review.description}</p>
            </div>

            {review.photoPath && (
              <div className="mt-3">
                <span className="text-label strong block mb-1">Photo Evidence:</span>
                <AuthImage src={review.photoPath} alt="Hazard report evidence" className="thumb" />
              </div>
            )}
          </Card>

          <Card title="Location on the map">
            <DistrictMap
              label={`Location of report ${review.id}`}
              markers={[
                {
                  id: review.id,
                  latitude: review.latitude,
                  longitude: review.longitude,
                  color: 'var(--color-danger)',
                  label: review.districtName,
                },
              ]}
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
    </>
  );
}
