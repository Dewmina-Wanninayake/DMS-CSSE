# API Contract: Report Verification & Warning Escalation (UC-DIST-02)

**Module:** `report-verification`  
**Base Path:** `/api/v1`  
**Owner:** Member 1 — IT23598928 (Wanninayake S P R B W M D D)

---

## 1. Overview

This API handles ground hazard report verification by Duty Officers, decision support (incorporating minimum evidence rules, nearby report corroboration, hydromet sensor readings, and active M2 policy warning criteria), reporter notifications, warning escalation previews, second-approver authorization for Warning/Emergency levels, per-channel broadcast delivery tracking (Push, SMS, AudibleAlert), offline synchronization (`PendingSync`), and warning corrections or withdrawals.

---

## 2. Endpoints

### 2.1 GET `/verification/queue`
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

### 2.2 GET `/verification/reports/:id`
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

### 2.3 POST `/verification/reports/:id/decision`
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

### 2.4 POST `/warnings/preview`
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

### 2.5 POST `/warnings`
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

### 2.6 POST `/warnings/:id/approval`
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

### 2.7 POST `/warnings/:id/correction`
Corrects an active warning (adjusting level, reason, areas) or withdraws it.

- **Roles Allowed:** `DutyOfficer`
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

### 2.8 GET `/warnings/:id/delivery`
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

### 2.9 GET `/hazard-team-rules`
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
