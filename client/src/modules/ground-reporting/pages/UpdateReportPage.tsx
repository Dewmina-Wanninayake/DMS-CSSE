import { useRef, useState, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { MAX_DESCRIPTION_LENGTH, ReportStatus } from '@dms/shared';
import { errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { TextArea } from '../../../shared/ui/fields';
import { Alert, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { groundReportingApi } from '../api/ground-reporting.api';
import { compressPhoto } from '../lib/photo';

/**
 * Update report (13a): when the officer asked for more information, the reporter adds text or a
 * photo and resubmits. The report returns to Pending and re-enters the officer queue.
 */
export function UpdateReportPage() {
  const id = Number(useParams().id);
  const report = useAsync(() => groundReportingApi.get(id), [id]);
  const [description, setDescription] = useState<string>();
  const [photo, setPhoto] = useState<Blob>();
  const [photoName, setPhotoName] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const data = report.data;
  const text = description ?? data?.description ?? '';

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setProblem(undefined);
    try {
      setPhoto(await compressPhoto(file));
      setPhotoName(file.name);
    } catch (error) {
      setProblem(errorMessage(error));
    }
  }

  async function resubmit() {
    setBusy(true);
    setProblem(undefined);
    setFieldError(undefined);
    try {
      // The description is always sent: the update moves the report back to Pending even when only a photo was added.
      await groundReportingApi.update(id, { description: text.trim() });
      if (photo) {
        try {
          await groundReportingApi.uploadPhoto(id, photo);
        } catch {
          setPhotoFailed(true);
        }
      }
      setDone(true);
    } catch (error) {
      setFieldError(fieldErrorMap(error).description);
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Update report"
        subtitle="Add what the officer asked for"
        backTo="/report/mine"
      />
      <div className="shell__content stack">
        {report.loading && <LoadingState label="Loading your report…" />}
        {report.error && (
          <ErrorState message={errorMessage(report.error)} onRetry={report.reload} />
        )}

        {data && data.status !== ReportStatus.NeedsInformation && !done && (
          <Alert tone="info" title="This report cannot be updated">
            Only a report that needs more information can be changed.
            <div>
              <ButtonLink variant="secondary" to="/report/mine">
                Back to my reports
              </ButtonLink>
            </div>
          </Alert>
        )}

        {data && data.status === ReportStatus.NeedsInformation && !done && (
          <>
            {data.outcome && (
              <Alert tone="warning" title="What the officer asked">
                {data.outcome.message}
              </Alert>
            )}
            {problem && <Alert tone="danger">{problem}</Alert>}
            <TextArea
              label="Description"
              hint={`${text.length} of ${MAX_DESCRIPTION_LENGTH} characters.`}
              value={text}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
              error={fieldError}
            />
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png"
              className="visually-hidden"
              aria-label="Choose a photo to add"
              onChange={(event) => void choose(event)}
            />
            <div className="row">
              <Button variant="secondary" onClick={() => picker.current?.click()}>
                {photo ? 'Choose a different photo' : 'Add a photo'}
              </Button>
              {photo && <span className="muted">{photoName}</span>}
            </div>
            <div>
              <Button loading={busy} onClick={() => void resubmit()}>
                Resubmit report
              </Button>
            </div>
          </>
        )}

        {done && (
          <>
            <Alert tone="success" title="Report updated">
              Your report is back with the Duty Officer.
            </Alert>
            {photoFailed && (
              <Alert tone="warning">
                The new photo could not be uploaded, but your text was saved.
              </Alert>
            )}
            <div>
              <ButtonLink to="/report/mine">Back to my reports</ButtonLink>
            </div>
          </>
        )}
      </div>
    </>
  );
}
