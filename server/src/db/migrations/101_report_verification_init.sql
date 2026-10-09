-- UC-DIST-02 Verify Ground Hazard Report and Escalate Warning (owner: Member 1, IT23598928)

CREATE TABLE report_verifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id    INTEGER NOT NULL UNIQUE REFERENCES hazard_reports(id),
  officer_id   INTEGER NOT NULL REFERENCES users(id),
  decision     TEXT NOT NULL CHECK (decision IN ('Verified','Rejected','RequiresInformation')),
  notes        TEXT,
  severity     TEXT CHECK (severity IN ('Low','Medium','High','Critical')),
  duplicate_of INTEGER REFERENCES hazard_reports(id),
  decided_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE warnings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id           INTEGER NOT NULL REFERENCES hazard_reports(id),
  hazard_type         TEXT NOT NULL CHECK (hazard_type IN ('Flood','Landslide','BlockedRoad','Other')),
  level               TEXT NOT NULL CHECK (level IN ('Advisory','Watch','Warning','Emergency','AllClear')),
  reason              TEXT NOT NULL,
  language            TEXT NOT NULL CHECK (language IN ('Sinhala','Tamil','English')),
  status              TEXT NOT NULL CHECK (status IN ('Draft','PendingApproval','Issued','Corrected','Withdrawn')),
  sync_status         TEXT NOT NULL DEFAULT 'Synced' CHECK (sync_status IN ('Synced','PendingSync')),
  estimated_audience  INTEGER NOT NULL,
  created_by          INTEGER NOT NULL REFERENCES users(id),
  client_id           TEXT UNIQUE,
  issued_at           TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_warnings_status ON warnings (status, sync_status);

CREATE TABLE warning_areas (
  warning_id  INTEGER NOT NULL REFERENCES warnings(id) ON DELETE CASCADE,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  PRIMARY KEY (warning_id, district_id)
);

CREATE TABLE warning_channels (
  warning_id INTEGER NOT NULL REFERENCES warnings(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL CHECK (channel IN ('Push','SMS','AudibleAlert')),
  PRIMARY KEY (warning_id, channel)
);

CREATE TABLE warning_approvals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  warning_id  INTEGER NOT NULL REFERENCES warnings(id),
  approver_id INTEGER NOT NULL REFERENCES users(id),
  decision    TEXT NOT NULL CHECK (decision IN ('Approved','Rejected')),
  notes       TEXT,
  decided_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- DIST-02 #9: hazard type maps to the DMC team that is notified on issue.
CREATE TABLE hazard_team_rules (
  hazard_type TEXT PRIMARY KEY CHECK (hazard_type IN ('Flood','Landslide','BlockedRoad','Other')),
  role        TEXT NOT NULL
);
INSERT INTO hazard_team_rules (hazard_type, role) VALUES
  ('Flood', 'RescueTeamLeader'),
  ('Landslide', 'RescueTeamLeader'),
  ('BlockedRoad', 'JointOpsLead'),
  ('Other', 'RegionalAdmin');
