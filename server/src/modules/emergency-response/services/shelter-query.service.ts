import type { Actor, Shelter } from '../domain/types';
import { EntityNotFoundError } from '../errors';
import type { ShelterRepository } from '../repositories/shelter.repository';
import type { ResponseNotifier } from './response-notifier';
import { ALTERNATIVE_SHELTER_LIMIT } from '../domain/constants';

export interface RedirectRequestResult {
  shelterId: number;
  status: 'Requested';
  /** Other shelters with space, so the lead can also send teams and supplies there directly. */
  alternatives: Shelter[];
}

/** Read-only view of shelters (JOINT #2). Occupancy is written only by UC-SHL-001. */
export class ShelterQueryService {
  constructor(
    private readonly shelters: ShelterRepository,
    private readonly notifier?: ResponseNotifier,
  ) {}

  list(districtId?: number): Shelter[] {
    return this.shelters.list(districtId);
  }

  getById(id: number): Shelter {
    const shelter = this.shelters.findById(id);
    if (!shelter) throw new EntityNotFoundError('Shelter', id);
    return shelter;
  }

  /**
   * 3a: the lead asks the Shelter Coordinator to redirect. Nothing is written to the shelter;
   * the coordinator is the only writer of occupancy (JOINT #2), so this only sends a notification.
   */
  async requestRedirect(
    id: number,
    note: string | null,
    actor: Actor,
  ): Promise<RedirectRequestResult> {
    const shelter = this.getById(id);
    await this.notifier?.requestShelterRedirect({
      shelterId: shelter.id,
      shelterName: shelter.name,
      requestedBy: actor.id,
      note,
    });
    return {
      shelterId: shelter.id,
      status: 'Requested',
      alternatives: this.shelters.findAlternatives(
        shelter.districtId,
        shelter.id,
        ALTERNATIVE_SHELTER_LIMIT,
      ),
    };
  }
}
