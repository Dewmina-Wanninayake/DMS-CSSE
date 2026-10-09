import { useState, type FormEvent } from 'react';
import { MAX_DESCRIPTION_LENGTH } from '@dms/shared';
import { errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { Button } from '../../../shared/ui/Button';
import { TextArea, TextInput } from '../../../shared/ui/fields';
import { Alert } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { groundReportingApi } from '../api/ground-reporting.api';

/**
 * Field update (13c, critique CV-003 #7): a volunteer certified for an area adds an on-the-ground
 * note to an existing report in that area. The report's status does not change.
 */
export function FieldUpdatePage() {
  const [reportId, setReportId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<number>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setProblem(undefined);
    const id = Number(reportId);
    const found: Record<string, string> = {};
    if (!reportId.trim() || !Number.isInteger(id) || id <= 0)
      found.reportId = 'Enter the report number.';
    if (!note.trim()) found.note = 'Write a short note about what you see.';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await groundReportingApi.addFieldUpdate(id, { note: note.trim() });
      setSentTo(id);
      setNote('');
      setReportId('');
    } catch (error) {
      setErrors(fieldErrorMap(error));
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Field update" subtitle="Add what you see on the ground" />
      <div className="shell__content">
        <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
          {sentTo !== undefined && (
            <Alert tone="success" title="Field update added">
              Your note was added to report {sentTo}.
            </Alert>
          )}
          {problem && <Alert tone="danger">{problem}</Alert>}
          <TextInput
            label="Report number"
            inputMode="numeric"
            value={reportId}
            onChange={(event) => setReportId(event.target.value)}
            error={errors.reportId}
          />
          <TextArea
            label="Field note"
            hint={`${note.length} of ${MAX_DESCRIPTION_LENGTH} characters.`}
            value={note}
            maxLength={MAX_DESCRIPTION_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            error={errors.note}
          />
          <div>
            <Button type="submit" loading={busy}>
              Add field update
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
