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

## 4a. Extensions and fixes added after the first delivery

| Step | Behaviour | Where |
|---|---|---|
| 7 | The reporter's outcome notification uses `related_type = HAZARD_REPORT_RELATED_TYPE` (`'HazardReport'`) from `@dms/shared`, which is what UC-CV-003's My Reports reads. It used `'hazard_report'` before, so no outcome ever reached My Reports | `ReportVerificationService.decide` |
| 10 | A warning at Warning or Emergency level is created `PendingApproval` and the **first** Second Approver on the roster is alerted | `WarningService.create`, `alertApprover` |
| 10a | A rejection issues nothing, leaves the report `Verified` and notifies the officer with the approver's reason | `WarningService.approve` |
| 10b | A warning that has waited more than `APPROVAL_RESPONSE_MINUTES` (15, in `@dms/shared`) is passed to the **next** approver on the roster (Second Approvers in id order, wrapping round). `escalation_count` and `last_escalated_at` (migration `102`) stop it re-alerting inside the same window. Run by an interval in `server.ts`; tested through the injected clock | `WarningService.escalateOverdueApprovals` |
| 14a | Correcting, lowering or withdrawing a Warning or Emergency, or correcting any warning up to that level, needs a Second Approver. The correction route admits both roles and the service decides | `WarningService.assertMayCorrect` |

`WarningNotifier` (`services/warning-notifier.ts`) owns everything a warning tells people (issue, withdrawal, rejection, approver alerts, delivery log, retries); `WarningService` only decides what is allowed.

The roster is "Second Approvers by user id" because the foundation has no duty-roster table. Replace `alertApprover` when one exists.

Tests added: `warning-approval.test.ts` (10a, 10b, 14a), `edge-cases.test.ts` (decision validation, duplicates, PendingSync flush, clientId idempotency, unknown ids) and `server/src/integration/cross-module.api.test.ts` (UC-CV-003 to UC-DIST-02 to UC-DA-001).

The client pages were aligned with the shared UI primitives (`Card`, `Select` children, `StepProgress` counter, `ConfirmDialog` children, `DistrictMap` markers) so `typecheck` and the 193 client tests pass.

## 5. Verification & Testing

- Unit tests written for domain rules, services, controllers, client API, components, and pages.
- Server coverage threshold met (>= 80%).
- Clean integration with foundation auth, database, notifications, and shared UI primitives.

---

## HTTP API contract

**Module:** `report-verification`  
**Base Path:** `/api/v1`  
**Owner:** Member 1 — IT23598928 (Wanninayake S P R B W M D D)

---

### 1. Overview

This API handles ground hazard report verification by Duty Officers, decision support (incorporating minimum evidence rules, nearby report corroboration, hydromet sensor readings, and active M2 policy warning criteria), reporter notifications, warning escalation previews, second-approver authorization for Warning/Emergency levels, per-channel broadcast delivery tracking (Push, SMS, AudibleAlert), offline synchronization (`PendingSync`), and warning corrections or withdrawals.

---

### 2. Endpoints

#### 2.1 GET `/verification/queue`
Lists pending ground hazard reports and warnings awaiting second approval.

- **Roles Allowed:** `DutyOfficer`, `SecondApprover`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "reports": [
        {
          "id": 1,
          "hazardType": "Flood",
          "description": "Rising water level near bridge",
          "districtName": "Colombo",
          "reportedAt": "2026-10-09T10:00:00.000Z",
          "hasPhoto": true,
          "locationSource": "Gps"
        }
      ],
      "pendingApprovals": [
        {
          "id": 10,
          "level": "Warning",
          "hazardType": "Flood",
          "reason": "Water level exceeded critical threshold",
          "status": "PendingApproval",
          "estimatedAudience": 2500000,
          "createdAt": "2026-10-09T11:00:00.000Z"
        }
      ]
    }
  }
  ```

---

#### 2.2 GET `/verification/reports/:id`
Retrieves report details along with decision support data (nearby reports within 2 km / 2 h, latest hydromet sensor reading, M2 warning criteria, and evidence rule evaluation).

- **Roles Allowed:** `DutyOfficer`, `SecondApprover`
- **Parameters:** `id` (integer)
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "hazardType": "Flood",
      "description": "Rising water level near bridge",
      "severity": "High",
      "status": "Pending",
      "latitude": 6.9271,
      "longitude": 79.8612,
      "locationSource": "Gps",
      "photoPath": "/uploads/photo1.jpg",
      "districtId": 1,
      "districtName": "Colombo",
      "reporterId": 5,
      "reporterName": "Kamal Perera",
      "reportedAt": "2026-10-09T10:00:00.000Z",
      "duplicateOf": null,
      "nearby": [
        {
          "id": 2,
          "hazardType": "Flood",
          "districtName": "Colombo",
          "reportedAt": "2026-10-09T10:30:00.000Z",
          "distanceKm": 0.45,
          "status": "Pending"
        }
      ],
      "latestSensor": {
        "stationName": "Kelani River - Nagalagam Street",
        "observedAt": "2026-10-09T10:15:00.000Z",
        "rainfallMm": 45.2,
        "riverLevelM": 5.8
      },
      "warningCriteria": {
        "hazardType": "Flood",
        "riskThreshold": 5,
        "mediumRatio": 0.5,
        "minDataPoints": 3,
        "sourcePolicyKey": "POL-2026-001"
      },
      "evidence": {
        "sufficient": true,
        "hasGps": true,
        "hasPhoto": true,
        "corroborationCount": 1,
        "reasons": ["GPS location verified", "Photo evidence present", "Corroborated by 1 nearby report"]
      },
      "decision": null,
      "notes": null
    }
  }
  ```
