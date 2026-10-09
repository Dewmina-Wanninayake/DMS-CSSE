import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  HazardType,
  LocationSource,
  MAX_DESCRIPTION_LENGTH,
  MAX_PAGE_SIZE,
  ReportStatus,
  SRI_LANKA_BOUNDS,
  SYNC_BATCH_MAX,
} from '@dms/shared';

const OUTSIDE = 'The location must be inside Sri Lanka.';
const { minLat, maxLat, minLng, maxLng } = SRI_LANKA_BOUNDS;

const id = z.coerce.number().int().positive();
const latitude = z
  .number({ error: 'Latitude must be a number.' })
  .min(minLat, OUTSIDE)
  .max(maxLat, OUTSIDE);
const longitude = z
  .number({ error: 'Longitude must be a number.' })
  .min(minLng, OUTSIDE)
  .max(maxLng, OUTSIDE);
const descriptionText = z
  .string()
  .trim()
  .max(MAX_DESCRIPTION_LENGTH, `Use at most ${MAX_DESCRIPTION_LENGTH} characters.`);

export const idParams = z.object({ id });

const reportFields = {
  hazardType: z.enum(HazardType),
  description: descriptionText.default(''),
  latitude,
  longitude,
  locationSource: z.enum(LocationSource),
  reportedAt: z.iso.datetime({ offset: true, error: 'Use an ISO-8601 date and time.' }).optional(),
};

/** The description is optional, except that "Other" must be described. */
const otherNeedsDescription = {
  check: (value: { hazardType: HazardType; description: string }): boolean =>
    value.hazardType !== HazardType.Other || value.description.length > 0,
  params: { message: 'Describe the hazard when you choose "Other".', path: ['description'] },
};

export const submitBody = z
  .object({ clientId: z.uuid().optional(), ...reportFields })
  .refine(otherNeedsDescription.check, otherNeedsDescription.params);

/** One queued report inside `POST /reports/sync`; `clientId` is mandatory there. */
export const syncItem = z
  .object({ clientId: z.uuid(), ...reportFields })
  .refine(otherNeedsDescription.check, otherNeedsDescription.params);

/** Items are validated one by one by the service so a bad one cannot fail the whole batch. */
export const syncBody = z.object({
  reports: z
    .array(z.unknown())
    .min(1, 'Send at least one report.')
    .max(SYNC_BATCH_MAX, `Send at most ${SYNC_BATCH_MAX} reports at a time.`),
});

export const mineQuery = z.object({
  status: z.enum(ReportStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const updateBody = z
  .object({
    description: descriptionText.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    locationSource: z.enum(LocationSource).optional(),
  })
  .refine(
    (v) => [v.description, v.latitude, v.longitude, v.locationSource].some((x) => x !== undefined),
    { message: 'Change at least one field.', path: ['description'] },
  )
  .refine(
    (v) => {
      const given = [v.latitude, v.longitude, v.locationSource].filter((x) => x !== undefined);
      return given.length === 0 || given.length === 3;
    },
    { message: 'Send latitude, longitude and locationSource together.', path: ['latitude'] },
  );

export const fieldUpdateBody = z.object({
  note: descriptionText.min(1, 'Write a short note about what you see.'),
});

export const resolveQuery = z.object({
  lat: z.coerce
    .number({ error: 'Latitude must be a number.' })
    .min(minLat, OUTSIDE)
    .max(maxLat, OUTSIDE),
  lng: z.coerce
    .number({ error: 'Longitude must be a number.' })
    .min(minLng, OUTSIDE)
    .max(maxLng, OUTSIDE),
});
