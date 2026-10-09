import type { Database } from 'better-sqlite3';
import { checkAllocationQuantity } from '../domain/allocation-rules';
import {
  type Actor,
  type AllocationEntry,
  AllocationEntryType,
  type Clock,
  DestinationType,
  type Resource,
} from '../domain/types';
import { formatQuantity } from '../domain/units';
import {
  DomainValidationError,
  EntityNotFoundError,
  InsufficientStockError,
  StaleStockError,
} from '../errors';
import type { AllocationRepository } from '../repositories/allocation.repository';
import type { ResourceRepository } from '../repositories/resource.repository';
import type { AllocationInput } from '../schemas/response.schemas';
import type { DestinationResolvers } from './destination-resolvers';

export interface AllocationSummary {
  resource: { id: number; name: string; unit: string };
  quantity: number;
  quantityLabel: string;
  availableLabel: string;
  remainingLabel: string;
  destination: { type: DestinationType; id: number; name: string };
  instructions: string | null;
}

/**
 * Sub-flow B: allocate resources (summary → transactional confirm). Where the stock goes is resolved
 * by a strategy per destination type (`destination-resolvers.ts`).
 */
export class AllocationService {
  constructor(
    private readonly db: Database,
    private readonly resources: ResourceRepository,
    private readonly allocations: AllocationRepository,
    private readonly resolvers: DestinationResolvers,
    private readonly clock: Clock = () => new Date(),
  ) {}

  /**
   * B3 / JOINT #3: summary shown before confirm. Writes nothing.
   * @throws InsufficientStockError (422) — the UI then offers a resupply request (B3a).
   */
  preview(input: AllocationInput): AllocationSummary {
    const resource = this.requireResource(input.resourceId);
    const destination = this.resolvers[input.destinationType].resolve(input.destinationId);
    const check = checkAllocationQuantity(input.quantity, resource.quantity);
    if (!check.ok) {
      if (check.reason === 'EXCEEDS_AVAILABLE') {
        throw new InsufficientStockError({
          resourceId: resource.id,
          requested: input.quantity,
          available: resource.quantity,
          unit: resource.unit,
        });
      }
      throw new DomainValidationError('Quantity must be a whole number above zero.', 'quantity');
    }
    return {
      resource: { id: resource.id, name: resource.name, unit: resource.unit },
      quantity: input.quantity,
      quantityLabel: formatQuantity(input.quantity, resource.unit),
      availableLabel: formatQuantity(resource.quantity, resource.unit),
      remainingLabel: formatQuantity(resource.quantity - input.quantity, resource.unit),
      destination,
      instructions: input.instructions ?? null,
    };
  }

  /**
   * JOINT #5: the stock re-check, the deduction and the ledger row happen in ONE
   * transaction (BEGIN IMMEDIATE takes the write lock first, so two confirms cannot
   * both pass the check). Any failure rolls everything back.
   * @throws StaleStockError (409, with current quantity) when stock changed since preview (B4a).
   */
  create(input: AllocationInput, actor: Actor): AllocationEntry {
    return this.db
      .transaction(() => {
        const resource = this.requireResource(input.resourceId);
        this.resolvers[input.destinationType].resolve(input.destinationId);

        const check = checkAllocationQuantity(input.quantity, resource.quantity);
        if (!check.ok && check.reason === 'NOT_A_POSITIVE_INTEGER') {
          throw new DomainValidationError(
            'Quantity must be a whole number above zero.',
            'quantity',
          );
        }
        if (!check.ok || !this.resources.deduct(resource.id, input.quantity)) {
          throw new StaleStockError({
            resourceId: resource.id,
            requested: input.quantity,
            currentQuantity: this.requireResource(resource.id).quantity,
          });
        }

        const id = this.allocations.insert({
          entryType: AllocationEntryType.Allocation,
          resourceId: resource.id,
          quantity: input.quantity,
          unit: resource.unit,
          destinationType: input.destinationType,
          destinationId: input.destinationId,
          instructions: input.instructions ?? null,
          reversesAllocationId: null,
          reason: null,
          createdBy: actor.id,
          createdAt: this.clock().toISOString(),
        });
        return this.requireEntry(id);
      })
      .immediate();
  }

  private requireResource(id: number): Resource {
    const resource = this.resources.findById(id);
    if (!resource) throw new EntityNotFoundError('Resource', id);
    return resource;
  }

  private requireEntry(id: number): AllocationEntry {
    const entry = this.allocations.findById(id);
    if (!entry) throw new EntityNotFoundError('Allocation', id);
    return entry;
  }
}
