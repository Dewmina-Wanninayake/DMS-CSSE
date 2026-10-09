import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PRIORITIES,
  RESPONSE_LIMITS,
  TeamAvailability,
  type DispatchDto,
  type DispatchSummary,
  type Priority,
} from '@dms/shared';
import { ApiError, errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { Select, TextArea, TextInput } from '../../../shared/ui/fields';
import { Alert, ErrorState, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { PriorityBadge } from '../components/badges';

type Step = 'form' | 'summary' | 'done';
type Errors = Partial<Record<'location' | 'priority' | 'teamId', string>>;

/** Sub-flow A, steps A2-A4: enter the dispatch, review the summary, then confirm. */
export function DispatchPage() {
  const [params] = useSearchParams();
  const teams = useAsync(() => emergencyResponseApi.teams(), []);
  const online = useOnlineStatus();

  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [teamId, setTeamId] = useState(params.get('teamId') ?? '');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<Step>('form');
  const [summary, setSummary] = useState<DispatchSummary>();
  const [created, setCreated] = useState<DispatchDto>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const available = teams.data?.filter((team) => team.availability === TeamAvailability.Available);

  /** A2a: location, priority and team are required, so confirmation stays blocked until they are set. */
  function validate(): Errors {
    const found: Errors = {};
    if (!location.trim()) found.location = 'Enter the incident location.';
    if (!priority) found.priority = 'Choose a priority.';
    if (!teamId) found.teamId = 'Choose a rescue team.';
    return found;
  }

  function payload() {
    return {
      location: location.trim(),
      priority: priority as Priority,
      teamId: Number(teamId),
      instructions: instructions.trim() || undefined,
    };
  }

  async function review(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      setSummary(await emergencyResponseApi.previewDispatch(payload()));
      setStep('summary');
    } catch (error) {
      setErrors(fieldErrorMap(error));
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setProblem(undefined);
    try {
      setCreated(await emergencyResponseApi.createDispatch(payload()));
      setStep('done');
    } catch (error) {
      setProblem(errorMessage(error));
      // The team may have been taken since the preview: go back so another can be chosen.
      if (error instanceof ApiError && error.code === 'TEAM_UNAVAILABLE') {
        setStep('form');
        teams.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Dispatch a rescue team" subtitle="Sub-flow A" backTo="/response/teams" />
      <div className="shell__content stack">
        {teams.loading && <LoadingState label="Loading teams…" />}
        {teams.error && <ErrorState message={errorMessage(teams.error)} onRetry={teams.reload} />}
        {!online && (
          <OfflineBanner>
            You are offline. A dispatch can only be confirmed when you reconnect.
          </OfflineBanner>
        )}
        {problem && <Alert tone="danger">{problem}</Alert>}

        {available && step === 'form' && available.length === 0 && (
          <Alert tone="warning" title="No suitable team is available">
            The request stays pending. Try again when a team becomes available.
          </Alert>
        )}

        {available && step === 'form' && (
          <form className="stack" onSubmit={(event) => void review(event)} noValidate>
            <TextInput
              label="Incident location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              error={errors.location}
              maxLength={RESPONSE_LIMITS.maxLocationLength}
            />
            <Select
              label="Priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as Priority | '')}
              error={errors.priority}
            >
              <option value="">Choose a priority</option>
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            <Select
              label="Rescue team"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              error={errors.teamId}
            >
              <option value="">Choose a team</option>
              {available.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.agency})
                </option>
              ))}
            </Select>
            <TextArea
              label="Instructions"
              hint="Optional. What the team should do on arrival."
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={RESPONSE_LIMITS.maxTextLength}
            />
            <div>
              <Button type="submit" loading={busy}>
                Review dispatch
              </Button>
            </div>
          </form>
        )}

        {step === 'summary' && summary && (
          <section className="stack" aria-labelledby="dispatch-summary">
            <h2 id="dispatch-summary">Dispatch summary</h2>
            <dl className="summary">
              <div className="summary__row">
                <dt>Location</dt>
                <dd>{summary.location}</dd>
              </div>
              <div className="summary__row">
                <dt>Priority</dt>
                <dd>
                  <PriorityBadge priority={summary.priority} />
                </dd>
              </div>
              <div className="summary__row">
                <dt>Team</dt>
                <dd>
                  {summary.team.name} · {summary.team.agency} · leader {summary.team.leaderName}
                </dd>
              </div>
              <div className="summary__row">
                <dt>Instructions</dt>
                <dd>{summary.instructions ?? 'None'}</dd>
              </div>
            </dl>
            <div className="row">
              <Button variant="secondary" onClick={() => setStep('form')} disabled={busy}>
                Edit
              </Button>
              <Button loading={busy} disabled={!online} onClick={() => void confirm()}>
                Confirm dispatch
              </Button>
            </div>
          </section>
        )}

        {step === 'done' && created && (
          <section className="stack" aria-labelledby="dispatch-done">
            <Alert tone="success" title="Team dispatched">
              The team leader has been notified. Status: {created.status}.
            </Alert>
            <h2 id="dispatch-done" className="visually-hidden">
              Dispatch confirmed
            </h2>
            <div className="row">
              <ButtonLink to="/response/teams">Monitor dispatches</ButtonLink>
              <ButtonLink variant="secondary" to="/response">
                Back to dashboard
              </ButtonLink>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
