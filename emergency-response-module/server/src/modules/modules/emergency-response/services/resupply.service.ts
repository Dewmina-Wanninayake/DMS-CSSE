import type { Actor, Clock, ResupplyRequest } from '../domain/types';
import { EntityNotFoundError } from '../errors';
import type { ResourceRepository } from '../repositories/resource.repository';
import type { ResupplyRepository } from '../repositories/resupply.repository';
import type { ResupplyInput } from '../schemas/response.schemas';

/** B3a / JOINT #8: record a resupply request when stock is insufficient. */
export class ResupplyService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly requests: ResupplyRepository,
    private readonly clock: Clock = () => new Date(),
  ) {}

  create(input: ResupplyInput, actor: Actor): ResupplyRequest {
    if (!this.resources.findById(input.resourceId)) {
      throw new EntityNotFoundError('Resource', input.resourceId);
    }
    return this.requests.insert({
      resourceId: input.resourceId,
      quantity: input.quantity,
      note: input.note ?? null,
      requestedBy: actor.id,
      createdAt: this.clock().toISOString(),
    });
  }
}
