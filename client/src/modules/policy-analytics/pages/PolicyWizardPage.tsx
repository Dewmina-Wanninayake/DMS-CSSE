import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HAZARD_TYPE_LABELS, PolicyStatus } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { formatDate } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { Select } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';

/**
 * Policy wizard (hi-fi `policy-update-create-new` → `disaster-simulation-result` →
 * `review-publish-policy`): 1 Detail, 2 Measures, 3 Simulation (optional), 4 Review and submit.
 * `/policies/new?trendReportId=` starts a policy; `/policies/:id/edit` continues a draft.
 */
import { PolicyWizard } from '../components/PolicyWizard';

export function PolicyWizardPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const policyId = id ? Number(id) : undefined;
  const trendReportId = Number(params.get('trendReportId')) || undefined;

  if (policyId) return <EditExisting policyId={policyId} />;
  if (trendReportId) return <StartFromReport trendReportId={trendReportId} />;
  return <ChooseReport />;
}

function ChooseReport() {
  const navigate = useNavigate();
  const reports = useAsync(() => policyAnalyticsApi.listTrendReports(), []);
  const [selected, setSelected] = useState<number>();
  const current = selected ?? reports.data?.[0]?.id;

  return (
    <>
      <PageHeader
        title="Policy update"
        subtitle="Choose the trend report to base it on"
        backTo="/analytics"
      />
      <div className="shell__content stack">
        {reports.loading && <LoadingState />}
        {reports.error && (
          <ErrorState message={errorMessage(reports.error)} onRetry={reports.reload} />
        )}
        {reports.data?.length === 0 && (
          <EmptyState
            title="No trend report yet"
            description="A policy starts from a risk trend report so that it is pre-filled with the evidence."
            action={<ButtonLink to="/analytics/trends">Analyse trends</ButtonLink>}
          />
        )}
        {reports.data && reports.data.length > 0 && (
          <div className="card stack">
            <Select
              label="Trend report"
              value={current}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {reports.data.map((r) => (
                <option key={r.id} value={r.id}>
                  {HAZARD_TYPE_LABELS[r.hazardType]} · {formatDate(r.periodStart)} to{' '}
                  {formatDate(r.periodEnd)} · {r.summary.highRiskCount} high-risk
                </option>
              ))}
            </Select>
            <div className="row row--end">
              <Button onClick={() => navigate(`/policies/new?trendReportId=${current}`)}>
                Continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StartFromReport({ trendReportId }: { trendReportId: number }) {
  const trend = useAsync(() => policyAnalyticsApi.getTrendReport(trendReportId), [trendReportId]);
  return (
    <WizardLoader error={trend.error} loading={trend.loading} onRetry={trend.reload}>
      {trend.data && <PolicyWizard trend={trend.data} />}
    </WizardLoader>
  );
}

function EditExisting({ policyId }: { policyId: number }) {
  const navigate = useNavigate();
  const loaded = useAsync(async () => {
    const policy = await policyAnalyticsApi.getPolicy(policyId);
    const trend = await policyAnalyticsApi.getTrendReport(policy.trendReportId);
    return { policy, trend };
  }, [policyId]);

  useEffect(() => {
    // Only drafts are editable; anything else is shown read-only.
    if (loaded.data && loaded.data.policy.status !== PolicyStatus.Draft) {
      navigate(`/policies/${policyId}`, { replace: true });
    }
  }, [loaded.data, navigate, policyId]);

  return (
    <WizardLoader error={loaded.error} loading={loaded.loading} onRetry={loaded.reload}>
      {loaded.data && loaded.data.policy.status === PolicyStatus.Draft && (
        <PolicyWizard trend={loaded.data.trend} initial={loaded.data.policy} />
      )}
    </WizardLoader>
  );
}

function WizardLoader({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: Error | undefined;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      {(loading || error) && (
        <>
          <PageHeader title="Policy update" backTo="/policies" />
          <div className="shell__content">
            {loading && <LoadingState label="Loading policy…" />}
            {error && <ErrorState message={errorMessage(error)} onRetry={onRetry} />}
          </div>
        </>
      )}
      {!loading && !error && children}
    </>
  );
}
