# UC-CV-003 — Submit Disaster Ground Report

Owner: Member 3, IT23554054 (Rathnayake R M H D K). Source: Group 03 pp. 20–21 → Group 02 critique CV-003 #1–#7, Interaction #1.
**Status: server side delivered; client side (wizard, My Reports, offline queue) still to do.** Step and extension ids from critique §11.4 are not filled in yet; add them to the right-hand column when the revised scenario is open.

## Delivered (server)

`server/src/modules/ground-reporting/`: `domain/` (geo, duplicate-detector [Strategy], photo-validator, report-rules) · `repositories/` (report, photo, update, settings, certification, outcome) · `services/` (report-submission, report-sync, report-query, report-update, field-update, report-photo, report.assembler, report-access) · `controllers/` (report, photo) · `schemas/` (zod) · `routes.ts` (composition root) · `__tests__/` (10 files).
**Database** `server/src/db/migrations/301_ground_reporting_init.sql`: `report_settings`, `report_photos`, `report_updates`, `volunteer_certifications` + 2 indexes. Writes core `hazard_reports`.
**Contract**: `shared/src/ground-reporting.ts`, `docs/api/ground-reporting.md`.

## Critique coverage

| Finding | Implemented in | Tested in |
| --- | --- | --- |
| #1 no severity in the citizen flow | `ReportRepository.insert` never sets `severity` | submit.api |
| #2 photo optional everywhere | report is complete without `PUT …/photo` | submit.api, photo.api |
| #3 outcome notification + update-report extension | `OutcomeRepository`, `ReportUpdateService`, `statusAfterCitizenUpdate` | my-reports.api, update-and-field.api, report-rules |
| #4 offline, GPS failure, validation | `POST /reports/sync`, `locationSource = Manual`, zod schemas, `isWithinSriLanka` | sync.api, submit.api, geo |
| #5 states Pending, Verified, Rejected, NeedsInformation | `GET /reports/mine` (+ `PendingSync` on the device) | my-reports.api |
| #6 login required, duplicates linked, photo ≤ 2 MB, offline retention | route guards, `DuplicateDetector`, `PhotoValidator`, `clientId` idempotency | access.api, submit.api, photo.api, duplicate-detector, photo-validator |
| #7 volunteer field update | `FieldUpdateService`, `volunteer_certifications` | update-and-field.api |

## Assumptions (to quote in the report)

1. `description` is optional except for `Other`.
2. Duplicate defaults 200 m / 60 min, stored in `report_settings`; a Rejected report never counts as the original.
3. District = nearest centroid (no boundaries in `districts`).
4. Outcome text comes from `notifications` (`related_type = 'HazardReport'`, addressed to the reporter) because `report_verifications` does not exist yet.
5. Field update is a free-text note; the report's status does not change.
6. The server always stores `sync_status = Synced`; `PendingSync` lives only in the device queue.
7. NIC at registration (critique #6) is not built: the foundation has no registration (spec S6).

## Integration points

- UC-DIST-02 (Member 1): reads `hazard_reports` where `status = 'Pending'`; sets Verified / Rejected / NeedsInformation; writes a `notifications` row (`related_type = 'HazardReport'`, `related_id` = report id, recipient = reporter) so My Reports can show the outcome; may read `GET /reports/:id/photo` as DutyOfficer / SecondApprover.
- UC-DA-001 (Member 2): already excludes `duplicate_of IS NOT NULL` and reads Verified only.
- `shared` PR needed: one line in `shared/src/index.ts` (`export * from './ground-reporting';`). Optional dev seed for `volunteer_certifications` (the seeded `volunteer@dms.lk` is certified for nothing yet).

## Environment variables

None added.

## Remaining work

Client module (`client/src/modules/ground-reporting/`), its tests, screenshots, step ids in the table above, volunteer-certification seed.
