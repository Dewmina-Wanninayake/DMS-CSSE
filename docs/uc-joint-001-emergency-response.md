# UC-JOINT-001 — Dispatch and Coordinate Emergency Response (Member 4)

Owner: Member 4, IT23571334 (Malliyawatta D V). Source: Group 03 pp. 29–46 → Group 02 critique JOINT #1–#9, UC-SHL-001 #3, Interaction #1–#4.
**Status: server and client delivered and integrated into the main app.** Screenshots against the hi-fi (pp. 33–39) are still to be taken.

## Files

### Server — `server/src/modules/emergency-response/`

`domain/` (TeamStatusMachine, units, allocation rules, types) · `repositories/` (shelter, team, dispatch, resource, allocation, resupply, destination) · `services/` (Dispatch, Allocation, Reversal, Resupply, ShelterQuery, Dashboard) · `controllers/` · `schemas/` · `router.ts` (routes and guards) · `routes.ts` (composition root and the registry entry `createEmergencyResponseRouter`, same role as `routes.ts` in the other modules) · `errors.ts` · `__tests__/`.
`server/src/db/migrations/401_emergency_response_init.sql` · `server/src/db/seeds/modules/emergency-response.seed.ts` (run by `npm run db:seed`).
Registered in `server/src/modules/registry.ts` (one line).

### Client — `client/src/modules/emergency-response/` (desktop screens)

| Screen                       | Page                                                    | Scenario            |
| ---------------------------- | ------------------------------------------------------- | ------------------- |
| Emergency Response Dashboard | `ResponseDashboardPage`                                 | 1, 2, 2a            |
| Shelter detail (read only)   | `ShelterDetailPage`                                     | 3, 3a               |
| Rescue Team Coordination     | `TeamCoordinationPage`                                  | A1, A1a, A4a, A6    |
| Dispatch form, summary, confirm | `DispatchPage`                                       | A2, A2a, A3, A4     |
| My dispatches (team leader)  | `MyDispatchesPage`                                      | A5, A5a             |
| Resource Inventory           | `ResourceInventoryPage`                                 | B1                  |
| Allocation form, summary, confirm, reverse | `AllocationPage`                          | B2, B3, B3a, B4, B4a, B5, B5a |

The allocation screen is a page of four components (`AllocationForm`, `AllocationSummaryCard`, `AllocationAlerts`, `AllocationResult`) driven by `hooks/useAllocationFlow.ts`, which holds every rule about what the lead may do next. Also `api/emergency-response.api.ts`, `components/badges.tsx` (text labels, never colour alone), `components/StaleDataBanner.tsx` (2a), `lib/constants.ts`, `module.tsx`. Shared contract: `shared/src/modules/emergency-response.ts`.

## Critique traceability

| Finding                         | Where                                                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| #1 two sub-flows                | `DispatchService` (A) / `AllocationService` (B); Dispatch and Allocation are separate screens                                          |
| #2 shelters read-only           | `ShelterRepository` has no write methods (tested); no shelter write route (tested through the app: PUT/PATCH/POST return 404)          |
| #3 summary and confirm          | `POST /dispatches/preview`, `/allocations/preview` write nothing; both screens show a summary before confirm                           |
| #4 controller and domain objects| controller → services → repositories; rules in `domain/`                                                                              |
| #5 one transaction              | `AllocationService.create` (`BEGIN IMMEDIATE` and a guarded `UPDATE … WHERE quantity >= ?`); a stale confirm shows the current quantity |
| #6 actor and transitions        | `TeamStatusMachine`; only the assigned team's leader moves the status; `GET /dispatches/mine` feeds the leader's screen                |
| #7 instructions, one unit, reversal | `instructions` field; `Unit` enum with a CHECK; append-only ledger and `ReversalService`; reversing entry, never an edit         |
| #8 resupply                     | `ResupplyService`; the insufficient-stock alert has "Request resupply" for the shortfall                                               |
| #9 full shelter                 | `SHELTER_FULL` with alternatives; `POST /shelters/:id/redirect-requests` notifies the Shelter Coordinator                              |
| Strategy pattern | `services/destination-resolvers.ts`: one resolver per destination type (shelter must have space; area and team must exist). `AllocationService` asks the matching resolver, so a new destination type needs no change to the service |
| Table 13 enumerations           | `Priority` Low, Normal, High, Urgent · `DestinationType` Shelter, Area, Team · `Unit` Kilogram, Litre, Unit, Pallet                    |

## Integration changes made when the module was moved into the main app

1. Moved from `emergency-response-module/server/src/modules/modules/emergency-response` to `server/src/modules/emergency-response`; migration and seed to `server/src/db`.
2. `AppError(statusCode, code, …)` argument order of the real foundation; tests read `.statusCode`.
3. Controller reads the user from `currentUser(req)` (`{ id, role }`). It read `req.user.sub`, so every authenticated write answered 500 against the real JWT guard. The fake guard in the route tests hid it; `__tests__/integration.test.ts` now drives the real app.
4. Guards attached per route instead of `router.use(authenticate)`, which answered 401 for other modules' unauthenticated paths.
5. Core `validate()` result is written back to `req.body` so coerced numbers and trimmed text reach the controller.
6. Enumerations aligned with Table 13 (they were Low/Medium/High/Critical, Shelter/Dispatch and kg/litre/piece/box/pack). Migration 401 was edited in place because nothing had been deployed from it.
7. New: `DestinationRepository` (Area and Team destinations), `GET /dispatches/mine`, `POST /shelters/:id/redirect-requests`, `generatedAt` and `areas` on the dashboard.
8. Zod 4 syntax in the schemas (`error:` instead of `errorMap` and `invalid_type_error`).

