import { useState } from 'react';
import { Role, type TrendReport, type TrendReportRequest } from '@dms/shared';
import { errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Alert, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { TrendFilterForm } from '../components/TrendFilterForm';
import { TrendResults } from '../components/TrendResults';

/** Steps 2–5: request a risk trend report, review it, then move on to "Formulate policy". */
export function TrendAnalysisPage() {
  const { user } = useAuth();
  const filters = useAsync(() => policyAnalyticsApi.filters(), []);
  const [report, setReport] = useState<TrendReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const generate = async (request: TrendReportRequest) => {
    setBusy(true);
    setError(undefined);
    setFieldErrors({});
    try {
      setReport(await policyAnalyticsApi.createTrendReport(request));
    } catch (caught) {
      setReport(undefined);
      const fields = fieldErrorMap(caught);
      setFieldErrors(fields);
      // Field-level problems are shown inline; everything else (network, server) as an alert.
      if (Object.keys(fields).length === 0) setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Data trend analysis"
        subtitle="Find high-risk districts from verified reports"
        backTo="/analytics"
      />
      <div className="shell__content stack">
        {filters.loading && <LoadingState label="Loading options…" />}
        {filters.error && (
          <ErrorState message={errorMessage(filters.error)} onRetry={filters.reload} />
        )}
        {filters.data && (
          <TrendFilterForm
            filters={filters.data}
            busy={busy}
            errors={fieldErrors}
            onSubmit={generate}
          />
        )}

        {error && <Alert tone="danger">{error}</Alert>}
        {busy && <LoadingState label="Analysing verified reports…" />}
        {report && !busy && (
          <TrendResults report={report} canFormulatePolicy={user?.role === Role.DisasterAnalyst} />
        )}
      </div>
    </>
  );
}
