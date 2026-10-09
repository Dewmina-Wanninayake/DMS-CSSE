import type { Role } from '@dms/shared';
import type { DispatchStatus } from './team-status';
import type { ResourceUnit } from './units';

export enum Priority {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  Urgent = 'Urgent',
}

export enum TeamAvailability {
  Available = 'Available',
  Busy = 'Busy',
}

export enum DestinationType {
  Shelter = 'Shelter',
  Area = 'Area',
  Team = 'Team',
}

export enum AllocationEntryType {
  Allocation = 'Allocation',
  Reversal = 'Reversal',
}

/** The authenticated user performing an action (from the JWT payload). */
export interface Actor {
  id: number;
  role: Role;
}

export interface Shelter {
  id: number;
  name: string;
  districtId: number;
  address: string;
  capacity: number;
  occupied: number;
  available: number;
  occupancyUpdatedAt: string | null;
}

export interface RescueTeam {
  id: number;
  name: string;
  agency: string;
  leaderName: string;
  leaderUserId: number | null;
  location: string;
  availability: TeamAvailability;
}

export interface Dispatch {
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

export interface Resource {
  id: number;
  name: string;
  unit: ResourceUnit;
  quantity: number;
  owner: string;
  location: string;
}

export interface AllocationEntry {
  id: number;
  entryType: AllocationEntryType;
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

export interface ResupplyRequest {
  id: number;
  resourceId: number;
  quantity: number;
  note: string | null;
  status: string;
  requestedBy: number;
  createdAt: string;
}

export type Clock = () => Date;
