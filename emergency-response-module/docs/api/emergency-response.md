# API contract — emergency-response (UC-JOINT-001)

Base path `/api/v1`. All routes need `Authorization: Bearer <JWT>`. Envelope and status codes follow plan §3.6.
Roles: **Ops** = JointOpsLead · **Lead** = RescueTeamLeader.

| Method & path | Role | Request | Success | Errors |
|---|---|---|---|---|
| GET `/response/dashboard` | Ops | – | 200 `{ kpis, activeDispatches, shelters, teams, resources }` | 401 403 |
| GET `/shelters?districtId=` | Ops, Lead | – | 200 `Shelter[]` (read-only) | 401 403 400 |
| GET `/shelters/:id` | Ops, Lead | – | 200 `Shelter` | 404 |
| GET `/rescue-teams` | Ops | – | 200 `RescueTeam[]` (agency, leaderName, location, availability) | |
| POST `/dispatches/preview` | Ops | `{ location, priority, teamId, instructions? }` | 200 summary (A1) — writes nothing | 400 404 422 `TEAM_UNAVAILABLE` |
| POST `/dispatches` | Ops | same | 201 + `Location`; status `Dispatched`; leader notified | 400 404 422 `TEAM_UNAVAILABLE` |
| PATCH `/dispatches/:id/status` | Lead (own team) | `{ status: EnRoute\|OnSite\|Completed }` | 200 `Dispatch` | 403 404 409 `INVALID_STATE_TRANSITION` (A5a) |
| POST `/dispatches/:id/cancel` | Ops | `{ reason, replacementTeamId? }` | 200 `{ cancelled, replacement }` (A4a) | 400 404 409 422 |
| GET `/resources` | Ops | – | 200 `Resource[]` + `quantityLabel`, `lowStock` | |
| POST `/allocations/preview` | Ops | `{ resourceId, quantity, destinationType: Shelter\|Dispatch, destinationId, instructions? }` | 200 summary (B3) | 400 404 422 `INSUFFICIENT_STOCK` (B3a), 422 `SHELTER_FULL` (3a) |
| POST `/allocations` | Ops | same | 201 + `Location`; stock re-checked and deducted in one transaction | 409 `STALE_STOCK` (B4a, `details.currentQuantity`), 422 `SHELTER_FULL` |
| POST `/allocations/:id/reversal` | Ops | `{ reason }` | 201 `Reversal` entry; stock restored (B5a) | 404 409 `ALREADY_REVERSED` 422 `NOT_REVERSIBLE` |
| POST `/resupply-requests` | Ops | `{ resourceId, quantity, note? }` | 201 `ResupplyRequest` (B3a) | 400 404 |

Validation: location, priority, team required · quantity whole number, > 0, ≤ available in the resource's own unit ·
destination type + id must exist · status move must be legal · reversal and cancel need a reason (≥ 3 chars).

Module error codes: `TEAM_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `STALE_STOCK`, `SHELTER_FULL`, `ALREADY_REVERSED`, `NOT_REVERSIBLE`
(plus shared `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE_TRANSITION`).
`SHELTER_FULL.details.alternatives` lists shelters with room (same district first).
