import type { Shelter } from '../domain/types';
import { EntityNotFoundError } from '../errors';
import type { ShelterRepository } from '../repositories/shelter.repository';

/** Read-only view of shelters (JOINT #2). Occupancy is written only by UC-SHL-001. */
export class ShelterQueryService {
  constructor(private readonly shelters: ShelterRepository) {}

  list(districtId?: number): Shelter[] {
    return this.shelters.list(districtId);
  }

  getById(id: number): Shelter {
    const shelter = this.shelters.findById(id);
    if (!shelter) throw new EntityNotFoundError('Shelter', id);
    return shelter;
  }
}
