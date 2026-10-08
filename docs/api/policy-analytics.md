# API contract — policy-analytics (UC-DA-001)

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

**Rules.** High risk: verified, non-duplicate reports in the district and period `>` `riskThreshold`; Medium `≥ threshold × mediumRatio`; else Low. "Today" is the date in `APP_TIMEZONE` (default `Asia/Colombo`). Approving a policy that carries `warningRiskThreshold` updates the setting returned by `warning-criteria`. Types: `shared/src/policy-analytics.ts`.
