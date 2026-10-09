import type { DispatchStatus, Priority, ShelterDto, TeamAvailability } from '@dms/shared';
import type { Tone } from '../../../shared/ui/feedback';

/** The occupancy ratio from which a shelter is shown as near capacity (display only). */
export const SHELTER_NEAR_CAPACITY_RATIO = 0.9;
/** Dashboard data older than this is flagged as possibly stale (extension 2a). */
export const STALE_AFTER_MINUTES = 5;

export const DISPATCH_STATUS_LABEL: Record<DispatchStatus, string> = {
  Dispatched: 'Dispatched',
  EnRoute: 'En route',
  OnSite: 'On site',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export const DISPATCH_STATUS_TONE: Record<DispatchStatus, Tone> = {
  Dispatched: 'info',
  EnRoute: 'warning',
  OnSite: 'warning',
  Completed: 'success',
  Cancelled: 'neutral',
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  Low: 'neutral',
  Normal: 'info',
  High: 'warning',
  Urgent: 'danger',
};

export const AVAILABILITY_TONE: Record<TeamAvailability, Tone> = {
  Available: 'success',
  Busy: 'warning',
};

export type ShelterState = 'Available' | 'Near capacity' | 'Full';

/** Occupancy is read-only here; this only labels what the Shelter Coordinator recorded. */
export function shelterState(
  shelter: Pick<ShelterDto, 'capacity' | 'occupied' | 'available'>,
): ShelterState {
  if (shelter.available <= 0) return 'Full';
  return shelter.occupied / shelter.capacity >= SHELTER_NEAR_CAPACITY_RATIO
    ? 'Near capacity'
    : 'Available';
}

/** Shelter state is derived for display only. Occupancy itself is owned and written by the Shelter Coordinator (UC-SHL-001). */
export const SHELTER_STATE_TONE: Record<ShelterState, Tone> = {
  Available: 'success',
  'Near capacity': 'warning',
  Full: 'danger',
};
