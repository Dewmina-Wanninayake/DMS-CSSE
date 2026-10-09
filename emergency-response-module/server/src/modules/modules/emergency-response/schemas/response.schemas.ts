import { z } from 'zod';
import {
  MAX_LOCATION_LENGTH,
  MAX_TEXT_LENGTH,
  MIN_REASON_LENGTH,
} from '../domain/constants';
import { DispatchStatus } from '../domain/team-status';
import { DestinationType, Priority } from '../domain/types';

const id = z.coerce.number().int().positive();
const reason = z
  .string()
  .trim()
  .min(MIN_REASON_LENGTH, `Give a reason (at least ${MIN_REASON_LENGTH} characters).`)
  .max(MAX_TEXT_LENGTH);
const optionalText = z.string().trim().max(MAX_TEXT_LENGTH).optional();

export const idParamSchema = z.object({ id });

export const shelterListQuerySchema = z.object({ districtId: id.optional() });

/** Dispatch preview and create share one shape: location, priority, team required. */
export const dispatchInputSchema = z.object({
  location: z
    .string()
    .trim()
    .min(1, 'Enter the incident location.')
    .max(MAX_LOCATION_LENGTH),
  priority: z.nativeEnum(Priority, { errorMap: () => ({ message: 'Choose a priority.' }) }),
  teamId: z.coerce
    .number({ invalid_type_error: 'Choose a rescue team.' })
    .int()
    .positive('Choose a rescue team.'),
  instructions: optionalText,
});

/** Team leaders can only move forward; cancelling has its own endpoint (A4a). */
export const statusUpdateSchema = z.object({
  status: z.enum([DispatchStatus.EnRoute, DispatchStatus.OnSite, DispatchStatus.Completed]),
});

export const cancelDispatchSchema = z.object({
  reason,
  replacementTeamId: id.optional(),
});

export const allocationInputSchema = z.object({
  resourceId: id,
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity.' })
    .int('Quantity must be a whole number.')
    .positive('Quantity must be greater than zero.'),
  destinationType: z.nativeEnum(DestinationType),
  destinationId: id,
  instructions: optionalText,
});

export const reversalSchema = z.object({ reason });

export const resupplyRequestSchema = z.object({
  resourceId: id,
  quantity: z.number().int().positive('Quantity must be greater than zero.'),
  note: optionalText,
});

export type DispatchInput = z.infer<typeof dispatchInputSchema>;
export type AllocationInput = z.infer<typeof allocationInputSchema>;
export type ResupplyInput = z.infer<typeof resupplyRequestSchema>;
