import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  HAZARD_TYPE_LABELS,
  PolicyErrorCode,
  POLICY_WIZARD_STEPS,
  PolicyStatus,
  SIMULATION_HAZARD_TYPES,
  type PolicyDto,
  type PolicyNotificationDto,
  type RegulatoryConflict,
  type SimulationRequest,
  type SimulationResult,
  type TrendReport,
} from '@dms/shared';
import {
  ApiError,
  NetworkError,
  errorMessage,
  fieldErrorMap,
} from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { formatDate, toDayString } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
} from '../../../shared/ui/feedback';
import { Select } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StepProgress } from '../../../shared/ui/StepProgress';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { ConflictList, DeliveryStatusList, PolicySummary } from '../components/PolicyParts';
import {
  EMPTY_POLICY_FORM,
  PolicyDetailStep,
  PolicyMeasuresStep,
  toContent,
  toFormValues,
  validateDetail,
  type PolicyFormValues,
} from '../components/PolicyForm';
import { SimulationForm, SimulationSummary } from '../components/SimulationPanel';
import { POLICY_STEP_TITLES } from '../constants';
import { usePendingDrafts } from '../hooks/usePendingDrafts';

/**
 * Policy wizard (hi-fi `policy-update-create-new` → `disaster-simulation-result` →
 * `review-publish-policy`): 1 Detail, 2 Measures, 3 Simulation (optional), 4 Review and submit.
 * `/policies/new?trendReportId=` starts a policy; `/policies/:id/edit` continues a draft.
 */
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

interface PolicyWizardProps {
  trend: TrendReport;
  initial?: PolicyDto;
}

type PersistResult = 'saved' | 'offline' | 'failed';

