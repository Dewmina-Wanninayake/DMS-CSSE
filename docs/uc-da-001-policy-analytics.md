# UC-DA-001 — Analyze Disaster Trends and Formulate Mitigation Policies

Owner: Member 2, IT23599086 (Serasinghe D H). Source: Group 03 pp. 9–13 → Group 02 critique §9 (DA #1–#9), §11.4 revised scenario, Fig. 7.

## Delivered

**Server** `server/src/modules/policy-analytics/`: `domain/` (period, risk-classifier [Strategy], trend-calculator, simulation-model [Strategy], policy-state-machine [State], regulatory-conflict-checker, identifiers, submission-rules) · `repositories/` (settings, hazard-data, trend-report, policy, simulation, reference) · `services/` (trend-report, policy-draft, policy-query, policy-submission, policy-review, simulation, settings, assembler, messages) · `controllers/` · `schemas/` (zod) · `routes.ts` (composition root) · `__tests__/` (8 files).
**Client** `client/src/modules/policy-analytics/`: `module.tsx` (routes + nav) · pages: Dashboard (analyst + director), HighRiskZones, TrendAnalysis, PolicyList, PolicyWizard (entry and loaders), PolicyDetail, DirectorReview · components: badges, TrendFilterForm, TrendResults, PolicyForm, `PolicyWizard` (the four steps), SimulationPanel, PolicyParts · hooks: `usePolicyWizard` (saving, offline fallback, simulation, regulatory pre-check, submit), `usePendingDrafts` · lib: `constants`, `pending-drafts` (device storage for 9a) · api.
**Database** `server/src/db/migrations/201_policy_analytics_init.sql`: `policy_settings`, `historical_incidents`, `hazard_profiles`, `regulatory_rules`, `trend_reports`, `policies`, `policy_reviews`, `policy_simulations`.
**Contract**: `shared/src/modules/policy-analytics.ts`; the HTTP contract is in the last section of this file.

## Scenario coverage

| Step / extension                                | Implemented in                                                              | Tested in                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| 1 dashboard (login deleted, DA #5)              | `DashboardPage`                                                             | analytics-pages                                    |
| 2–4 report, threshold rule, saved report (DA #4)| `TrendReportService`, `ThresholdRiskClassifier`, `TrendFilterForm/Results`  | analytics.api, risk-and-trend, components          |
| 3 data sources incl. hydromet (DA #9)           | `HydrometProvider` (core) adapter                                           | analytics.api (available / unavailable)            |
| 3a sparse data                                  | `isSparse`, banner                                                          | analytics.api, components, analytics-pages         |
| 5–6 formulate, pre-filled draft                 | `PolicyDraftService.createDraft`, wizard                                    | policy.api, policy-pages                           |
| 7 optional simulation (DA #2)                   | `SimulationService`, `RuleBasedSimulationModel`, `SimulationPanel`          | simulation-model, policy.api, policy-pages         |
| 8–9 submit, format check, version, notify       | `PolicySubmissionService`                                                   | policy.api, policy-rules                           |
| 8a regulatory conflict                          | `findRegulatoryConflicts`, 422, `ConflictList`                              | policy-rules, policy.api, policy-pages             |
| 9a offline → Pending Sync                       | `pending-drafts`, `usePendingDrafts`, `POST /policies/sync`                 | pending-drafts, policy.api, policy-pages           |
| 10–11, 13 Director approve/reject (DA #1)       | `PolicyReviewService`, `DirectorReviewPage`                                 | policy.api, policy-pages                           |
| 10a rejection → revise as new version           | `PolicyDraftService.revise`                                                 | policy.api, policy-pages                           |
| 12 notify stakeholders; criteria read by UC-DIST-02 (DA #8) | `NotificationService`, `GET /policies/active/warning-criteria` | policy.api                                         |
| 12a failed delivery logged and retried          | `NotificationService.retryFailed` + scheduler in `server.ts`                | policy.api, foundation                             |

## Shared pieces introduced (Phase 0 foundation)

Server `core/`: http (envelope, errors, validate, error-handler), auth (password, token, middleware, auth routes), db (connection, migrate, district & user repositories), notifications (service, repository, in-app gateway), hydromet provider, `time.ts` (business day), `context`/`create-context`, `testing/test-env`. Migrations `001`, `002`. `modules/registry.ts`.
Client `shared/`: styles (tokens, base, components), ui (Button, Card/TileLink/ListItem, feedback states, fields, StepProgress, ConfirmDialog, BarChart, PageHeader, DistrictMap, risk-colors), hooks (useAsync, useOnlineStatus), api-client, format, auth, layout (AppShell, navigation). `app/` (routes, LoginPage, moduleRegistry). `@dms/shared` enums, envelope types.

## Files modified in existing repo
None at the time of delivery (the repository was empty). Later, by the team: the other three modules were registered in `modules/registry.ts` and `moduleRegistry.ts`, and shared UI gained `Radio`, `AuthImage`, `DistrictMap onPick` and utility CSS classes. All are additive.

## Environment variables
`.env.example`: `JWT_SECRET` (required), `PORT`, `DATABASE_PATH`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `APP_TIMEZONE`, `NOTIFICATION_RETRY_INTERVAL_MS`, `NOTIFICATION_MAX_RETRIES`, `SEED_DEFAULT_PASSWORD`, `VITE_API_BASE_URL`.

## Assumptions (ours, to be quoted in the report — critique said the original was "not testable as written")
A1 risk rule and Medium/Low bands; A2 sparsity = fewer than `minDataPoints` records; A3 trend vs equal previous period, ±10 % = Stable; A4 simulation formulas (parameters in `hazard_profiles`; only High/Medium or reported Low districts are modelled); A5 regulatory rules are phrase lists in `regulatory_rules` (illustrative); A6 revising an approved/rejected policy creates version n+1, approval supersedes earlier approval. Also: notifications use the `Push` channel (the critique's `Channel` enum has no email); hydromet data is read from `hydromet_observations` (no live feed); business day = `APP_TIMEZONE`.

## Match to the Group 03 high-fidelity screens (PDF p.15, printed p.13)

The Analyst hi-fi shows six phone screens. Ours are desktop-first with the same screens and the same navy/white card language; the differences below are decisions from the critique, not omissions.

| Group 03 screen | Ours | Difference and reason |
| --- | --- | --- |
| `analyst-dashboard` | Dashboard | Four tiles and "Latest verified ground reports" kept; the "Field report verification" tile and tab are removed (DA #6, verification belongs to UC-DIST-02); desktop sidebar below 1024 px collapses to the hi-fi bottom tabs (Interaction #1) |
| `map-view-high-risk-zones` | High-risk zones | San Francisco map replaced by a Sri Lankan Leaflet map with Zone A/B/C overlays (DA #7) |
| `verify-field-report` | not built | Moved to UC-DIST-02 (DA #6) |
| `policy-update-create-new` | Policy wizard steps 1-2 | True "Step n of 4" counter (C8); sentence-case labels (Interaction #4) |
| `disaster-simulation-result` | Policy wizard step 3 | Optional step (DA #2); states that it is a planning aid, not a forecast |
| `review-publish-policy` | Policy wizard step 4, Director review | "Publish" became "Submit for approval"; the Director gets Reject / Approve and publish (DA #1) |

Screenshots of every screen are kept outside the repository (`DMS-CSSE-Screenshots/IT23599086-uc-da-001-policy-analytics`). Sign in as `analyst@dms.lk` or `director@dms.lk` (see the README for the password) on the seeded data.

## Integration points / remaining work for others
- UC-DIST-02 (Member 1): reads `GET /policies/active/warning-criteria` for its decision support and sets `hazard_reports.status='Verified'` and `verified_at`. Done and covered end to end by `server/src/integration/cross-module.api.test.ts` (verified report counted in a trend report, approved policy threshold visible to the officer).
- UC-CV-003 (Member 3): inserts `hazard_reports` and links `duplicate_of`; analytics excludes linked duplicates. Done.
- UC-JOINT-001 (Member 4): consumes nothing; `districts` is shared.
- Group report: insert the revised wireframes (critique §11.5 is still a TODO) and state assumptions A1–A6.
- Not built: policy impact monitoring (DA #2), multi-signature approval, settings UI, live Met feed, real SMS/email.

---

## HTTP API contract

Base path `/api/v1`. Envelope and status codes: the team plan §3.6. Roles: **A** = DisasterAnalyst, **D** = PolicyDirector. Every route needs `Authorization: Bearer <token>`; unlisted roles get 403.

| Method & path                           | Roles                 | Success   | Errors                                                                                                           |
| --------------------------------------- | --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /analytics/filters`                | A, D                  | 200       | —                                                                                                                |
| `GET /analytics/verified-reports/latest?limit=` | A, D          | 200       | 400 limit > 20                                                                                                   |
| `POST /analytics/trend-reports`         | A                     | 201       | 400 bad period / unknown district                                                                                |
| `GET /analytics/trend-reports`, `/:id`  | A, D                  | 200       | 404                                                                                                              |
| `GET /policies/settings`                | A, D                  | 200       | —                                                                                                                |
| `PUT /policies/settings/:hazardType`    | D                     | 200       | 400                                                                                                              |
| `GET /policies/active/warning-criteria` | A, D, DutyOfficer, SecondApprover | 200 | — **Consumed by UC-DIST-02** (critique DA #8)                                                           |
| `POST /policies/drafts`                 | A                     | 201 / 200 (existing `clientId`) | 400, 404 trend report, 409 foreign `clientId`                                              |
| `POST /policies/sync`                   | A                     | 200 (per-draft `Created`/`Existing`/`Conflict`) | 400                                                                         |
| `GET /policies?status=&mine=&page=&pageSize=` | A, D            | 200 + meta | 400                                                                                                             |
| `GET /policies/:id`                     | A, D                  | 200       | 404 (also for other users' drafts)                                                                               |
| `PATCH /policies/:id`                   | A (author)            | 200       | 400, 403, 409 not a draft                                                                                        |
| `GET /policies/:id/conflicts`           | A                     | 200 list  | 404                                                                                                              |
| `POST /policies/:id/submit`             | A (author)            | 200       | 400 incomplete, 403, 409 state, **422 `REGULATORY_CONFLICT`** (details = clauses)                                |
| `POST /policies/:id/review`             | D                     | 200       | 400 (reject needs ≥ 5-char comments; date in past), 409 not pending                                              |
| `POST /policies/:id/revise`             | A (author)            | 201       | 409 not rejected/approved, or already revised                                                                    |
| `POST /policies/:id/simulations`        | A (author)            | 201       | 400, 409 not a draft, **422 `UNSUPPORTED_HAZARD`**, **422 `NO_AT_RISK_DISTRICTS`**                               |
| `GET /policies/:id/simulations`         | A, D                  | 200       | 404                                                                                                              |
| `GET /policies/:id/notifications`       | A, D                  | 200       | 404                                                                                                              |

**Rules.** High risk: verified, non-duplicate reports in the district and period `>` `riskThreshold`; Medium `≥ threshold × mediumRatio`; else Low. "Today" is the date in `APP_TIMEZONE` (default `Asia/Colombo`). Approving a policy that carries `warningRiskThreshold` updates the setting returned by `warning-criteria`. Types: `shared/src/modules/policy-analytics.ts`.
