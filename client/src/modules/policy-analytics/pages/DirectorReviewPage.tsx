import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  POLICY_LIMITS,
  PolicyStatus,
  type PolicyDto,
  type PolicyNotificationDto,
} from '@dms/shared';
import { errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { formatDate, toDayString } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Alert, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { TextArea, TextInput } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { RiskBadge } from '../components/badges';
import { DeliveryStatusList, PolicySummary } from '../components/PolicyParts';

type Decision = 'Approved' | 'Rejected';

/**
 * Steps 10–13 and extension 10a — the Policy Director reviews the draft with its evidence and either
 * approves (publishing it) or rejects it with comments. Same layout as the hi-fi "Review and publish".
 */
export function DirectorReviewPage() {
  const policyId = Number(useParams().id);
  const today = toDayString(new Date());
  const loaded = useAsync(async () => {
    const policy = await policyAnalyticsApi.getPolicy(policyId);
    const trend = await policyAnalyticsApi.getTrendReport(policy.trendReportId);
    return { policy, trend };
  }, [policyId]);

  const [comments, setComments] = useState('');
  const [effectiveDate, setEffectiveDate] = useState<string>();
  const [pendingDecision, setPendingDecision] = useState<Decision>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<{
    policy: PolicyDto;
    notifications: PolicyNotificationDto[];
  }>();

  const decide = async (decision: Decision) => {
    setBusy(true);
    setError(undefined);
    setFieldErrors({});
    try {
      const policy = await policyAnalyticsApi.reviewPolicy(policyId, {
        decision,
        comments: comments.trim(),
        effectiveDate:
          decision === 'Approved'
            ? (effectiveDate ?? loaded.data?.policy.proposedEffectiveDate ?? undefined)
            : undefined,
      });
      const notifications = await policyAnalyticsApi.policyNotifications(policyId).catch(() => []);
      setOutcome({ policy, notifications });
    } catch (caught) {
      setFieldErrors(fieldErrorMap(caught));
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
      setPendingDecision(undefined);
    }
  };

  const reject = () => {
    // Explain-the-rejection rule is checked before the confirmation so the Director is not interrupted twice.
    if (comments.trim().length < POLICY_LIMITS.commentsMin) {
      setFieldErrors({
        comments: `Explain the rejection in at least ${POLICY_LIMITS.commentsMin} characters.`,
      });
      return;
    }
    setFieldErrors({});
    setPendingDecision('Rejected');
  };

  if (outcome) {
    const approved = outcome.policy.status === PolicyStatus.Approved;
    return (
      <>
        <PageHeader
          title={approved ? 'Policy published' : 'Policy rejected'}
          subtitle={`${outcome.policy.policyKey} · version ${outcome.policy.version}`}
        />
        <div className="shell__content stack">
          <Alert
            tone={approved ? 'success' : 'info'}
            title={approved ? 'Approved and published' : 'Rejected'}
          >
            {approved
              ? `“${outcome.policy.title}” is in force from ${formatDate(outcome.policy.effectiveDate ?? today)}. Duty Officers, regional administrators and field teams have been notified.`
              : `The analyst has been told why. They can revise it as a new version.`}
          </Alert>
          <section className="stack" aria-labelledby="delivery">
            <h2 id="delivery">Notification delivery</h2>
            <DeliveryStatusList notifications={outcome.notifications} />
          </section>
          <div className="row">
            <ButtonLink to="/policies">All policies</ButtonLink>
            <ButtonLink to="/analytics" variant="secondary">
              Dashboard
            </ButtonLink>
          </div>
        </div>
      </>
    );
  }

  const policy = loaded.data?.policy;
  const trend = loaded.data?.trend;
  const reviewable = policy?.status === PolicyStatus.PendingApproval;
  const highRisk = trend?.districts.filter((d) => d.riskLevel === 'High') ?? [];

  return (
    <>
      <PageHeader title="Review and publish" subtitle="Final approval" backTo="/policies" />
      <div className="shell__content stack">
        {loaded.loading && <LoadingState label="Loading policy…" />}
        {loaded.error && (
          <ErrorState message={errorMessage(loaded.error)} onRetry={loaded.reload} />
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {policy && trend && (
          <>
            {!reviewable && (
              <Alert tone="warning">
                This policy is {policy.status.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()} and
                cannot be reviewed.
              </Alert>
            )}
            <h2>Review draft policy</h2>
            <p className="muted">
              Verify that the policy matches the ground reports and simulation before approving.
            </p>
            <PolicySummary policy={policy} />

            <Card
              title={`Evidence: ${trend.summary.totalVerified} verified reports, ${trend.summary.highRiskCount} high-risk districts`}
            >
              {highRisk.length === 0 ? (
                <p className="muted">No district was above the risk threshold in this period.</p>
              ) : (
                <ul className="list">
                  {highRisk.map((d) => (
                    <li key={d.districtId} className="row">
                      <strong>{d.name}</strong> {d.verifiedCount} verified reports{' '}
                      <RiskBadge level={d.riskLevel} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {reviewable && (
              <div className="card stack">
                <TextArea
                  label="Comments"
                  value={comments}
                  maxLength={POLICY_LIMITS.commentsMax}
                  onChange={(e) => setComments(e.target.value)}
                  error={fieldErrors.comments}
                  hint="Required when rejecting; shown to the analyst."
                />
                <TextInput
                  label="Effective date"
                  type="date"
                  min={today}
                  value={effectiveDate ?? policy.proposedEffectiveDate ?? today}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  error={fieldErrors.effectiveDate}
                />
                <div className="row row--between">
                  <Button variant="danger" disabled={busy} onClick={reject}>
                    Reject
                  </Button>
                  <Button disabled={busy} onClick={() => setPendingDecision('Approved')}>
                    Approve and publish
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {pendingDecision && policy && (
        <ConfirmDialog
          title={pendingDecision === 'Approved' ? 'Approve and publish?' : 'Reject this policy?'}
          confirmLabel={pendingDecision === 'Approved' ? 'Approve and publish' : 'Reject policy'}
          confirmVariant={pendingDecision === 'Approved' ? 'primary' : 'danger'}
          busy={busy}
          onConfirm={() => void decide(pendingDecision)}
          onCancel={() => setPendingDecision(undefined)}
        >
          {pendingDecision === 'Approved' ? (
            <p>
              “{policy.title}” becomes the active policy. Duty Officers, regional administrators and
              field teams will be notified, and its warning threshold (if any) applies to new
              verification decisions.
            </p>
          ) : (
            <p>The analyst receives your comments and can revise the policy as a new version.</p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