function PolicyWizard({ trend, initial }: PolicyWizardProps) {
  const { user } = useAuth();
  const today = toDayString(new Date());
  const clientId = useRef(globalThis.crypto.randomUUID());
  const pending = usePendingDrafts({ ownerId: user?.id ?? 0 });

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PolicyFormValues>(
    initial ? toFormValues(initial) : EMPTY_POLICY_FORM,
  );
  const [draftId, setDraftId] = useState<number | undefined>(initial?.id);
  const [policy, setPolicy] = useState<PolicyDto | undefined>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [savedOffline, setSavedOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState<RegulatoryConflict[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult>();
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState<{
    policy: PolicyDto;
    notifications: PolicyNotificationDto[];
  }>();

  const simulationSupported = SIMULATION_HAZARD_TYPES.includes(trend.hazardType);
  const change = (patch: Partial<PolicyFormValues>) => {
    setForm((current) => ({ ...current, ...patch }));
    setFieldErrors({});
  };

  /** Saves the draft: on the server, or — for a brand-new draft while offline — on this device (9a). */
  const persist = async (): Promise<PersistResult> => {
    const content = toContent(form);
    setError(undefined);
    try {
      if (draftId) {
        setPolicy(await policyAnalyticsApi.updateDraft(draftId, content));
      } else {
        const created = await policyAnalyticsApi.createDraft({
          ...content,
          trendReportId: trend.id,
          clientId: clientId.current,
        });
        setDraftId(created.id);
        setPolicy(created);
      }
      setSavedOffline(false);
      return 'saved';
    } catch (caught) {
      if (caught instanceof NetworkError && !draftId) {
        const stored = pending.saveLocal({
          ...content,
          trendReportId: trend.id,
          clientId: clientId.current,
          ownerId: user?.id ?? 0,
          savedAt: new Date().toISOString(),
        });
        if (stored) {
          setSavedOffline(true);
          return 'offline';
        }
        setError('This device could not store the draft. Reconnect and try again.');
        return 'failed';
      }
      setFieldErrors(fieldErrorMap(caught));
      setError(errorMessage(caught));
      return 'failed';
    }
  };

  const withBusy = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const next = () =>
    withBusy(async () => {
      if (step === 1) {
        const problems = validateDetail(form, today);
        setFieldErrors(problems);
        if (Object.keys(problems).length > 0) return;
        if ((await persist()) !== 'failed') setStep(2);
      } else if (step === 2) {
        const result = await persist();
        if (result === 'saved') setStep(3);
      } else if (step === 3) {
        await enterReview();
      }
    });

  /** Step 4 loads the saved policy (for its simulation reference) and pre-checks regulations (8a). */
  const enterReview = async () => {
    if (!draftId) return;
    try {
      const [fresh, found] = await Promise.all([
        policyAnalyticsApi.getPolicy(draftId),
        policyAnalyticsApi.checkConflicts(draftId),
      ]);
      setPolicy(fresh);
      setConflicts(found);
      setStep(4);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const runSimulation = (request: SimulationRequest) =>
    withBusy(async () => {
      if (!draftId) return;
      setError(undefined);
      setFieldErrors({});
      try {
        setSimulation(await policyAnalyticsApi.runSimulation(draftId, request));
      } catch (caught) {
        setFieldErrors(fieldErrorMap(caught));
        setError(errorMessage(caught));
      }
    });

  const submit = () =>
    withBusy(async () => {
      if (!draftId) return;
      setError(undefined);
      try {
        const saved = await persist();
        if (saved !== 'saved') {
          setConfirming(false);
          return;
        }
        const result = await policyAnalyticsApi.submitPolicy(draftId);
        const notifications = await policyAnalyticsApi.policyNotifications(draftId).catch(() => []);
        setConfirming(false);
        setSubmitted({ policy: result, notifications });
      } catch (caught) {
        setConfirming(false);
        if (caught instanceof ApiError && caught.code === PolicyErrorCode.RegulatoryConflict) {
          setConflicts(caught.details as RegulatoryConflict[]);
        }
        setFieldErrors(fieldErrorMap(caught));
        setError(errorMessage(caught));
      }
    });

  if (submitted) {
    return (
      <>
        <PageHeader
          title="Policy submitted"
          subtitle={`${submitted.policy.policyKey} · version ${submitted.policy.version}`}
        />
        <div className="shell__content stack">
          <Alert tone="success" title="Submitted for approval">
            “{submitted.policy.title}” is now waiting for the Policy Director. You will be told the
            decision.
          </Alert>
          <section className="stack" aria-labelledby="who-notified">
            <h2 id="who-notified">Notifications</h2>
            <DeliveryStatusList notifications={submitted.notifications} />
          </section>
          <div className="row">
            <ButtonLink to={`/policies/${submitted.policy.id}`}>View policy</ButtonLink>
            <ButtonLink to="/policies" variant="secondary">
              All policies
            </ButtonLink>
          </div>
        </div>
      </>
    );
  }

  const title = POLICY_STEP_TITLES[step - 1] as string;
  const offlineBlocked = !draftId; // simulation and submission need the draft on the server

  return (
    <>
      <PageHeader
        title="Policy update"
        subtitle={`${HAZARD_TYPE_LABELS[trend.hazardType]} · ${formatDate(trend.periodStart)} to ${formatDate(trend.periodEnd)}`}
        backTo="/policies"
      />
      <div className="shell__content stack">
        <StepProgress current={step} total={POLICY_WIZARD_STEPS} title={title} />
        {(!pending.online || savedOffline) && (
          <OfflineBanner>
            {savedOffline
              ? 'Saved on this device (Pending Sync). It will upload when you are back online. Simulation and submission need a connection.'
              : 'You are offline. You can keep writing; the draft is stored on this device until you reconnect.'}
          </OfflineBanner>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        {step === 1 && (
          <PolicyDetailStep values={form} errors={fieldErrors} onChange={change} today={today} />
        )}
        {step === 2 && <PolicyMeasuresStep values={form} errors={fieldErrors} onChange={change} />}
        {step === 3 && (
          <div className="stack">
            <h2>Simulate the proposed measures</h2>
            {simulationSupported ? (
              <>
                <p className="muted">
                  Optional: test how the measures would perform before sending the policy for
                  approval.
                </p>
                <SimulationForm busy={busy} errors={fieldErrors} onRun={runSimulation} />
                {simulation && <SimulationSummary result={simulation} />}
              </>
            ) : (
              <Alert tone="info">
                Simulation is available for flood and landslide policies only. You can continue to
                the review.
              </Alert>
            )}
          </div>
        )}
        {step === 4 && policy && (
          <div className="stack">
            <h2>Review draft policy</h2>
            <p className="muted">
              Check that everything matches the trend report and simulation before sending it for
              approval.
            </p>
            <ConflictList conflicts={conflicts} />
            <PolicySummary policy={policy} />
          </div>
        )}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          {step > 1 ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setStep(step === 4 ? 1 : step - 1)}
            >
              {step === 4 ? 'Edit draft' : 'Back'}
            </Button>
          ) : (
            <span />
          )}
          {step < 3 && (
            <Button loading={busy} onClick={() => void next()}>
              {step === 1 ? 'Next: measures' : 'Next: simulation'}
            </Button>
          )}
          {step === 3 && (
            <div className="row">
              <Button
                variant="secondary"
                disabled={busy || offlineBlocked}
                onClick={() => void next()}
              >
                Skip simulation
              </Button>
              <Button loading={busy} disabled={offlineBlocked} onClick={() => void next()}>
                Next: review
              </Button>
            </div>
          )}
          {step === 4 && (
            <Button
              disabled={busy || conflicts.length > 0 || offlineBlocked}
              onClick={() => setConfirming(true)}
            >
              Submit for approval
            </Button>
          )}
        </div>
        {step === 4 && conflicts.length > 0 && (
          <p className="muted">
            Choose “Edit draft”, change the flagged clauses in the measures step, then review again.
          </p>
        )}
      </div>

      {confirming && policy && (
        <ConfirmDialog
          title="Submit for approval?"
          confirmLabel="Submit for approval"
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        >
          <p>
            “{policy.title}” ({policy.policyKey} version {policy.version}) will be sent to the
            Policy Director. You cannot edit it while it is waiting for a decision.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
