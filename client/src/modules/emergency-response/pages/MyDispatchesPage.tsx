import { useState } from 'react';
import { NEXT_DISPATCH_STATUS, type DispatchStatus } from '@dms/shared';
import { ApiError, errorMessage } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { DispatchStatusBadge, PriorityBadge } from '../components/badges';
import { DISPATCH_STATUS_LABEL } from '../lib/constants';

/**
 * Rescue Team Leader screen (A5): the leader moves their own dispatch forward in order. A move the
 * server refuses (A5a) shows the allowed transitions.
 */
export function MyDispatchesPage() {
  const dispatches = useAsync(() => emergencyResponseApi.myDispatches(), []);
  const [busyId, setBusyId] = useState<number>();
  const [problem, setProblem] = useState<string>();

  async function advance(id: number, status: DispatchStatus) {
    setBusyId(id);
    setProblem(undefined);
    try {
      await emergencyResponseApi.updateStatus(id, status);
      dispatches.reload();
    } catch (error) {
      const allowed =
        error instanceof ApiError && error.code === 'INVALID_STATE_TRANSITION'
          ? (error.details as { allowed?: string[] } | undefined)?.allowed
          : undefined;
      setProblem(
        allowed
          ? `${errorMessage(error)} Allowed next: ${allowed.length ? allowed.join(', ') : 'none'}.`
          : errorMessage(error),
      );
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <>
      <PageHeader title="My dispatches" subtitle="Update your team status" />
      <div className="shell__content stack">
        {dispatches.loading && !dispatches.data && (
          <LoadingState label="Loading your dispatches…" />
        )}
        {dispatches.error && (
          <ErrorState message={errorMessage(dispatches.error)} onRetry={dispatches.reload} />
        )}
        {problem && <Alert tone="danger">{problem}</Alert>}
        {dispatches.data && dispatches.data.length === 0 && (
          <EmptyState
            title="No open dispatches"
            description="You will be notified when Joint Operations dispatches your team."
          />
        )}
        {dispatches.data?.map((dispatch) => {
          const next = NEXT_DISPATCH_STATUS[dispatch.status];
          return (
            <Card key={dispatch.id} title={dispatch.location}>
              <div className="stack">
                <div className="row">
                  <PriorityBadge priority={dispatch.priority} />
                  <DispatchStatusBadge status={dispatch.status} />
                </div>
                <p>{dispatch.instructions ?? 'No instructions were given.'}</p>
                {next && (
                  <div>
                    <Button
                      loading={busyId === dispatch.id}
                      onClick={() => void advance(dispatch.id, next)}
                    >
                      Mark {DISPATCH_STATUS_LABEL[next].toLowerCase()} at {dispatch.location}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
