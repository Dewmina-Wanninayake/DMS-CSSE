import { RESPONSE_LIMITS, type AllocationSummary } from '@dms/shared';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { TextArea } from '../../../shared/ui/fields';
import { Alert } from '../../../shared/ui/feedback';
import type { AllocationFlow } from '../hooks/useAllocationFlow';

/** Step B5: the confirmation with the remaining stock, and the reversal path (B5a). */
export function AllocationResult({
  flow,
  summary,
}: {
  flow: AllocationFlow;
  summary: AllocationSummary;
}) {
  return (
    <>
      <section className="stack" aria-labelledby="allocation-done">
        <h2 id="allocation-done" className="visually-hidden">
          Allocation result
        </h2>
        <Alert tone="success" title="Allocation confirmed">
          {summary.quantityLabel} of {summary.resource.name} sent to {summary.destination.name}.
          Remaining stock: {summary.remainingLabel}.
        </Alert>
        {flow.reversal ? (
          <Alert tone="info" title="Allocation reversed">
            A reversing entry restored the stock. Reason: {flow.reversal.reason}
          </Alert>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => flow.setReversing(true)}>
              Reverse this allocation
            </Button>
          </div>
        )}
        <div className="row">
          <ButtonLink to="/response/resources">Back to resources</ButtonLink>
        </div>
      </section>

      {flow.reversing && (
        <ConfirmDialog
          title="Reverse this allocation"
          confirmLabel="Reverse allocation"
          confirmVariant="danger"
          cancelLabel="Keep allocation"
          busy={flow.busy}
          onConfirm={() => void flow.reverse()}
          onCancel={() => flow.setReversing(false)}
        >
          <p>The record is not edited. A reversing entry is added and the stock is restored.</p>
          <TextArea
            label="Reason"
            value={flow.reason}
            onChange={(event) => flow.setReason(event.target.value)}
            error={flow.reasonError}
            maxLength={RESPONSE_LIMITS.maxTextLength}
          />
        </ConfirmDialog>
      )}
    </>
  );
}
