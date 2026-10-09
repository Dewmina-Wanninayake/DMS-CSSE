/** UC-CV-003 contract shared by server and client (Member 3). Limits are the single source of truth. */
import type { HazardType, ReportStatus, SyncStatus } from './enums';

export const MAX_DESCRIPTION_LENGTH = 200;
/** Critique CV-003 #6: photo is compressed on the device to at most 2 MB. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];
/** Max reports accepted by one `POST /reports/sync` call. */
export const SYNC_BATCH_MAX = 20;
/** Bounding box of Sri Lanka incl. offshore islands; a coarse "is this a Sri Lankan GPS fix" check. */
export const SRI_LANKA_BOUNDS = { minLat: 5.8, maxLat: 9.95, minLng: 79.4, maxLng: 82.0 } as const;
/** Wizard length shown as "Step n of 5" (critique CV-003 #1). */
export const REPORT_WIZARD_STEPS = 5;

export const LocationSource = { Gps: 'Gps', Manual: 'Manual' } as const;
export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource];

export const ReportUpdateKind = {
  CitizenUpdate: 'CitizenUpdate',
  VolunteerFieldUpdate: 'VolunteerFieldUpdate',
} as const;
export type ReportUpdateKind = (typeof ReportUpdateKind)[keyof typeof ReportUpdateKind];

/** `notifications.related_type` value UC-DIST-02 uses for decisions on a report (agree with Member 1). */
export const HAZARD_REPORT_RELATED_TYPE = 'HazardReport';

/** Module-specific error codes (never reused for another meaning). */
export const GroundReportingErrorCode = {
  PhotoTooLarge: 'PHOTO_TOO_LARGE',
  PhotoInvalidType: 'PHOTO_INVALID_TYPE',
  NotCertifiedForArea: 'NOT_CERTIFIED_FOR_AREA',
} as const;

export interface HazardTypeOption {
  value: HazardType;
  label: string;
  /** `Other` forces a description (description validation). */
  descriptionRequired: boolean;
}

export interface SubmitReportInput {
  /** UUID generated on the device; makes submit and sync idempotent. */
  clientId?: string;
  hazardType: HazardType;
  description: string;
  latitude: number;
  longitude: number;
  locationSource: LocationSource;
  /** When the citizen saw the hazard (offline reports keep their original time). */
  reportedAt?: string;
}

export interface ReportOutcome {
  message: string;
  at: string;
}

export interface ReportUpdateItem {
  id: number;
  kind: ReportUpdateKind;
  note: string;
  authorName: string;
  createdAt: string;
}

export interface ReportSummary {
  id: number;
  hazardType: HazardType;
  description: string;
  status: ReportStatus;
  /** Always `Synced` from the server; `PendingSync` only exists in the device queue. */
  syncStatus: SyncStatus;
  districtName: string;
  locationSource: LocationSource;
  reportedAt: string;
  hasPhoto: boolean;
  /** Set when this report was linked to an earlier report of the same hazard nearby. */
  duplicateOf: number | null;
  /** Latest decision message written by UC-DIST-02 (null while still Pending). */
  outcome: ReportOutcome | null;
}

export interface ReportDetail extends ReportSummary {
  latitude: number;
  longitude: number;
  updates: ReportUpdateItem[];
}

export interface UpdateReportInput {
  description?: string;
  latitude?: number;
  longitude?: number;
  locationSource?: LocationSource;
}

export interface FieldUpdateInput {
  note: string;
}

export type ReportSyncOutcome = 'Created' | 'Existing' | 'Invalid' | 'Conflict';

export interface ReportSyncResultItem {
  clientId: string;
  outcome: ReportSyncOutcome;
  report?: ReportSummary;
  errors?: { field: string; message: string }[];
}

export interface ResolvedLocation {
  districtId: number;
  code: string;
  name: string;
  province: string;
  /** Distance from the GPS point to the district centroid. */
  distanceKm: number;
}

export interface PhotoInfo {
  mimeType: PhotoMimeType;
  sizeBytes: number;
}
