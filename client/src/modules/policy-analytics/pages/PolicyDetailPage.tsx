import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PolicyStatus, Role } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { formatDate } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { PolicyStatusBadge } from '../components/badges';
import { DeliveryStatusList, PolicySummary } from '../components/PolicyParts';

const SECTIONS = [
  ['description', 'Description'],
  ['mitigationStrategies', 'Mitigation strategies'],
  ['landUseGuidelines', 'Land-use guidelines'],
  ['resourceRules', 'Emergency resource allocation rules'],
] as const;

/** Read-only policy with its decision, notification delivery and the next action for the viewer. */
export function PolicyDetailPage() {
  const { id } = useParams();
  const policyId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const detail = useAsync(async () => {
    const [policy, notifications] = await Promise.all([
      policyAnalyticsApi.getPolicy(policyId),
      policyAnalyticsApi.policyNotifications(policyId),
    ]);
    return { policy, notifications };
  }, [policyId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const revise = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const revision = await policyAnalyticsApi.revisePolicy(policyId);
      navigate(`/policies/${revision.id}/edit`);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  const policy = detail.data?.policy;
  const isAuthor = policy !== undefined && user?.id === policy.authorId;
  const canRevise =
    isAuthor &&
    (policy.status === PolicyStatus.Rejected ||
      (policy.status === PolicyStatus.Approved && policy.supersededBy === null));

  return (
    <>
      <PageHeader
        title={policy?.title ?? 'Policy'}
        subtitle={policy ? `${policy.policyKey} · version ${policy.version}` : undefined}
        backTo="/policies"
      />
      <div className="shell__content stack">
        {detail.loading && <LoadingState label="Loading policy…" />}
        {detail.error && (
          <ErrorState message={errorMessage(detail.error)} onRetry={detail.reload} />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {policy && detail.data && (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <PolicyStatusBadge status={policy.status} />
              <div className="row">
                {isAuthor && policy.status === PolicyStatus.Draft && (
                  <ButtonLink to={`/policies/${policy.id}/edit`}>Continue editing</ButtonLink>
                )}
                {canRevise && (
                  <Button variant="secondary" loading={busy} onClick={() => void revise()}>
                    Revise as new version
                  </Button>
                )}
                {user?.role === Role.PolicyDirector &&
                  policy.status === PolicyStatus.PendingApproval && (
                    <ButtonLink to={`/policies/${policy.id}/review`}>Review this policy</ButtonLink>
                  )}
              </div>
            </div>

            {policy.review && (
              <Alert
                tone={policy.review.decision === 'Approved' ? 'success' : 'danger'}
                title={`${policy.review.decision} by ${policy.review.reviewerName}`}
              >
                {policy.review.comments || 'No comments.'}
                {policy.effectiveDate && ` In force from ${formatDate(policy.effectiveDate)}.`}
              </Alert>
            )}
            {policy.supersededBy && (
              <Alert tone="info">A newer version of this policy has been approved.</Alert>
            )}

            <PolicySummary policy={policy} />

            {SECTIONS.map(([key, label]) => (
              <Card key={key} title={label}>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {policy[key] || <span className="muted">Not provided.</span>}
                </p>
              </Card>
            ))}
            {policy.warningRiskThreshold !== null && (
              <Card title="Warning threshold">
                <p>{policy.warningRiskThreshold} verified reports per district.</p>
              </Card>
            )}

            <section className="stack" aria-labelledby="deliveries">
              <h2 id="deliveries">Notification delivery</h2>
              <DeliveryStatusList notifications={detail.data.notifications} />
            </section>
          </>
        )}
      </div>
    </>
  );
}
