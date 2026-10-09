import type { Database } from 'better-sqlite3';
import {
  type Actor,
  type AllocationEntry,
  AllocationEntryType,
  type Clock,
} from '../domain/types';
import { AlreadyReversedError, EntityNotFoundError, NotReversibleError } from '../errors';
import type { AllocationRepository } from '../repositories/allocation.repository';
import type { ResourceRepository } from '../repositories/resource.repository';

/** B5a / JOINT #7: correct a mistake with a reversing entry — never by editing a row. */
export class ReversalService {
  constructor(
    private readonly db: Database,
    private readonly resources: ResourceRepository,
    private readonly allocations: AllocationRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  /**
   * Restores the stock and appends a `Reversal` entry in one transaction.
   * @throws AlreadyReversedError (409) / NotReversibleError (422)
   */
  reverse(allocationId: number, reason: string, actor: Actor): AllocationEntry {
    return this.db
      .transaction(() => {
        const original = this.allocations.findById(allocationId);
        if (!original) throw new EntityNotFoundError('Allocation', allocationId);
        if (original.entryType !== AllocationEntryType.Allocation) {
          throw new NotReversibleError(allocationId);
        }
        if (this.allocations.findReversalOf(allocationId)) {
          throw new AlreadyReversedError(allocationId);
        }

        this.resources.restore(original.resourceId, original.quantity);
        const id = this.allocations.insert({
          entryType: AllocationEntryType.Reversal,
          resourceId: original.resourceId,
          quantity: original.quantity,
          unit: original.unit,
          destinationType: original.destinationType,
          destinationId: original.destinationId,
          instructions: null,
          reversesAllocationId: original.id,
          reason,
          createdBy: actor.id,
          createdAt: this.clock().toISOString(),
        });
        return this.allocations.findById(id) as AllocationEntry;
      })
      .immediate();
  }
}
