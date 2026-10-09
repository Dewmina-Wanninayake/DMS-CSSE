import { useState, type FormEvent } from 'react';
import {
  RESPONSE_LIMITS,
  ResponseErrorCode,
  type AllocationEntryDto,
  type AllocationInput,
  type AllocationSummary,
  type DestinationType,
  type ShelterDto,
} from '@dms/shared';
import { ApiError, errorMessage, fieldErrorMap } from '../../../shared/api/api-client';
import { emergencyResponseApi } from '../api/emergency-response.api';

export type AllocationStep = 'form' | 'summary' | 'done';
export type AllocationErrors = Partial<
  Record<'resourceId' | 'quantity' | 'destinationType' | 'destinationId', string>
>;

/** What the server said went wrong, kept in a shape the alerts can branch on. */
export interface Failure {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * State and actions of sub-flow B (B2-B5). The page only renders; every rule that decides what the
 * lead may do next lives here, so it can be read and tested apart from the markup.
 *
 * Stock is re-checked and deducted in one transaction on the server (JOINT #5), so a stale confirm
 * (B4a) comes back with the current quantity and the flow returns to the form. A confirmed allocation
 * is corrected with a reversing entry, never edited (B5a).
 *
 * @param prefill values from the link that opened the page (a resource or a shelter)
 * @param onStale called when a confirm fails, so the page can reload the stock it shows
 */
export function useAllocationFlow(prefill: URLSearchParams, onStale: () => void) {
  const [resourceId, setResourceId] = useState(prefill.get('resourceId') ?? '');
  const [quantity, setQuantity] = useState('');
  const [destinationType, setDestinationType] = useState<DestinationType | ''>(
    (prefill.get('destinationType') as DestinationType | null) ?? '',
  );
  const [destinationId, setDestinationId] = useState(prefill.get('destinationId') ?? '');
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<AllocationErrors>({});
  const [step, setStep] = useState<AllocationStep>('form');
  const [summary, setSummary] = useState<AllocationSummary>();
  const [entry, setEntry] = useState<AllocationEntryDto>();
  const [reversal, setReversal] = useState<AllocationEntryDto>();
  const [failure, setFailure] = useState<Failure>();
  const [busy, setBusy] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string>();
  const [resupplyNote, setResupplyNote] = useState<string>();

  /** B2: every field is required, and the quantity must be a whole number above zero. */
  function validate(): AllocationErrors {
    const found: AllocationErrors = {};
    if (!resourceId) found.resourceId = 'Choose a resource.';
    const amount = Number(quantity);
    if (!quantity.trim() || !Number.isInteger(amount) || amount <= 0) {
      found.quantity = 'Enter a whole number above zero.';
    }
    if (!destinationType) found.destinationType = 'Choose where the stock is going.';
    if (!destinationId) found.destinationId = 'Choose the destination.';
    return found;
  }

  function payload(): AllocationInput {
    return {
      resourceId: Number(resourceId),
      quantity: Number(quantity),
      destinationType: destinationType as DestinationType,
      destinationId: Number(destinationId),
      instructions: instructions.trim() || undefined,
    };
  }

  function recordFailure(error: unknown) {
    setErrors(fieldErrorMap(error));
    setFailure(
      error instanceof ApiError
        ? { code: error.code, message: error.message, details: error.details }
        : { code: 'UNKNOWN', message: errorMessage(error) },
    );
  }

  /** B3: ask the server for the summary; nothing is written yet. */
  async function review(event: FormEvent) {
    event.preventDefault();
    setFailure(undefined);
    setResupplyNote(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      setSummary(await emergencyResponseApi.previewAllocation(payload()));
      setStep('summary');
    } catch (error) {
      recordFailure(error);
    } finally {
      setBusy(false);
    }
  }

  /** B4: confirm. On failure go back to the form (B4a stale stock, 3a full shelter) to fix and review again. */
  async function confirm() {
    setBusy(true);
    setFailure(undefined);
    try {
      setEntry(await emergencyResponseApi.createAllocation(payload()));
      setStep('done');
    } catch (error) {
      recordFailure(error);
      setStep('form');
      onStale();
    } finally {
      setBusy(false);
    }
  }

  /** B3a: request the shortfall from the Resource Provider when stock is not enough. */
  async function requestResupply() {
    const details = failure?.details as
      { resourceId: number; requested: number; available: number } | undefined;
    if (!details) return;
    setBusy(true);
    try {
      await emergencyResponseApi.requestResupply({
        resourceId: details.resourceId,
        quantity: details.requested - details.available,
        note: 'Requested from the allocation screen because stock is short.',
      });
      setResupplyNote('Resupply requested from the Resource Provider.');
    } catch (error) {
      recordFailure(error);
    } finally {
      setBusy(false);
    }
  }

  /** B5a: reverse a confirmed allocation with a reason; the original row is never edited. */
  async function reverse() {
    if (!entry) return;
    if (reason.trim().length < RESPONSE_LIMITS.minReasonLength) {
      setReasonError(`Give a reason (at least ${RESPONSE_LIMITS.minReasonLength} characters).`);
      return;
    }
    setBusy(true);
    try {
      setReversal(await emergencyResponseApi.reverseAllocation(entry.id, reason.trim()));
      setReversing(false);
    } catch (error) {
      setReasonError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const alternatives =
    failure?.code === ResponseErrorCode.ShelterFull
      ? ((failure.details as { alternatives?: ShelterDto[] } | undefined)?.alternatives ?? [])
      : [];

  return {
    form: {
      resourceId,
      setResourceId,
      quantity,
      setQuantity,
      destinationType,
      setDestinationType,
      destinationId,
      setDestinationId,
      instructions,
      setInstructions,
      errors,
    },
    step,
    setStep,
    summary,
    entry,
    reversal,
    failure,
    kind: {
      stale: failure?.code === ResponseErrorCode.StaleStock,
      short: failure?.code === ResponseErrorCode.InsufficientStock,
      full: failure?.code === ResponseErrorCode.ShelterFull,
    },
    alternatives,
    /** Set when the chosen destination is a shelter, so the full-shelter alert can link to its page. */
    shelterId: destinationType === 'Shelter' ? Number(destinationId) : undefined,
    busy,
    resupplyNote,
    reversing,
    setReversing,
    reason,
    setReason,
    reasonError,
    review,
    confirm,
    requestResupply,
    reverse,
  };
}

export type AllocationFlow = ReturnType<typeof useAllocationFlow>;
