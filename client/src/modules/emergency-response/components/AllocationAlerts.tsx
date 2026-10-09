import { Link } from 'react-router-dom';
import { Button } from '../../../shared/ui/Button';
import { Alert } from '../../../shared/ui/feedback';
import type { AllocationFlow } from '../hooks/useAllocationFlow';

/** The explanation, and the next action, for each way an allocation can be refused. */
export function AllocationAlerts({ flow }: { flow: AllocationFlow }) {
  const { failure, kind, alternatives, shelterId, resupplyNote, busy } = flow;
  return (
    <>
      {kind.stale && (
        <Alert tone="warning" title="Stock changed since you reviewed this">
          {failure?.message} Correct the quantity and review again.
        </Alert>
      )}
      {kind.short && (
        <Alert
          tone="danger"
          title="Not enough stock"
          action={
            resupplyNote ? undefined : (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void flow.requestResupply()}
              >
                Request resupply
              </Button>
            )
          }
        >
          {failure?.message} Lower the quantity, choose another resource or request resupply.
        </Alert>
      )}
      {kind.full && (
        <Alert tone="danger" title="This shelter is full">
          {failure?.message} Choose another shelter
          {shelterId ? (
            <>
              {' '}
              or{' '}
              <Link to={`/response/shelters/${shelterId}`}>
                ask the Shelter Coordinator to redirect
              </Link>
            </>
          ) : null}
          .
        </Alert>
      )}
      {alternatives.length > 0 && (
        <ul className="list" aria-label="Shelters with space">
          {alternatives.map((alternative) => (
            <li key={alternative.id}>
              {alternative.name} · {alternative.available} spaces
            </li>
          ))}
        </ul>
      )}
      {resupplyNote && <Alert tone="success">{resupplyNote}</Alert>}
      {failure && !kind.stale && !kind.short && !kind.full && (
        <Alert tone="danger">{failure.message}</Alert>
      )}
    </>
  );
}
