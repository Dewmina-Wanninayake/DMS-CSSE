# UC-JOINT-001 — Dispatch and Coordinate Emergency Response (Member 4)

## Files
`server/src/modules/emergency-response/` — `domain/` (TeamStatusMachine, units, allocation rules, types), `repositories/`,
`services/` (Dispatch, Allocation, Reversal, Resupply, ShelterQuery, Dashboard), `controllers/`, `schemas/`, `routes.ts`,
`index.ts` (composition root), `errors.ts`, `__tests__/`.
`server/src/db/migrations/401_emergency_response_init.sql` · `server/src/db/seeds/401_emergency_response.seed.ts`.

## Critique traceability
| Finding | Where |
|---|---|
| #1 two sub-flows | DispatchService (A) / AllocationService (B) |
| #2 shelters read-only | ShelterRepository has no write methods (tested); no shelter write route |
| #3 summary + confirm | `POST /dispatches/preview`, `/allocations/preview` write nothing |
| #4 controller + domain objects | Controller → services → repositories; rules in `domain/` |
| #5 one transaction | `AllocationService.create` (`BEGIN IMMEDIATE` + guarded `UPDATE … WHERE quantity >= ?`) |
| #6 actor + transitions | `TeamStatusMachine`; only the assigned team's leader may move status |
| #7 instructions, one unit, reversal | `instructions` field; `unit` enum CHECK; append-only ledger + `ReversalService` |
| #8 resupply | `ResupplyService`, `POST /resupply-requests` |
| #9 full shelter | `SHELTER_FULL` with alternatives |

## Assumptions about the Phase-0 foundation (verify when it merges)
1. `core/http/errors` exports `AppError(code, status, message, details?)`; the error middleware reads `status`/`code`/`details`.
2. `@dms/shared` exports `Role` with `JointOpsLead`, `RescueTeamLeader`, `ShelterCoordinator`.
3. `requireAuth` sets `req.user = { sub: number, role }`. Guards and `validate()` are injected via `HttpToolkit` (see `index.ts`).
4. Tables `districts(id, name)` and `users(id, role)` exist. `__tests__/test-db.ts` stubs them; replace with the foundation's migrate.
5. A `ResponseNotifier` adapter over `NotificationService` is supplied by the composition call; it must not throw.
6. Registry line: `createEmergencyResponseModule(db, notifier, http)` returns the Router to mount at `/api/v1`.

## Decisions
- Shelter-full (3a) is checked when the destination of an allocation is a shelter.
- Team cancel is allowed only before `OnSite`.
- Stock and quantities are whole numbers.

## Remaining work
Client module (dashboard, teams, dispatch, inventory, allocation, error states); redirect request to the Shelter Coordinator
for 3a (currently the alternatives are returned for the UI to show); a read endpoint for a team leader's own dispatches;
screenshots vs hi-fi pp. 33–39; lint/format run in the real repo.

## Tests
`npx vitest run --coverage` → 102 tests, ≥ 99 % statements/lines, 100 % functions in this module.
