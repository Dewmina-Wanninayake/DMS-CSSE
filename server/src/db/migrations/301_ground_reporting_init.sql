-- UC-CV-003 Submit Disaster Ground Report (owner: Member 3, IT23554054).
-- Core `hazard_reports` already exists (001); this migration only adds this module's own tables.

-- Tunables the Duty Officer / operators may change (team plan §3.12: no magic numbers in services).
-- Read by DuplicateDetector (critique CV-003 #6: duplicates are linked, never blocked).
CREATE TABLE report_settings (
  key         TEXT PRIMARY KEY,
  value       REAL NOT NULL CHECK (value > 0),
  description TEXT NOT NULL
);
INSERT INTO report_settings (key, value, description) VALUES
  ('duplicate_radius_m',       200, 'Reports of the same hazard type within this distance (metres) are linked as duplicates.'),
  ('duplicate_window_minutes',  60, 'Reports of the same hazard type within this time window (minutes) are linked as duplicates.');

-- One optional photo per report (critique CV-003 #2). Stored as a BLOB so the project needs no file
-- storage setup; the 2 MB cap (#6) is enforced by PhotoValidator and again here.
CREATE TABLE report_photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  INTEGER NOT NULL UNIQUE REFERENCES hazard_reports(id),
  mime_type  TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
  data       BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- History of what happened to a report after submission: the citizen answering a
-- NeedsInformation request (#3) and certified-volunteer field updates (#7).
CREATE TABLE report_updates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id  INTEGER NOT NULL REFERENCES hazard_reports(id),
  author_id  INTEGER NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL CHECK (kind IN ('CitizenUpdate','VolunteerFieldUpdate')),
  note       TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 200),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_report_updates_report ON report_updates (report_id, created_at);

-- Which district(s) a volunteer is certified for: "field updates only by certified volunteers for
-- their area" (critique CV-003 #7).
CREATE TABLE volunteer_certifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  district_id  INTEGER NOT NULL REFERENCES districts(id),
  certified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, district_id)
);

-- "My Reports" and the duplicate scan both filter by these.
CREATE INDEX idx_hazard_reports_reporter ON hazard_reports (reporter_id, reported_at);
CREATE INDEX idx_hazard_reports_dup_scan ON hazard_reports (hazard_type, reported_at);
