import {
  HAZARD_TYPE_LABELS,
  POLICY_WIZARD_STEPS,
  type PolicyDto,
  type TrendReport,
} from '@dms/shared';
import { formatDate } from '../../../shared/format/format';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Alert, OfflineBanner } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StepProgress } from '../../../shared/ui/StepProgress';
import { ConflictList, DeliveryStatusList, PolicySummary } from '../components/PolicyParts';
import { PolicyDetailStep, PolicyMeasuresStep } from '../components/PolicyForm';
import { SimulationForm, SimulationSummary } from '../components/SimulationPanel';
import { POLICY_STEP_TITLES } from '../lib/constants';

import { usePolicyWizard } from '../hooks/usePolicyWizard';

interface PolicyWizardProps {
  trend: TrendReport;
  initial?: PolicyDto;
}

/** The policy wizard (hi-fi `policy-update-create-new` to `review-publish-policy`): renders the four steps from `usePolicyWizard`. */
export function PolicyWizard({ trend, initial }: PolicyWizardProps) {
  const {
    step,
    setStep,
    form,
    draftId,
    policy,
    fieldErrors,
    error,
    savedOffline,
    busy,
    conflicts,
    simulation,
    confirming,
    setConfirming,
    submitted,
    today,
    pending,
    simulationSupported,
    change,
    next,
    runSimulation,
    submit,
  } = usePolicyWizard(trend, initial);

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

        <div className="row row--between">
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
