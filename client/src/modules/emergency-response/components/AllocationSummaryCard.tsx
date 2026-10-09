import type { AllocationSummary } from '@dms/shared';
import { Button } from '../../../shared/ui/Button';

interface AllocationSummaryCardProps {
  summary: AllocationSummary;
  busy: boolean;
  /** Confirm is disabled offline: the server must re-check the stock (B4). */
  online: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}

/** Step B3: what will happen, including the stock before and after, shown before anything is written. */
export function AllocationSummaryCard({
  summary,
  busy,
  online,
  onEdit,
  onConfirm,
}: AllocationSummaryCardProps) {
  const rows: [string, string][] = [
    ['Resource', summary.resource.name],
    ['Quantity', summary.quantityLabel],
    ['Destination', `${summary.destination.type}: ${summary.destination.name}`],
    ['Stock now', summary.availableLabel],
    ['Stock after', summary.remainingLabel],
    ['Instructions', summary.instructions ?? 'None'],
  ];
  return (
    <section className="stack" aria-labelledby="allocation-summary">
      <h2 id="allocation-summary">Allocation summary</h2>
      <dl className="summary">
        {rows.map(([label, value]) => (
          <div className="summary__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="row">
        <Button variant="secondary" onClick={onEdit} disabled={busy}>
          Edit
        </Button>
        <Button loading={busy} disabled={!online} onClick={onConfirm}>
          Confirm allocation
        </Button>
      </div>
    </section>
  );
}
