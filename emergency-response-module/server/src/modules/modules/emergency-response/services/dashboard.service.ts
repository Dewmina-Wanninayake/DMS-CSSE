import { LOW_STOCK_THRESHOLD } from '../domain/constants';
import { type Dispatch, type RescueTeam, type Resource, type Shelter, TeamAvailability } from '../domain/types';
import { formatQuantity } from '../domain/units';
import type { DispatchRepository } from '../repositories/dispatch.repository';
import type { ResourceRepository } from '../repositories/resource.repository';
import type { ShelterRepository } from '../repositories/shelter.repository';
import type { TeamRepository } from '../repositories/team.repository';

export interface ResourceView extends Resource {
  quantityLabel: string;
  lowStock: boolean;
}

export interface DashboardData {
  kpis: {
    activeDispatches: number;
    availableTeams: number;
    shelterBedsFree: number;
    lowStockResources: number;
  };
  activeDispatches: Dispatch[];
  shelters: Shelter[];
  teams: RescueTeam[];
  resources: ResourceView[];
}

/** Read model for the Emergency Response Dashboard (KPI cards + tables). */
export class DashboardService {
  constructor(
    private readonly shelters: ShelterRepository,
    private readonly teams: TeamRepository,
    private readonly dispatches: DispatchRepository,
    private readonly resources: ResourceRepository,
  ) {}

  get(): DashboardData {
    const shelters = this.shelters.list();
    const teams = this.teams.list();
    const activeDispatches = this.dispatches.listActive();
    const resources = this.listResources();
    return {
      kpis: {
        activeDispatches: activeDispatches.length,
        availableTeams: teams.filter((t) => t.availability === TeamAvailability.Available).length,
        shelterBedsFree: shelters.reduce((sum, s) => sum + s.available, 0),
        lowStockResources: resources.filter((r) => r.lowStock).length,
      },
      activeDispatches,
      shelters,
      teams,
      resources,
    };
  }

  listResources(): ResourceView[] {
    return this.resources.list().map((r) => ({
      ...r,
      quantityLabel: formatQuantity(r.quantity, r.unit),
      lowStock: r.quantity <= LOW_STOCK_THRESHOLD,
    }));
  }

  listTeams(): RescueTeam[] {
    return this.teams.list();
  }
}
