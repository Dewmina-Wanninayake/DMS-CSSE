# UC-DA-001 — Analyze Disaster Trends and Formulate Mitigation Policies

Owner: Member 2, IT23599086 (Serasinghe D H). Source: Group 03 pp. 9–13 → Group 02 critique §9 (DA #1–#9), §11.4 revised scenario, Fig. 7.

## Delivered

**Server** `server/src/modules/policy-analytics/`: `domain/` (period, risk-classifier [Strategy], trend-calculator, simulation-model [Strategy], policy-state-machine [State], regulatory-conflict-checker, identifiers, submission-rules) · `repositories/` (settings, hazard-data, trend-report, policy, simulation, reference) · `services/` (trend-report, policy-draft, policy-query, policy-submission, policy-review, simulation, settings, assembler, messages) · `controllers/` · `schemas/` (zod) · `routes.ts` (composition root) · `__tests__/` (8 files).
**Client** `client/src/modules/policy-analytics/`: `module.tsx` (routes + nav) · pages: Dashboard (analyst + director), HighRiskZones, TrendAnalysis, PolicyList, PolicyWizard (4 steps), PolicyDetail, DirectorReview · components: badges, TrendFilterForm, TrendResults, PolicyForm, SimulationPanel, PolicyParts · hooks: pending-drafts, usePendingDrafts · api · constants.
**Database** `server/src/db/migrations/201_policy_analytics_init.sql`: `policy_settings`, `historical_incidents`, `hazard_profiles`, `regulatory_rules`, `trend_reports`, `policies`, `policy_reviews`, `policy_simulations`.
**Contract**: `shared/src/policy-analytics.ts`, `docs/api/policy-analytics.md`.

## Scenario coverage

| Step / extension                                | Implemented in                                                              | Tested in                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| 1 dashboard (login deleted, DA #5)              | `DashboardPage`                                                             | pages-analytics                                    |
| 2–4 report, threshold rule, saved report (DA #4)| `TrendReportService`, `ThresholdRiskClassifier`, `TrendFilterForm/Results`  | analytics.api, risk-and-trend, components          |
| 3 data sources incl. hydromet (DA #9)           | `HydrometProvider` (core) adapter                                           | analytics.api (available / unavailable)            |
| 3a sparse data                                  | `isSparse`, banner                                                          | analytics.api, components, pages-analytics         |
| 5–6 formulate, pre-filled draft                 | `PolicyDraftService.createDraft`, wizard                                    | policy.api, pages-policy                           |
| 7 optional simulation (DA #2)                   | `SimulationService`, `RuleBasedSimulationModel`, `SimulationPanel`          | simulation-model, policy.api, pages-policy         |
| 8–9 submit, format check, version, notify       | `PolicySubmissionService`                                                   | policy.api, policy-rules                           |
| 8a regulatory conflict                          | `findRegulatoryConflicts`, 422, `ConflictList`                              | policy-rules, policy.api, pages-policy             |
| 9a offline → Pending Sync                       | `pending-drafts`, `usePendingDrafts`, `POST /policies/sync`                 | pending-drafts, policy.api, pages-policy           |
| 10–11, 13 Director approve/reject (DA #1)       | `PolicyReviewService`, `DirectorReviewPage`                                 | policy.api, pages-policy                           |
| 10a rejection → revise as new version           | `PolicyDraftService.revise`                                                 | policy.api, pages-policy                           |
| 12 notify stakeholders; criteria read by UC-DIST-02 (DA #8) | `NotificationService`, `GET /policies/active/warning-criteria` | policy.api                                         |
| 12a failed delivery logged and retried          | `NotificationService.retryFailed` + scheduler in `server.ts`                | policy.api, foundation                             |

## Shared pieces introduced (Phase 0 foundation)

Server `core/`: http (envelope, errors, validate, error-handler), auth (password, token, middleware, auth routes), db (connection, migrate, district & user repositories), notifications (service, repository, in-app gateway), hydromet provider, `time.ts` (business day), `context`/`create-context`, `testing/test-env`. Migrations `001`, `002`. `modules/registry.ts`.
Client `shared/`: styles (tokens, base, components), ui (Button, Card/TileLink/ListItem, feedback states, fields, StepProgress, ConfirmDialog, BarChart, PageHeader, DistrictMap, risk-colors), hooks (useAsync, useOnlineStatus), api-client, format, auth, layout (AppShell, navigation). `app/` (routes, LoginPage, moduleRegistry). `@dms/shared` enums, envelope types.

## Files modified in existing repo
None — the repository was empty (only local editor tooling files). Everything above is new.

## Environment variables
`.env.example`: `JWT_SECRET` (required), `PORT`, `DATABASE_PATH`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `APP_TIMEZONE`, `NOTIFICATION_RETRY_INTERVAL_MS`, `NOTIFICATION_MAX_RETRIES`, `SEED_DEFAULT_PASSWORD`, `VITE_API_BASE_URL`.

## Assumptions (ours, to be quoted in the report — critique said the original was "not testable as written")
A1 risk rule and Medium/Low bands; A2 sparsity = fewer than `minDataPoints` records; A3 trend vs equal previous period, ±10 % = Stable; A4 simulation formulas (parameters in `hazard_profiles`; only High/Medium or reported Low districts are modelled); A5 regulatory rules are phrase lists in `regulatory_rules` (illustrative); A6 revising an approved/rejected policy creates version n+1, approval supersedes earlier approval. Also: notifications use the `Push` channel (the critique's `Channel` enum has no email); hydromet data is read from `hydromet_observations` (no live feed); business day = `APP_TIMEZONE`.

## Integration points / remaining work for others
- UC-DIST-02 (Member 1): read `GET /policies/active/warning-criteria`; set `hazard_reports.status='Verified'`, `verified_at`; extend gateway with SMS/AudibleAlert.
- UC-CV-003 (Member 3): insert `hazard_reports` (columns already provisioned); set `duplicate_of` for linked duplicates (analytics excludes them).
- UC-JOINT-001 (Member 4): nothing consumed; `districts` shared.
- Group report: insert revised wireframes (critique §11.5 TODO), state assumptions A1–A6.
- Not built: policy impact monitoring (DA #2), multi-signature approval, settings UI, live Met feed, real SMS/email.
