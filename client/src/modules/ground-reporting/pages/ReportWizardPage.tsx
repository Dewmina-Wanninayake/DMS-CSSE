import { REPORT_WIZARD_STEPS } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';
import { Alert, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { StepProgress } from '../../../shared/ui/StepProgress';
import { SubmissionConfirmation } from '../components/SubmissionConfirmation';
import {
  DescriptionStep,
  LocationStep,
  PhotoStep,
  ReviewStep,
  TypeStep,
} from '../components/wizard';
import { STEP_TITLES, useReportWizard } from '../hooks/useReportWizard';

/**
 * UC-CV-003 Report Hazard: one step order (type, description, photo, location, review) with a true
 * "Step n of 5" counter (critique CV-003 #1). Severity is not asked: the officer sets it (UC-DIST-02).
 */
export function ReportWizardPage() {
  const {
    online,
    options,
    descriptionRequired,
    step,
    setStep,
    draft,
    change,
    errors,
    setErrors,
    problem,
    busy,
    result,
    next,
    submit,
    typesLoading,
  } = useReportWizard();

  if (result) return <SubmissionConfirmation result={result} />;

  return (
    <>
      <PageHeader title="Report a hazard" subtitle="Help the Disaster Management Centre respond" />
      <div className="shell__content stack">
        {!online && (
          <OfflineBanner>
            You are offline. You can still write your report: it is saved on this device as Pending
            Sync and sent when you are back online.
          </OfflineBanner>
        )}
        <StepProgress current={step} total={REPORT_WIZARD_STEPS} title={STEP_TITLES[step - 1]} />
        {problem && <Alert tone="danger">{problem}</Alert>}

        {step === 1 && typesLoading && <LoadingState label="Loading hazard types…" />}
        {step === 1 && !typesLoading && (
          <TypeStep draft={draft} onChange={change} errors={errors} options={options} />
        )}
        {step === 2 && (
          <DescriptionStep
            draft={draft}
            onChange={change}
            errors={errors}
            required={descriptionRequired}
          />
        )}
        {step === 3 && <PhotoStep draft={draft} onChange={change} errors={errors} />}
        {step === 4 && <LocationStep draft={draft} onChange={change} errors={errors} />}
        {step === 5 && <ReviewStep draft={draft} />}

        <div className="row">
          {step > 1 && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setErrors({});
                setStep((current) => current - 1);
              }}
            >
              Back
            </Button>
          )}
          {step < REPORT_WIZARD_STEPS ? (
            <Button onClick={next}>
              {step === 3 && !draft.photo ? 'Continue without photo' : 'Next'}
            </Button>
          ) : (
            <Button loading={busy} onClick={() => void submit()}>
              Submit report
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
