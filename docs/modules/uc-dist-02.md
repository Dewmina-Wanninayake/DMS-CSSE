# Module Delivery Note: UC-DIST-02 (Verify Ground Hazard Report and Escalate Warning)

**Module ID:** `UC-DIST-02`  
**Server Directory:** `server/src/modules/report-verification/`  
**Client Directory:** `client/src/modules/report-verification/`  
**Owner:** Member 1 — IT23598928 (Wanninayake S P R B W M D D)

---

## 1. Executive Summary

This module implements UC-DIST-02 *Verify Ground Hazard Report and Escalate Warning* according to the Group 02 critique recommendations. It provides a full verification queue for Duty Officers, decision support tools (map with 2 km / 2 h nearby report cluster detection, hydromet sensor readings, M2 policy criteria, evidence rule evaluation), reporter notification triggers, warning escalation workflow with second-approver checks for `Warning` and `Emergency` levels, multi-channel broadcast gateway integration (`Push`, `SMS`, `AudibleAlert`), `PendingSync` offline queuing, per-channel delivery logging and retries, hazard-type team notifications, and warning correction/withdrawal functionality.

---

## 2. Critique Findings Implemented

| ID | Critique Finding | Implementation Details |
|---|---|---|
| **DIST-02 #1** | Verification comes first; sequence matches scenario | Report review & decision precedes warning creation flow. |
| **DIST-02 #2** | Delete pasted policy step; notify reporter | Policy creation removed from Duty Officer; automated notification sent to reporter upon decision. |
| **DIST-02 #3** | Decision support & minimum evidence rule | `MinimumEvidenceRule` requires (GPS + Photo) OR Corroboration by nearby reports before `Verified` status can be granted. |
| **DIST-02 #4** | Notification gateway layering | Core `NotificationService` routes delivery through `ChannelRouterGateway` strategies. |
| **DIST-02 #5** | Clean scope boundaries | Auth / Login handled by shared foundation middleware. |
| **DIST-02 #6** | Single `RequiresInformation` state | Unified state in DB (`NeedsInformation`) and enum (`RequiresInformation`). |
| **DIST-02 #7** | Second approver flow & warning correction | `Warning` and `Emergency` levels require `SecondApprover` signoff. Issued warnings can be corrected or withdrawn. |
| **DIST-02 #8** | Level downgrading & AllClear | Warnings can be downgraded to lower levels (including `AllClear`). |
| **DIST-02 #9** | Hazard-type team mapping & preview choices | `hazard_team_rules` table maps hazard type to DMC team; warning preview allows selecting language and delivery channels. |
| **Interaction #2** | Audience size confirmation & reversal | Requires explicit checkbox confirmation if estimated audience exceeds 10,000. |
| **Interaction #3** | Offline banner & PendingSync | Offline mode sets `syncStatus = 'PendingSync'` and renders `OfflineBanner`. |
| **Interaction #4** | High contrast accessibility | UI styled using design tokens with WCAG-compliant contrast and visible focus indicators. |

---

## 3. Architecture & Key Files

### Backend (`server/src/modules/report-verification/`)
- `routes.ts`: Defines Express routes with authentication and role authorization (`DutyOfficer`, `SecondApprover`).
- `controllers/verification.controller.ts`: Endpoint handlers for verification queue, review, and decisions.
- `controllers/warning.controller.ts`: Endpoint handlers for warning preview, creation, approval, correction, and delivery tracking.
- `services/report-verification.service.ts`: Business logic for report review, nearby report calculation (haversine 2 km / 2 h), evidence assessment, decision validation, and reporter notifications.
- `services/warning.service.ts`: State machine enforcement, audience estimation, second approval routing, gateway delivery, offline sync, and correction handling.
- `domain/evidence-rule.ts`: `MinimumEvidenceRule` Strategy implementation.
- `domain/warning-state-machine.ts`: Allowed warning status state transitions (`Draft` -> `PendingApproval` -> `Issued`, `Corrected`, `Withdrawn`).
- `domain/audience-estimator.ts`: Calculates total target district population and checks confirmation thresholds.
- `repositories/`: Database abstraction layers for reports, verifications, warnings, and criteria.

### Database Migration
- `server/src/db/migrations/101_report_verification_init.sql`: Creates `report_verifications`, `warnings`, `warning_areas`, `warning_channels`, `warning_approvals`, and `hazard_team_rules`.

### Frontend (`client/src/modules/report-verification/`)
- `api/reportVerificationApi.ts`: Client API client module using shared fetcher envelope.
- `hooks/`: `useVerificationQueue.ts`, `useReportReview.ts`, `useWarningPreview.ts`, `useWarningDelivery.ts`.
- `components/`: `DecisionSupportCard.tsx`, `NearbyReportsList.tsx`, `DecisionForm.tsx`, `CorrectionModal.tsx`.
- `pages/`:
  - `VerificationQueuePage.tsx`: Duty Officer queue for ground reports and pending approvals.
  - `ReportReviewPage.tsx`: Detailed report review with Leaflet map, nearby report list, sensor readings, and decision form.
  - `WarningPreviewPage.tsx`: Warning creation wizard with area selection, estimated audience preview, channel selection, and audience confirmation.
  - `SecondApproverPage.tsx`: Second Approver queue for reviewing high-severity warnings.
  - `DeliveryStatusPage.tsx`: Channel delivery status log, retry trigger, and correction/withdrawal dialog.

---

## 4. Scenario Step Traceability Matrix

| Step ID | Description | Verified Implementation |
|---|---|---|
| 1 | Officer views verification queue | `GET /verification/queue` -> `VerificationQueuePage.tsx` |
| 2 | Officer reviews report with map & nearby reports | `GET /verification/reports/:id` -> `ReportReviewPage.tsx` |
| 3 | Decision support assesses minimum evidence rule | `MinimumEvidenceRule.assess()` evaluates GPS, photo, and 2 km / 2 h corroboration |
| 4 | Hydromet sensor reading & M2 criteria loaded | Hydromet provider query + `GET /policies/active/warning-criteria` fallback |
| 5 | Decision recorded & reporter notified | `POST /verification/reports/:id/decision` -> `notifyUser()` |
| 6 | Escalate warning preview & audience estimate | `POST /warnings/preview` -> `AudienceEstimator.estimate()` |
| 7 | Second approver authorization | `POST /warnings/:id/approval` -> `SecondApproverPage.tsx` |
| 8 | Multi-channel broadcast & per-channel tracking | `ChannelRouterGateway` -> `GET /warnings/:id/delivery` |
| 9 | Hazard-type team notification | `hazard_team_rules` lookup -> `notifyRoles()` |
| 10 | Warning correction / level downgrade / withdrawal | `POST /warnings/:id/correction` -> `CorrectionModal.tsx` |
| 11 | Offline sync handling | Client offline status -> `syncStatus: PendingSync` |

---

## 5. Verification & Testing

- Unit tests written for domain rules, services, controllers, client API, components, and pages.
- Server coverage threshold met (>= 80%).
- Clean integration with foundation auth, database, notifications, and shared UI primitives.
