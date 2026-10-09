/**
 * UC-JOINT-001 contract (Member 4, IT23571334). `Priority`, `Unit` and `DestinationType` are the
 * critique's Table 13 enumerations in `enums.ts`; the server module keeps equal-valued domain enums
 * and both must stay in step with `docs/uc-joint-001-emergency-response.md`.
 */

import type { DestinationType, Priority, Unit } from '../enums';

export const PRIORITIES: readonly Priority[] = ['Low', 'Normal', 'High', 'Urgent'];

export const DispatchStatus = {
  Dispatched: 'Dispatched',
  EnRoute: 'EnRoute',
  OnSite: 'OnSite',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
} as const;
export type DispatchStatus = (typeof DispatchStatus)[keyof typeof DispatchStatus];

/** JOINT #6 / A5a: the only moves a Rescue Team Leader may make, in order. */
export const NEXT_DISPATCH_STATUS: Readonly<Partial<Record<DispatchStatus, DispatchStatus>>> = {
  Dispatched: 'EnRoute',
  EnRoute: 'OnSite',
  OnSite: 'Completed',
};

export const TeamAvailability = { Available: 'Available', Busy: 'Busy' } as const;
export type TeamAvailability = (typeof TeamAvailability)[keyof typeof TeamAvailability];

export const DESTINATION_TYPES: readonly DestinationType[] = ['Shelter', 'Area', 'Team'];

/** One unit per item (JOINT #7); the enumeration itself is `Unit` in `enums.ts` (Table 13). */
export type ResourceUnit = Unit;

/** Module-specific error codes returned in the envelope (never reused for another meaning). */
export const ResponseErrorCode = {
  TeamUnavailable: 'TEAM_UNAVAILABLE',
  InsufficientStock: 'INSUFFICIENT_STOCK',
  StaleStock: 'STALE_STOCK',
  ShelterFull: 'SHELTER_FULL',
  AlreadyReversed: 'ALREADY_REVERSED',
  NotReversible: 'NOT_REVERSIBLE',
} as const;

export const RESPONSE_LIMITS = {
  minReasonLength: 3,
  maxTextLength: 1000,
  maxLocationLength: 200,
} as const;

export interface ShelterDto {
  id: number;
  name: string;
  districtId: number;
  address: string;
  capacity: number;
  occupied: number;
  available: number;
  occupancyUpdatedAt: string | null;
}

export interface RescueTeamDto {
  id: number;
  name: string;
  agency: string;
  leaderName: string;
  leaderUserId: number | null;
  location: string;
  availability: TeamAvailability;
}

export interface DispatchDto {
  id: number;
  location: string;
  priority: Priority;
  teamId: number;
  instructions: string | null;
  status: DispatchStatus;
  cancelReason: string | null;
  replacesDispatchId: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceDto {
  id: number;
  name: string;
  unit: ResourceUnit;
  quantity: number;
  owner: string;
  location: string;
  quantityLabel: string;
  lowStock: boolean;
}

export interface AreaDto {
  id: number;
  name: string;
}

export interface ResponseDashboard {
  generatedAt: string;
  kpis: {
    activeDispatches: number;
    availableTeams: number;
    shelterBedsFree: number;
    lowStockResources: number;
  };
  activeDispatches: DispatchDto[];
  shelters: ShelterDto[];
  teams: RescueTeamDto[];
  resources: ResourceDto[];
  areas: AreaDto[];
}

export interface DispatchInput {
  location: string;
  priority: Priority;
  teamId: number;
  instructions?: string;
}

export interface DispatchSummary {
  location: string;
  priority: Priority;
  instructions: string | null;
  team: Pick<RescueTeamDto, 'id' | 'name' | 'agency' | 'leaderName'>;
}

export interface CancelDispatchResult {
  cancelled: DispatchDto;
  replacement: DispatchDto | null;
}

export interface AllocationInput {
  resourceId: number;
  quantity: number;
  destinationType: DestinationType;
  destinationId: number;
  instructions?: string;
}

export interface AllocationSummary {
  resource: { id: number; name: string; unit: ResourceUnit };
  quantity: number;
  quantityLabel: string;
  availableLabel: string;
  remainingLabel: string;
  destination: { type: DestinationType; id: number; name: string };
  instructions: string | null;
}

export interface AllocationEntryDto {
  id: number;
  entryType: 'Allocation' | 'Reversal';
  resourceId: number;
  quantity: number;
  unit: ResourceUnit;
  destinationType: DestinationType;
  destinationId: number;
  instructions: string | null;
  reversesAllocationId: number | null;
  reason: string | null;
  createdBy: number;
  createdAt: string;
}

export interface ResupplyRequestInput {
  resourceId: number;
  quantity: number;
  note?: string;
}

export interface ResupplyRequestDto {
  id: number;
  resourceId: number;
  quantity: number;
  note: string | null;
  status: string;
  requestedBy: number;
  createdAt: string;
}

export interface RedirectRequestResult {
  shelterId: number;
  status: 'Requested';
  alternatives: ShelterDto[];
}
