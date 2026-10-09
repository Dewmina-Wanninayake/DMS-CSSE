# DMS-CSSE — Smart Disaster Early-Warning and Emergency Coordination System (SE3070 Assignment 02)

Everything written down lives in [`docs/`](docs/README.md): one file per use case (delivery notes and HTTP API contract) and the integration checklist.

## Layout

```
client/src/
  app/                 router and module registry (one line per module)
  shared/              design tokens, UI primitives, api client, auth, hooks
  modules/<module>/    module.tsx  api/ components/ hooks/ lib/ pages/ __tests__/
server/src/
  core/                http, auth, db, notifications, hydromet, test helpers
  db/migrations/       NNN_<module>_*.sql (1xx verification, 2xx analytics, 3xx reporting, 4xx response)
  db/seeds/            dev-seed.ts, modules/<module>.seed.ts, seed-cli.ts
  modules/<module>/    routes.ts (entry the registry imports)  controllers/ services/
                       repositories/ domain/ schemas/ __tests__/
  integration/         tests that drive several modules through the real app
shared/src/            enums.ts api.ts auth.ts (foundation); modules/<module>.ts (use-case contracts)
docs/                  one file per use case (notes + API contract), integration checklist
```

## Setup

```
npm install
copy .env.example .env        # set JWT_SECRET (>= 16 chars)
npm run db:migrate
npm run db:seed               # development users/data; password = SEED_DEFAULT_PASSWORD
npm run dev                   # API :4000, client :5173
```

## Sign in (for markers)

`npm run db:seed` creates every account below and fills each use case with realistic data (reports in every state, warnings, policies, dispatches, allocations). The seed is safe to run again. The **password for every account is `ChangeMe-Dev-2026`** (set `SEED_DEFAULT_PASSWORD` to change it). In development the sign-in screen also lists the accounts: click one to fill the form.

| Use case | Email | Role | What to try |
| --- | --- | --- | --- |
| UC-CV-003 Submit ground report | `citizen@dms.lk` | Citizen | Report a hazard; My reports shows Pending, Verified, Rejected and "More information needed" (with Update report) |
| | `citizen2@dms.lk` | Citizen | A second reporter whose road report is linked to the first as a duplicate |
| | `volunteer@dms.lk` | Volunteer | Field update on a report in Kegalle, Ratnapura or Colombo |
| UC-DIST-02 Verify report and escalate warning | `officer@dms.lk` | Duty Officer | Queue, decisions, warnings, delivery status, correction |
| | `approver@dms.lk` | Second Approver | One Emergency warning (Gampaha) is waiting for approval |
| | `approver2@dms.lk` | Second Approver | Next on the roster if the first does not respond |
| UC-DA-001 Analyse trends and formulate policy | `analyst@dms.lk` | Disaster Analyst | Trends, risk map, policy wizard with simulation, an approved, a rejected (revised), a pending and a draft policy |
| | `director@dms.lk` | Policy Director | Approve or reject the pending policy |
| UC-JOINT-001 Dispatch and coordinate response | `joint@dms.lk` | Joint Ops Lead | Dashboard, dispatch, allocate, reverse, resupply, shelter redirect |
| | `teamlead@dms.lk` | Rescue Team Leader | Alpha team is on site: finish the dispatch |
| | `teamlead2@dms.lk`, `teamlead3@dms.lk` | Rescue Team Leader | Bravo (just dispatched) and Charlie teams |
| | `shelter@dms.lk`, `regional@dms.lk` | Shelter Coordinator, Regional Admin | Receive notifications; no screens of their own |

The account list lives in one place, `shared/src/demo-accounts.ts`, and the server seed and the sign-in screen both read it.

## Quality gates

```
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run test:coverage -w server -- --coverage.include='src/modules/<module>/**'
```

Requires Node ≥ 22.9.
