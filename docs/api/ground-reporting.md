# API contract — ground-reporting (UC-CV-003 Submit Disaster Ground Report)

Owner: Member 3, IT23554054. Base path `/api/v1`. Envelope, status codes and pagination: the team plan §3.6. Roles: **C** = Citizen, **V** = Volunteer, **O** = DutyOfficer / SecondApprover (read-only photo access for UC-DIST-02). Every route needs `Authorization: Bearer <token>` (login required, critique CV-003 #6); unlisted roles get 403. Types and limits: `shared/src/ground-reporting.ts`.

| Method & path                      | Roles | Success                        | Errors                                                                                       |
| ---------------------------------- | ----- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `GET /reports/hazard-types`        | C, V  | 200 list                       | —                                                                                            |
| `POST /reports`                    | C, V  | 201 + `Location` / 200 (existing `clientId`) | 400 validation, 409 `clientId` owned by another user                             |
| `PUT /reports/:id/photo`           | C, V (owner) | 200 `PhotoInfo`         | 403 not owner, 404, 409 report no longer editable, **422 `PHOTO_TOO_LARGE`**, **422 `PHOTO_INVALID_TYPE`** |
| `GET /reports/:id/photo`           | C, V (owner), O | 200 image bytes      | 403, 404 (also when the report has no photo)                                                 |
| `POST /reports/sync`               | C, V  | 200 (per-report outcome)       | 400 (bad batch shape / > 20 items)                                                           |
| `GET /reports/mine?status=&page=&pageSize=` | C, V | 200 + meta            | 400                                                                                          |
| `GET /reports/:id`                 | C, V (owner) | 200 `ReportDetail`      | 403 not owner, 404                                                                           |
| `PATCH /reports/:id`               | C, V (owner) | 200 `ReportDetail`      | 400, 403, 404, **409 `INVALID_STATE_TRANSITION`** unless status is `NeedsInformation`        |
| `POST /reports/:id/field-updates`  | V     | 201 `ReportUpdateItem`         | 400, **403 `NOT_CERTIFIED_FOR_AREA`**, 404, 409 report is `Rejected`                          |
| `GET /locations/resolve?lat=&lng=` | C, V  | 200 `ResolvedLocation`         | 400 outside Sri Lanka bounds                                                                 |

Static paths (`/reports/hazard-types`, `/reports/mine`, `/reports/sync`) are declared before `/reports/:id`.

## Request rules (zod, server-authoritative; same limits in `@dms/shared` for the client)

`POST /reports` and each item of `POST /reports/sync`:

| Field            | Rule                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `clientId`       | optional on `POST /reports`, **required** on sync; UUID                                               |
| `hazardType`     | `Flood` \| `Landslide` \| `BlockedRoad` \| `Other`                                                    |
| `description`    | trimmed, 0–200 chars; **1–200 when `hazardType = Other`** (description rule)                               |
| `latitude`       | number within 5.8 – 9.95                                                                              |
| `longitude`      | number within 79.4 – 82.0                                                                             |
| `locationSource` | `Gps` \| `Manual` (manual pin after GPS failure)                                        |
| `reportedAt`     | optional ISO-8601 UTC; defaults to server time; not more than 5 minutes in the future                 |

`PATCH /reports/:id`: any of `description` (same rule), `latitude` + `longitude` + `locationSource` together; at least one field required. `POST /reports/:id/field-updates`: `note` trimmed, 1–200 chars. `PUT /reports/:id/photo`: raw body with `Content-Type: image/jpeg` or `image/png`, 1 byte – 2 097 152 bytes (2 MB exactly is accepted, 2 MB + 1 is not), magic bytes must match the declared type.

## Behaviour

- **Submit.** Resolves the district from the coordinates (nearest district centroid), links duplicates, inserts `hazard_reports` with `status = Pending`, `sync_status = Synced`. The Pending row *is* the officer queue (UC-DIST-02 reads `status = 'Pending'`). `severity` is never set by this module (critique CV-003 #1).
- **Idempotency.** Same `clientId` + same user → 200 with the existing report, no second row. `clientId` owned by another user → 409.
- **Duplicates (critique #6).** A new report is linked when an existing report has the same `hazardType`, is not `Rejected`, and lies within `duplicate_radius_m` and `duplicate_window_minutes` of the new one's location and `reportedAt` (both limits inclusive, read from `report_settings`; defaults 200 m / 60 min). `duplicate_of` points to the earliest matching report (lowest id on a tie), or to that report's own original if it is itself a duplicate, so links never chain. It is never blocked and still reaches the officer queue. UC-DA-001 already excludes `duplicate_of IS NOT NULL`.
- **Photo.** Optional everywhere (#2): a report is complete without one. Two calls because the global JSON body limit is 1 MB: create the report, then `PUT` the photo (compressed on device to ≤ 2 MB). Allowed while the report is `Pending` or `NeedsInformation`. A body above the parser limit (4 MB) gets the same 422 `PHOTO_TOO_LARGE` as one above 2 MB, never a 500.
- **Sync.** Items are processed **in the given order**, each independently: `Created`, `Existing` (same `clientId` already stored), `Invalid` (+ `errors`), `Conflict` (`clientId` owned by someone else). One bad item never fails the batch. The server always stores `sync_status = Synced`; **`PendingSync` exists only in the device queue** and is merged into My Reports on the client.
- **My Reports.** Newest `reportedAt` first. `outcome` is the latest notification row for this report written by UC-DIST-02 (`related_type = 'HazardReport'`, `related_id = report id`); null while `Pending`. `status` filter: `Pending`, `Verified`, `Rejected`, `NeedsInformation`.
- **Update report (#3).** Only the owner, only from `NeedsInformation`; applies the change, writes a `report_updates` row (`CitizenUpdate`) and moves the report to `Pending` so it re-enters the officer queue. Officer actions are not part of this module.
- **Field update (#7).** Volunteer must hold a `volunteer_certifications` row for the report's district, otherwise 403 `NOT_CERTIFIED_FOR_AREA`. Writes a `report_updates` row (`VolunteerFieldUpdate`); the report's status is unchanged.
- **Ownership.** `GET/PATCH /reports/:id` and the photo routes return 403 for another user's report (404 only when the id does not exist).

## Error codes

Core: `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE_TRANSITION`, `CONFLICT`. Module: `PHOTO_TOO_LARGE` (422), `PHOTO_INVALID_TYPE` (422), `NOT_CERTIFIED_FOR_AREA` (403).

## Tables (migration `301_ground_reporting_init.sql`)

`report_settings`, `report_photos` (one per report, BLOB, CHECK ≤ 2 MB), `report_updates`, `volunteer_certifications`; indexes on `hazard_reports (reporter_id, reported_at)` and `(hazard_type, district_id, reported_at)`.

## Assumptions to confirm (ours — the critique does not fix these)

1. `description` is optional except for `Other` (the plan lists "1–200 chars" and "Other requires description" separately).
2. Defaults 200 m / 60 min for duplicates; stored in `report_settings`, not code.
3. District resolution = nearest centroid (the `districts` table has centroids only, no boundaries).
4. Outcome text comes from `notifications` rows, because `report_verifications` is not in the repo yet; the `related_type` value `'HazardReport'` must be agreed with Member 1.
5. Field update is a free-text note only (the critique does not define more).
