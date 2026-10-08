-- Foundation (owner: Member 2 authored, reviewed by Member 1). Shared by every module.
-- Additive changes to these tables need a `shared` PR (the team plan §6.6).

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Citizen','Volunteer','DutyOfficer','SecondApprover','DisasterAnalyst','PolicyDirector','JointOpsLead','RescueTeamLeader','ShelterCoordinator','RegionalAdmin')),
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE districts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL UNIQUE,
  province   TEXT NOT NULL,
  latitude   REAL NOT NULL,
  longitude  REAL NOT NULL,
  population INTEGER NOT NULL,
  area_km2   REAL NOT NULL
);

-- HazardReport as modelled in the revised class diagram (critique §11.2). Written by UC-CV-003,
-- decided by UC-DIST-02, read (Verified only) by UC-DA-001.
CREATE TABLE hazard_reports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       TEXT UNIQUE,
  reporter_id     INTEGER NOT NULL REFERENCES users(id),
  hazard_type     TEXT NOT NULL CHECK (hazard_type IN ('Flood','Landslide','BlockedRoad','Other')),
  description     TEXT NOT NULL,
  severity        TEXT CHECK (severity IN ('Low','Medium','High','Critical')),
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected','NeedsInformation')),
  sync_status     TEXT NOT NULL DEFAULT 'Synced' CHECK (sync_status IN ('Synced','PendingSync')),
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  location_source TEXT NOT NULL DEFAULT 'Gps' CHECK (location_source IN ('Gps','Manual')),
  district_id     INTEGER NOT NULL REFERENCES districts(id),
  photo_path      TEXT,
  duplicate_of    INTEGER REFERENCES hazard_reports(id),
  reported_at     TEXT NOT NULL,
  verified_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_hazard_reports_analytics ON hazard_reports (status, hazard_type, district_id, reported_at);

CREATE TABLE hydromet_observations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id   INTEGER NOT NULL REFERENCES districts(id),
  station_name  TEXT NOT NULL,
  observed_at   TEXT NOT NULL,
  rainfall_mm   REAL NOT NULL CHECK (rainfall_mm >= 0),
  river_level_m REAL NOT NULL
);
CREATE INDEX idx_hydromet_district_time ON hydromet_observations (district_id, observed_at);

-- Notification as modelled in the revised class diagram: deliveryStatus, recipient, retryCount.
CREATE TABLE notifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id),
  recipient         TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('Push','SMS','AudibleAlert')),
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  delivery_status   TEXT NOT NULL DEFAULT 'Pending' CHECK (delivery_status IN ('Pending','Sent','Failed')),
  retry_count       INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  related_type      TEXT NOT NULL,
  related_id        INTEGER NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at           TEXT
);
CREATE INDEX idx_notifications_related ON notifications (related_type, related_id);
CREATE INDEX idx_notifications_retry ON notifications (delivery_status, retry_count);
