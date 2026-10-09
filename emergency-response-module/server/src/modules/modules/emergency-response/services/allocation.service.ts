import type { Database } from 'better-sqlite3';
import { checkAllocationQuantity } from '../domain/allocation-rules';
import { ALTERNATIVE_SHELTER_LIMIT } from '../domain/constants';
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
  ShelterFullError,
  StaleStockError,
} from '../errors';
import type { AllocationRepository } from '../repositories/allocation.repository';
import type { DispatchRepository } from '../repositories/dispatch.repository';
import type { ResourceRepository } from '../repositories/resource.repository';
import type { ShelterRepository } from '../repositories/shelter.repository';
import type { AllocationInput } from '../schemas/response.schemas';

export interface AllocationSummary {
  resource: { id: number; name: string; unit: string };
  quantity: number;
  quantityLabel: string;
  availableLabel: string;
  remainingLabel: string;
  destination: { type: DestinationType; id: number; name: string };
  instructions: string | null;
}

/** Sub-flow B: allocate resources (summary → transactional confirm). */
export class AllocationService {
  constructor(
    private readonly db: Database,
    private readonly resources: ResourceRepository,
    private readonly allocations: AllocationRepository,
    private readonly shelters: ShelterRepository,
    private readonly dispatches: DispatchRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  /**
   * B3 / JOINT #3: summary shown before confirm. Writes nothing.
   * @throws InsufficientStockError (422) — the UI then offers a resupply request (B3a).
   */
  preview(input: AllocationInput): AllocationSummary {
    const resource = this.requireResource(input.resourceId);
    const destination = this.resolveDestination(input);
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
        this.resolveDestination(input);

        const check = checkAllocationQuantity(input.quantity, resource.quantity);
        if (!check.ok && check.reason === 'NOT_A_POSITIVE_INTEGER') {
          throw new DomainValidationError('Quantity must be a whole number above zero.', 'quantity');
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

  private resolveDestination(input: AllocationInput): AllocationSummary['destination'] {
    if (input.destinationType === DestinationType.Shelter) {
      const shelter = this.shelters.findById(input.destinationId);
      if (!shelter) throw new EntityNotFoundError('Shelter', input.destinationId);
      if (shelter.available === 0) {
        // JOINT #9 / 3a: list other shelters; the Shelter Coordinator decides the redirect.
        throw new ShelterFullError(
          shelter.name,
          this.shelters.findAlternatives(shelter.districtId, shelter.id, ALTERNATIVE_SHELTER_LIMIT),
        );
      }
      return { type: DestinationType.Shelter, id: shelter.id, name: shelter.name };
    }
    const dispatch = this.dispatches.findById(input.destinationId);
    if (!dispatch) throw new EntityNotFoundError('Dispatch', input.destinationId);
    return { type: DestinationType.Dispatch, id: dispatch.id, name: dispatch.location };
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
