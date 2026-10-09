import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { ErrorState, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { AllocationAlerts } from '../components/AllocationAlerts';
import { AllocationForm } from '../components/AllocationForm';
import { AllocationResult } from '../components/AllocationResult';
import { AllocationSummaryCard } from '../components/AllocationSummaryCard';
import { useAllocationFlow } from '../hooks/useAllocationFlow';

/**
 * Sub-flow B (B2-B5): choose a resource, quantity and destination, review the summary, confirm.
 * This page only arranges the steps; the rules live in `useAllocationFlow` and on the server.
 */
export function AllocationPage() {
  const [params] = useSearchParams();
  const dashboard = useAsync(() => emergencyResponseApi.dashboard(), []);
  const online = useOnlineStatus();
  const flow = useAllocationFlow(params, dashboard.reload);
  const data = dashboard.data;

  return (
    <>
      <PageHeader title="Allocate resources" subtitle="Sub-flow B" backTo="/response/resources" />
      <div className="shell__content stack">
        {dashboard.loading && !data && <LoadingState label="Loading resources and destinations…" />}
        {dashboard.error && (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
        )}
        {!online && (
          <OfflineBanner>
            You are offline. Stock levels may be out of date, and an allocation can only be
            confirmed once you reconnect. Stock is checked again then.
          </OfflineBanner>
        )}

        <AllocationAlerts flow={flow} />

        {data && flow.step === 'form' && <AllocationForm flow={flow} data={data} />}
        {flow.step === 'summary' && flow.summary && (
          <AllocationSummaryCard
            summary={flow.summary}
            busy={flow.busy}
            online={online}
            onEdit={() => flow.setStep('form')}
            onConfirm={() => void flow.confirm()}
          />
        )}
        {flow.step === 'done' && flow.entry && flow.summary && (
          <AllocationResult flow={flow} summary={flow.summary} />
        )}
      </div>
    </>
  );
}