## Assumptions and decisions

- Shelter-full (3a) is checked when the destination of an allocation is a shelter.
- Team cancel is allowed only before `OnSite`.
- Stock and quantities are whole numbers.
- An Area destination is a district; a Team destination is a rescue team.
- Offline (2a): the client shows a banner with the last-updated time and disables Confirm while offline. Stock is re-checked by the server on every confirm, so nothing is held as Pending Sync for this use case.

## Tests

Server: `npx vitest run --coverage` over the module is above 95 % statements. Client: 60 tests over the seven screens, API contract and badges.

## Remaining work

Screenshots against the hi-fi pp. 33–39.

---

## HTTP API contract

Base path `/api/v1`. All routes need `Authorization: Bearer <JWT>`. Envelope and status codes follow plan §3.6.
Roles: **Ops** = JointOpsLead · **Lead** = RescueTeamLeader. Types: `shared/src/modules/emergency-response.ts`.

Enumerations are the critique's Table 13: `Priority` = Low, Normal, High, Urgent · `DestinationType` = Shelter, Area, Team · `Unit` = Kilogram, Litre, Unit, Pallet · dispatch status = Dispatched, EnRoute, OnSite, Completed (plus Cancelled for A4a).

| Method & path                       | Role      | Request                                                                                       | Success                                                                                               | Errors                                                                           |
| ----------------------------------- | --------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| GET `/response/dashboard`           | Ops       | –                                                                                             | 200 `{ generatedAt, kpis, activeDispatches, shelters, teams, resources, areas }`                      | 401 403                                                                          |
| GET `/shelters?districtId=`         | Ops, Lead | –                                                                                             | 200 `Shelter[]` (read-only)                                                                           | 401 403 400                                                                      |
| GET `/shelters/:id`                 | Ops, Lead | –                                                                                             | 200 `Shelter`                                                                                         | 404                                                                              |
| POST `/shelters/:id/redirect-requests` | Ops    | `{ note? }`                                                                                   | 201 `{ shelterId, status: "Requested", alternatives }`; the Shelter Coordinator is notified (3a)      | 404 400                                                                          |
| GET `/rescue-teams`                 | Ops       | –                                                                                             | 200 `RescueTeam[]` (agency, leaderName, location, availability)                                      |                                                                                  |
| POST `/dispatches/preview`          | Ops       | `{ location, priority, teamId, instructions? }`                                               | 200 summary (A3), writes nothing                                                                      | 400 404 422 `TEAM_UNAVAILABLE`                                                   |
| POST `/dispatches`                  | Ops       | same                                                                                          | 201 + `Location`; status `Dispatched`; leader notified                                                | 400 404 422 `TEAM_UNAVAILABLE`                                                   |
| GET `/dispatches/mine`              | Lead      | –                                                                                             | 200 `Dispatch[]` open dispatches of the caller's own team                                             |                                                                                  |
| PATCH `/dispatches/:id/status`      | Lead (own team) | `{ status: EnRoute\|OnSite\|Completed }`                                                | 200 `Dispatch`                                                                                        | 403 404 409 `INVALID_STATE_TRANSITION` (A5a, `details.allowed`)                  |
| POST `/dispatches/:id/cancel`       | Ops       | `{ reason, replacementTeamId? }`                                                              | 200 `{ cancelled, replacement }` (A4a)                                                                | 400 404 409 422                                                                  |
| GET `/resources`                    | Ops       | –                                                                                             | 200 `Resource[]` + `quantityLabel`, `lowStock`                                                        |                                                                                  |
| POST `/allocations/preview`         | Ops       | `{ resourceId, quantity, destinationType: Shelter\|Area\|Team, destinationId, instructions? }` | 200 summary (B3)                                                                                      | 400 404 422 `INSUFFICIENT_STOCK` (B3a), 422 `SHELTER_FULL` (3a)                  |
| POST `/allocations`                 | Ops       | same                                                                                          | 201 + `Location`; stock re-checked and deducted in one transaction                                    | 409 `STALE_STOCK` (B4a, `details.currentQuantity`), 422 `SHELTER_FULL`           |
| POST `/allocations/:id/reversal`    | Ops       | `{ reason }`                                                                                  | 201 `Reversal` entry; stock restored (B5a)                                                            | 404 409 `ALREADY_REVERSED` 422 `NOT_REVERSIBLE`                                  |
| POST `/resupply-requests`           | Ops       | `{ resourceId, quantity, note? }`                                                             | 201 `ResupplyRequest` (B3a)                                                                           | 400 404                                                                          |

Destination ids: `Shelter` is a `shelters.id`, `Area` is a `districts.id` (listed in `dashboard.areas`), `Team` is a `rescue_teams.id`.

Validation: location, priority, team required · quantity whole number, above zero and not above the stock in the resource's own unit · destination type and id must exist · status move must be legal · reversal and cancel need a reason (3 characters or more).

Module error codes: `TEAM_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `STALE_STOCK`, `SHELTER_FULL`, `ALREADY_REVERSED`, `NOT_REVERSIBLE` (plus shared `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE_TRANSITION`).
`SHELTER_FULL.details.alternatives` lists shelters with room (same district first).

Guards are attached per route (never `router.use`), so another module's paths still reach their own guards.
