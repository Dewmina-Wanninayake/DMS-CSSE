import { useRef, useState } from 'react';
import {
  PolicyErrorCode,
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
import { toDayString } from '../../../shared/format/format';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import {
  EMPTY_POLICY_FORM,
  toContent,
  toFormValues,
  validateDetail,
  type PolicyFormValues,
} from '../components/PolicyForm';
import { usePendingDrafts } from '../hooks/usePendingDrafts';

export type PersistResult = 'saved' | 'offline' | 'failed';

/**
 * State and actions of the policy wizard (UC-DA-001 steps 6-9, 8a, 9a). The component only renders
 * the step; saving, the offline fallback, simulation, the regulatory pre-check and submission are
 * decided here so they can be read and tested apart from the markup.
 */
export function usePolicyWizard(trend: TrendReport, initial?: PolicyDto) {
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

  return {
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
  };
}
