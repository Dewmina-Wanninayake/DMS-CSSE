import { useState } from 'react';
import { RESPONSE_LIMITS, TeamAvailability, type DispatchDto } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Select, TextArea } from '../../../shared/ui/fields';
import { Alert, EmptyState, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { AvailabilityBadge, DispatchStatusBadge, PriorityBadge } from '../components/badges';
import { StaleDataBanner } from '../components/StaleDataBanner';

/**
 * Rescue Team Coordination (A1): teams with agency, leader, location and status, plus the open
 * dispatches. A dispatch can be cancelled with a reason and replaced by another team (A4a).
 */
export function TeamCoordinationPage() {
  const dashboard = useAsync(() => emergencyResponseApi.dashboard(), []);
  const data = dashboard.data;
  const [cancelling, setCancelling] = useState<DispatchDto>();
  const [reason, setReason] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [done, setDone] = useState<string>();

  const available = data?.teams.filter((team) => team.availability === TeamAvailability.Available);

  function openCancel(dispatch: DispatchDto) {
    setCancelling(dispatch);
    setReason('');
    setReplacementId('');
    setProblem(undefined);
  }

  async function cancel() {
    if (!cancelling) return;
    if (reason.trim().length < RESPONSE_LIMITS.minReasonLength) {
      setProblem(`Give a reason (at least ${RESPONSE_LIMITS.minReasonLength} characters).`);
      return;
    }
    setBusy(true);
    try {
      const result = await emergencyResponseApi.cancelDispatch(
        cancelling.id,
        reason.trim(),
        replacementId ? Number(replacementId) : undefined,
      );
      setDone(
        result.replacement
          ? 'Dispatch cancelled and replaced. The new team has been notified.'
          : 'Dispatch cancelled.',
      );
      setCancelling(undefined);
      dashboard.reload();
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Rescue team coordination"
        subtitle="Teams and dispatches"
        backTo="/response"
      />
      <div className="shell__content stack">
        {dashboard.loading && !data && <LoadingState label="Loading teams…" />}
        {dashboard.error && (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
        )}
        {done && <Alert tone="success">{done}</Alert>}
        {data && available && (
          <>
            <StaleDataBanner updatedAt={data.generatedAt} />
            {available.length === 0 && (
              <Alert tone="warning" title="No suitable team is available">
                A request stays pending until a team becomes available. Check back shortly.
              </Alert>
            )}
            <section className="stack" aria-labelledby="teams">
              <h2 id="teams">Teams</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      <th scope="col">Agency</th>
                      <th scope="col">Leader</th>
                      <th scope="col">Location</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teams.map((team) => (
                      <tr key={team.id}>
                        <td>{team.name}</td>
                        <td>{team.agency}</td>
                        <td>{team.leaderName}</td>
                        <td>{team.location}</td>
                        <td>
                          <AvailabilityBadge availability={team.availability} />
                        </td>
                        <td>
                          {team.availability === TeamAvailability.Available && (
                            <ButtonLink
                              variant="secondary"
                              to={`/response/dispatch?teamId=${team.id}`}
                            >
                              Dispatch {team.name}
                            </ButtonLink>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="stack" aria-labelledby="open">
              <h2 id="open">Open dispatches</h2>
              {data.activeDispatches.length === 0 ? (
                <EmptyState
                  title="No open dispatches"
                  description="Dispatch an available team to start."
                  action={<ButtonLink to="/response/dispatch">Dispatch a team</ButtonLink>}
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Team</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Status</th>
                        <th scope="col">
                          <span className="visually-hidden">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeDispatches.map((dispatch) => (
                        <tr key={dispatch.id}>
                          <td>{dispatch.location}</td>
                          <td>
                            {data.teams.find((team) => team.id === dispatch.teamId)?.name ??
                              `Team ${dispatch.teamId}`}
                          </td>
                          <td>
                            <PriorityBadge priority={dispatch.priority} />
                          </td>
                          <td>
                            <DispatchStatusBadge status={dispatch.status} />
                          </td>
                          <td>
                            {(dispatch.status === 'Dispatched' ||
                              dispatch.status === 'EnRoute') && (
                              <Button variant="secondary" onClick={() => openCancel(dispatch)}>
                                Cancel dispatch to {dispatch.location}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {cancelling && (
              <ConfirmDialog
                title="Cancel this dispatch"
                confirmLabel="Cancel dispatch"
                confirmVariant="danger"
                cancelLabel="Keep dispatch"
                busy={busy}
                onConfirm={() => void cancel()}
                onCancel={() => setCancelling(undefined)}
              >
                <TextArea
                  label="Reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  error={problem}
                  maxLength={RESPONSE_LIMITS.maxTextLength}
                />
                <Select
                  label="Replacement team"
                  hint="Optional. The replacement is dispatched to the same location."
                  value={replacementId}
                  onChange={(event) => setReplacementId(event.target.value)}
                >
                  <option value="">No replacement</option>
                  {available.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              </ConfirmDialog>
            )}
          </>
        )}
      </div>
    </>
  );
}
