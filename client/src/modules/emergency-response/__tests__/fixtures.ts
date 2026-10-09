import type {
  DispatchDto,
  RescueTeamDto,
  ResourceDto,
  ResponseDashboard,
  ShelterDto,
} from '@dms/shared';

export const shelter = (overrides: Partial<ShelterDto> = {}): ShelterDto => ({
  id: 1,
  name: 'Colombo Central Relief Centre',
  districtId: 1,
  address: 'Maradana Road, Colombo 10',
  capacity: 400,
  occupied: 120,
  available: 280,
  occupancyUpdatedAt: '2026-10-09T08:00:00.000Z',
  ...overrides,
});

export const team = (overrides: Partial<RescueTeamDto> = {}): RescueTeamDto => ({
  id: 1,
  name: 'Alpha Rescue Team',
  agency: 'Sri Lanka Navy',
  leaderName: 'Cdr. S. Perera',
  leaderUserId: 6,
  location: 'Colombo',
  availability: 'Available',
  ...overrides,
});

export const dispatch = (overrides: Partial<DispatchDto> = {}): DispatchDto => ({
  id: 10,
  location: 'Kaduwela',
  priority: 'High',
  teamId: 1,
  instructions: 'Bring boats',
  status: 'Dispatched',
  cancelReason: null,
  replacesDispatchId: null,
  createdBy: 5,
  createdAt: '2026-10-09T08:00:00.000Z',
  updatedAt: '2026-10-09T08:00:00.000Z',
  ...overrides,
});

export const resource = (overrides: Partial<ResourceDto> = {}): ResourceDto => ({
  id: 1,
  name: 'Drinking water',
  unit: 'Litre',
  quantity: 5000,
  owner: 'DMC Warehouse',
  location: 'Colombo',
  quantityLabel: '5,000 litres',
  lowStock: false,
  ...overrides,
});

export const dashboard = (overrides: Partial<ResponseDashboard> = {}): ResponseDashboard => ({
  generatedAt: new Date().toISOString(),
  kpis: { activeDispatches: 1, availableTeams: 1, shelterBedsFree: 280, lowStockResources: 1 },
  activeDispatches: [dispatch()],
  shelters: [
    shelter(),
    shelter({ id: 2, name: 'Gampaha Hall Shelter', occupied: 250, capacity: 250, available: 0 }),
    shelter({
      id: 3,
      name: 'Kalutara Temple Shelter',
      occupied: 280,
      capacity: 300,
      available: 20,
    }),
  ],
  teams: [team(), team({ id: 2, name: 'Bravo Rescue Team', availability: 'Busy' })],
  resources: [
    resource(),
    resource({
      id: 4,
      name: 'First-aid kits',
      quantity: 10,
      quantityLabel: '10 units',
      lowStock: true,
    }),
  ],
  areas: [{ id: 1, name: 'Colombo' }],
  ...overrides,
});
