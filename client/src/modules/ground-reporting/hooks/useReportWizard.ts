import { useRef, useState } from 'react';
import {
  HAZARD_TYPES,
  HAZARD_TYPE_LABELS,
  HazardType,
  MAX_DESCRIPTION_LENGTH,
  type ReportSummary,
  type SubmitReportInput,
} from '@dms/shared';
import {
  ApiError,
  NetworkError,
  errorMessage,
  fieldErrorMap,
} from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useAuth } from '../../../shared/auth/AuthContext';
import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { groundReportingApi } from '../api/ground-reporting.api';
import { type ReportDraft } from '../components/wizard';
import { usePendingReports } from '../hooks/usePendingReports';
import { blobToDataUrl } from '../lib/photo';

export const STEP_TITLES = [
  'Hazard type',
  'Description',
  'Photo',
  'Location',
  'Review and submit',
] as const;

/** Server field → the step that owns it, so a rejected submit lands on the step to fix (9a). */
const FIELD_STEP: Record<string, number> = {
  hazardType: 1,
  description: 2,
  latitude: 4,
  longitude: 4,
  locationSource: 4,
  reportedAt: 5,
};

export type Result =
  | { kind: 'submitted'; report: ReportSummary; photoFailed: boolean }
  | { kind: 'offline'; photoDropped: boolean };

/**
 * State and actions of the report wizard. Validation per step (8a), the submit (9), the server's
 * field errors sending the reporter back to the right step (9a) and the offline fallback (9b) are
 * decided here; the page only renders the current step.
 */
export function useReportWizard() {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const pending = usePendingReports({ ownerId: user?.id ?? 0 });
  const types = useAsync(() => groundReportingApi.hazardTypes(), []);

  const clientId = useRef(globalThis.crypto.randomUUID());
  const seenAt = useRef(new Date().toISOString());
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<ReportDraft>({ description: '', locationSource: 'Gps' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>();

  // The list comes from the server, with the shared labels as the fallback when it cannot be reached.
  const options =
    types.data ??
    HAZARD_TYPES.map((value) => ({
      value,
      label: HAZARD_TYPE_LABELS[value],
      descriptionRequired: value === HazardType.Other,
    }));
  const descriptionRequired =
    options.find((option) => option.value === draft.hazardType)?.descriptionRequired ?? false;

  const change = (changes: Partial<ReportDraft>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setErrors({});
  };

  /** 8a: required fields are highlighted and the reporter cannot move on until they are fixed. */
  function validate(forStep: number): Record<string, string> {
    const found: Record<string, string> = {};
    if (forStep === 1 && !draft.hazardType) found.hazardType = 'Choose what is happening.';
    if (forStep === 2) {
      if (descriptionRequired && !draft.description.trim()) {
        found.description = 'Describe the hazard so the officer knows what it is.';
      }
      if (draft.description.length > MAX_DESCRIPTION_LENGTH) {
        found.description = `Use ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
      }
    }
    if (forStep === 4 && !draft.position)
      found.location = 'Confirm the location before you continue.';
    return found;
  }

  function next() {
    const found = validate(step);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((current) => current + 1);
  }

  function buildInput(): SubmitReportInput & { clientId: string } {
    return {
      clientId: clientId.current,
      hazardType: draft.hazardType as HazardType,
      description: draft.description.trim(),
      latitude: draft.position?.latitude ?? 0,
      longitude: draft.position?.longitude ?? 0,
      locationSource: draft.locationSource,
      reportedAt: seenAt.current,
    };
  }

  /** 9b: no network, so the report waits on the device as Pending Sync and uploads later. */
  async function saveOffline(input: SubmitReportInput & { clientId: string }) {
    let photo;
    let photoDropped = false;
    if (draft.photo) {
      try {
        photo = { dataUrl: await blobToDataUrl(draft.photo), mimeType: draft.photo.type };
      } catch {
        photoDropped = true;
      }
    }
    const report = { ...input, ownerId: user?.id ?? 0, savedAt: new Date().toISOString(), photo };
    let saved = pending.saveLocal(report);
    if (!saved && photo) {
      // Storage may be full because of the photo: keep the report itself and drop the photo.
      photoDropped = true;
      saved = pending.saveLocal({ ...report, photo: undefined });
    }
    if (!saved) {
      setProblem('This device has no space to save the report. Free up space and try again.');
      return;
    }
    setResult({ kind: 'offline', photoDropped });
  }

  async function submit() {
    setBusy(true);
    setProblem(undefined);
    setErrors({});
    const input = buildInput();
    try {
      if (!online) {
        await saveOffline(input);
        return;
      }
      const report = await groundReportingApi.submit(input);
      let photoFailed = false;
      if (draft.photo) {
        try {
          await groundReportingApi.uploadPhoto(report.id, draft.photo);
        } catch {
          photoFailed = true;
        }
      }
      setResult({ kind: 'submitted', report, photoFailed });
    } catch (error) {
      if (error instanceof NetworkError) {
        await saveOffline(input);
      } else {
        const fields = fieldErrorMap(error);
        const first = Object.keys(fields)[0];
        if (error instanceof ApiError && first) {
          setErrors(fields);
          setStep(FIELD_STEP[first] ?? 5);
        }
        setProblem(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return {
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
    typesLoading: types.loading,
  };
}
