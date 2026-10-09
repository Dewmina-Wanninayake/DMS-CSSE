import { ALTERNATIVE_SHELTER_LIMIT } from '../domain/constants';
import { DestinationType } from '../domain/types';
import { EntityNotFoundError, ShelterFullError } from '../errors';
import type { DestinationRepository } from '../repositories/destination.repository';
import type { ShelterRepository } from '../repositories/shelter.repository';

export interface ResolvedDestination {
  type: DestinationType;
  id: number;
  name: string;
}

/**
 * Strategy: how an allocation destination is looked up and checked. Each destination type has its
 * own rule (a shelter must have space; an area or a team only has to exist), so the service asks
 * the matching resolver instead of branching on the type. A new destination type is one new class
 * and one entry in `createDestinationResolvers`, with no change to `AllocationService`.
 */
export interface DestinationResolver {
  /** @throws EntityNotFoundError (404) when the id does not exist. */
  resolve(id: number): ResolvedDestination;
}

export class ShelterDestinationResolver implements DestinationResolver {
  constructor(private readonly shelters: ShelterRepository) {}

  resolve(id: number): ResolvedDestination {
    const shelter = this.shelters.findById(id);
    if (!shelter) throw new EntityNotFoundError('Shelter', id);
    if (shelter.available === 0) {
      // JOINT #9 / 3a: list other shelters; the Shelter Coordinator decides the redirect.
      throw new ShelterFullError(
        shelter.name,
        this.shelters.findAlternatives(shelter.districtId, shelter.id, ALTERNATIVE_SHELTER_LIMIT),
      );
    }
    return { type: DestinationType.Shelter, id: shelter.id, name: shelter.name };
  }
}

/** An Area is a district: stock sent to a place that has no shelter yet. */
export class AreaDestinationResolver implements DestinationResolver {
  constructor(private readonly destinations: DestinationRepository) {}

  resolve(id: number): ResolvedDestination {
    const area = this.destinations.findArea(id);
    if (!area) throw new EntityNotFoundError('Area', id);
    return { type: DestinationType.Area, id: area.id, name: area.name };
  }
}

export class TeamDestinationResolver implements DestinationResolver {
  constructor(private readonly destinations: DestinationRepository) {}

  resolve(id: number): ResolvedDestination {
    const team = this.destinations.findTeam(id);
    if (!team) throw new EntityNotFoundError('Team', id);
    return { type: DestinationType.Team, id: team.id, name: team.name };
  }
}

export type DestinationResolvers = Record<DestinationType, DestinationResolver>;

/** Composition helper: the one place that knows which resolver serves which destination type. */
export function createDestinationResolvers(
  shelters: ShelterRepository,
  destinations: DestinationRepository,
): DestinationResolvers {
  return {
    [DestinationType.Shelter]: new ShelterDestinationResolver(shelters),
    [DestinationType.Area]: new AreaDestinationResolver(destinations),
    [DestinationType.Team]: new TeamDestinationResolver(destinations),
  };
}
