import type { DispatchStatus, Priority, ShelterDto, TeamAvailability } from '@dms/shared';
import { StatusBadge } from '../../../shared/ui/feedback';
import {
  AVAILABILITY_TONE,
  DISPATCH_STATUS_LABEL,
  DISPATCH_STATUS_TONE,
  PRIORITY_TONE,
  SHELTER_STATE_TONE,
  shelterState,
} from '../lib/constants';

/** Every badge in this module shows a text label as well as a colour, so status never relies on colour alone (WCAG). */
export function DispatchStatusBadge({ status }: { status: DispatchStatus }) {
  return (
    <StatusBadge tone={DISPATCH_STATUS_TONE[status]}>{DISPATCH_STATUS_LABEL[status]}</StatusBadge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <StatusBadge tone={PRIORITY_TONE[priority]}>{priority}</StatusBadge>;
}

export function AvailabilityBadge({ availability }: { availability: TeamAvailability }) {
  return <StatusBadge tone={AVAILABILITY_TONE[availability]}>{availability}</StatusBadge>;
}

export function ShelterStateBadge({ shelter }: { shelter: ShelterDto }) {
  const state = shelterState(shelter);
  return <StatusBadge tone={SHELTER_STATE_TONE[state]}>{state}</StatusBadge>;
}
