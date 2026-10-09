# Integration checklist (team plan §6.9, Phase 5)

Automated version: `server/src/integration/cross-module.api.test.ts` (runs with `npm test`). The manual walk-through below is for the demo and for Phase 7 sign-off.

## Set-up

```
npm install
copy .env.example .env      # set JWT_SECRET
npm run db:migrate && npm run db:seed
npm run dev                 # server :4000, client :5173
```

Every seeded user has the password in `SEED_DEFAULT_PASSWORD`:
`citizen@dms.lk`, `volunteer@dms.lk`, `officer@dms.lk`, `approver@dms.lk`, `analyst@dms.lk`, `director@dms.lk`, `joint@dms.lk`, `teamlead@dms.lk`.

## Walk-through

| #   | As                | Do                                                                                       | Expect                                                                                                 | Modules          |
| --- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------- |
| 1   | `citizen`         | Report hazard: type, description, a photo, confirm the GPS pin, submit                   | "Report submitted"; My Reports shows **Pending**                                                       | CV-003           |
| 2   | `citizen`         | Switch the browser to offline, report again                                              | "Saved offline, Pending Sync"; going online uploads it                                                 | CV-003           |
| 3   | `officer`         | Verification queue → open the report → Verified with a severity                          | Allowed because the report has GPS **and** a photo (`photo_path` is set when a photo is saved)         | DIST-02, CV-003  |
| 4   | `citizen`         | My Reports                                                                               | **Verified** with the officer's message (needs `related_type = 'HazardReport'`)                        | CV-003, DIST-02  |
| 5   | `officer`         | Raise a *Warning* level warning from the verified report                                 | Needs a Second Approver; the first approver is alerted                                                 | DIST-02          |
| 6   | `approver`        | Warning approvals → approve                                                              | Issued; Delivery status shows Sent / Failed per channel                                                | DIST-02          |
| 7   | `analyst`         | Trends → Flood, the district of the report, this month                                   | The verified report is counted; risk level uses the policy threshold                                   | DA-001, DIST-02  |
| 8   | `analyst`         | Formulate policy with a warning risk threshold, submit                                   | `PendingApproval`                                                                                      | DA-001           |
| 9   | `director`        | Review → approve                                                                         | Published; `GET /api/v1/policies/active/warning-criteria` returns the new threshold                    | DA-001           |
| 10  | `officer`         | Open the next report                                                                     | Decision support shows the new threshold (DA #8)                                                       | DIST-02, DA-001  |
| 11  | `joint`           | Dashboard → shelters                                                                     | Occupancy is shown read only; a full shelter offers "Request redirect"                                 | JOINT-001        |
| 12  | `joint`           | Rescue teams → Dispatch a team → review → confirm                                        | Team Dispatched; the team leader is notified                                                           | JOINT-001        |
| 13  | `teamlead`        | My dispatches → mark en route → on site → completed                                      | Each step in order; an illegal move shows the allowed transitions                                      | JOINT-001        |
| 14  | `joint`           | Resources → allocate → review → confirm; then reverse it                                 | Stock goes down once; the reversal restores it and keeps both rows                                     | JOINT-001        |

## Contracts the modules rely on

| Provider  | Consumer  | Contract                                                                                       |
| --------- | --------- | ---------------------------------------------------------------------------------------------- |
| CV-003    | DIST-02   | `hazard_reports` rows with `status = 'Pending'`; `photo_path` set when a photo is saved        |
| DIST-02   | CV-003    | notification with `related_type = HAZARD_REPORT_RELATED_TYPE` addressed to the reporter        |
| DIST-02   | DA-001    | `status = 'Verified'`, `verified_at`, `duplicate_of` on `hazard_reports`                       |
| DA-001    | DIST-02   | `GET /api/v1/policies/active/warning-criteria`                                                 |
| Foundation | all      | `users`, `districts`, `notifications`, `NotificationService`, `HydrometProvider`, shared UI    |