- **Response 404 Not Found:**
  ```json
  {
    "success": false,
    "error": { "code": "NOT_FOUND", "message": "Report 999 not found" }
  }
  ```

---

#### 2.3 POST `/verification/reports/:id/decision`
Records duty officer verification decision (`Verified`, `Rejected`, or `RequiresInformation`), updates hazard report status, and notifies reporter.

- **Roles Allowed:** `DutyOfficer`
- **Parameters:** `id` (integer)
- **Request Body:**
  ```json
  {
    "decision": "Verified",
    "severity": "High",
    "notes": "Verified against GPS + photo and sensor readings.",
    "duplicateOf": null
  }
  ```
- **Validation Rules:**
  - `decision`: Must be `Verified`, `Rejected`, or `RequiresInformation`.
  - `severity`: Required when decision is `Verified`.
  - `notes`: Required (min 5 chars) when decision is `Rejected` or `RequiresInformation`.
  - `duplicateOf`: If provided, must be a valid existing report ID different from `:id`.
- **Response 200 OK:** Returns updated `ReportReview` object.
- **Response 422 Unprocessable:** If decision is `Verified` but minimum evidence rule is not satisfied (`INSUFFICIENT_EVIDENCE`).

---

#### 2.4 POST `/warnings/preview`
Calculates estimated target audience and determines whether second approval or audience confirmation is required.

- **Roles Allowed:** `DutyOfficer`
- **Request Body:**
  ```json
  {
    "reportId": 1,
    "level": "Warning",
    "areaIds": [1, 2],
    "language": "English",
    "channels": ["Push", "SMS"]
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "estimatedAudience": 3250000,
      "requiresAudienceConfirm": true,
      "requiresApproval": true,
      "districts": [
        { "id": 1, "name": "Colombo", "population": 2326000 },
        { "id": 2, "name": "Gampaha", "population": 2300000 }
      ],
      "warningCriteria": { "hazardType": "Flood", "riskThreshold": 5 },
      "language": "English",
      "channels": ["Push", "SMS"]
    }
  }
  ```

---

#### 2.5 POST `/warnings`
Creates and escalates an emergency warning. Issues immediately for `Advisory`, `Watch`, `AllClear`, or sets to `PendingApproval` for `Warning` or `Emergency`. Handles `PendingSync` when client is offline.

- **Roles Allowed:** `DutyOfficer`
- **Request Body:**
  ```json
  {
    "reportId": 1,
    "level": "Warning",
    "areaIds": [1],
    "reason": "Water levels exceeding safety margin in low-lying zones.",
    "language": "Sinhala",
    "channels": ["Push", "SMS", "AudibleAlert"],
    "confirmedAudience": true,
    "pendingSync": false
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "success": true,
    "data": {
      "id": 10,
      "reportId": 1,
      "hazardType": "Flood",
      "level": "Warning",
      "reason": "Water levels exceeding safety margin in low-lying zones.",
      "language": "Sinhala",
      "status": "PendingApproval",
      "syncStatus": "Synced",
      "areaIds": [1],
      "areaNames": ["Colombo"],
      "channels": ["Push", "SMS", "AudibleAlert"],
      "estimatedAudience": 2326000,
      "createdBy": 2,
      "issuedAt": null,
      "createdAt": "2026-10-09T11:00:00.000Z"
    }
  }
  ```

---

#### 2.6 POST `/warnings/:id/approval`
Approves or rejects a warning awaiting second authorization.

- **Roles Allowed:** `SecondApprover`
- **Parameters:** `id` (integer)
- **Request Body:**
  ```json
  {
    "decision": "Approved",
    "notes": "Escalation justified based on weather radar."
  }
  ```
- **Response 200 OK:** Returns updated `WarningDto`.

---

#### 2.7 POST `/warnings/:id/correction`
Corrects an active warning (adjusting level, reason, areas) or withdraws it.

- **Roles Allowed:** `DutyOfficer`, `SecondApprover`. The approval rule of step 10 applies (extension 14a, critique DIST-02 #7 and #8): correcting, lowering or withdrawing a warning at **Warning or Emergency** level, or correcting any warning up to one of those levels, needs a `SecondApprover`. A `DutyOfficer` gets `403 FORBIDDEN` for those and may still correct lower levels.
- **Parameters:** `id` (integer)
- **Request Body:**
  ```json
  {
    "action": "Correct",
    "level": "Watch",
    "reason": "Water level receding; level downgraded to Watch.",
    "areaIds": [1]
  }
  ```
- **Response 200 OK:** Returns updated `WarningDto`.

---

#### 2.8 GET `/warnings/:id/delivery`
Retrieves per-channel broadcast delivery status log for a warning.

- **Roles Allowed:** `DutyOfficer`, `SecondApprover`
- **Parameters:** `id` (integer)
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "warning": { "id": 10, "status": "Issued" },
      "deliveries": [
        {
          "id": 101,
          "channel": "Push",
          "recipient": "RescueTeamLeader",
          "deliveryStatus": "Sent",
          "retryCount": 0,
          "lastError": null,
          "sentAt": "2026-10-09T11:05:00.000Z"
        }
      ]
    }
  }
  ```

---

#### 2.9 GET `/hazard-team-rules`
Lists default mapping rules between hazard types and target DMC rescue/ops teams.

- **Roles Allowed:** `DutyOfficer`, `SecondApprover`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": [
      { "hazardType": "Flood", "role": "RescueTeamLeader" },
      { "hazardType": "Landslide", "role": "RescueTeamLeader" },
      { "hazardType": "BlockedRoad", "role": "JointOpsLead" },
      { "hazardType": "Other", "role": "RegionalAdmin" }
    ]
  }
  ```
