import type { Result } from '../hooks/useReportWizard';
import { Alert, OfflineBanner } from '../../../shared/ui/feedback';
import { ButtonLink } from '../../../shared/ui/Button';
import { PageHeader } from '../../../shared/ui/PageHeader';

/** Step 12: the confirmation, saying whether the report was sent or is waiting on the device (9b). */
export function SubmissionConfirmation({ result }: { result: Result }) {
  return (
    <>
      <PageHeader title="Report submitted" />
      <div className="shell__content stack">
        {result.kind === 'offline' ? (
          <>
            <OfflineBanner>
              Saved offline, Pending Sync. Your report will be sent as soon as you are back online.
            </OfflineBanner>
            {result.photoDropped && (
              <Alert tone="warning">
                The photo could not be kept on this device, so only the report will be sent.
              </Alert>
            )}
          </>
        ) : (
          <>
            <Alert tone="success" title="Report submitted">
              Thank you. A Duty Officer will check your report. You will see the outcome in My
              reports.
            </Alert>
            {result.report.duplicateOf !== null && (
              <Alert tone="info">
                This matches a report that was already made nearby, so the two were linked.
              </Alert>
            )}
            {result.photoFailed && (
              <Alert tone="warning">
                The report was sent but the photo could not be uploaded. You can mention it in an
                update if the officer asks for more information.
              </Alert>
            )}
          </>
        )}
        <div className="row">
          <ButtonLink to="/report/mine">View my reports</ButtonLink>
          <ButtonLink variant="secondary" to="/report" reloadDocument>
            Report another hazard
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
