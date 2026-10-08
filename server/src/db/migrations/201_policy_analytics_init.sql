-- UC-DA-001 Analyze Disaster Trends and Formulate Mitigation Policies (owner: Member 2, IT23599086)

-- "Risk threshold stored in the policy settings" (revised step 4, critique DA #4). One row per hazard
-- type; `source_policy_id` records the approved policy that last changed it (critique DA #8).
CREATE TABLE policy_settings (
  hazard_type      TEXT PRIMARY KEY CHECK (hazard_type IN ('Flood','Landslide','BlockedRoad','Other')),
  risk_threshold   REAL NOT NULL CHECK (risk_threshold > 0),
  medium_ratio     REAL NOT NULL CHECK (medium_ratio > 0 AND medium_ratio < 1),
  min_data_points  INTEGER NOT NULL CHECK (min_data_points >= 1),
  source_policy_id INTEGER,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO policy_settings (hazard_type, risk_threshold, medium_ratio, min_data_points) VALUES
  ('Flood', 5, 0.5, 3), ('Landslide', 5, 0.5, 3), ('BlockedRoad', 5, 0.5, 3), ('Other', 5, 0.5, 3);

-- Archival incident records ("historical disaster databases", step 3).
CREATE TABLE historical_incidents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  hazard_type TEXT NOT NULL CHECK (hazard_type IN ('Flood','Landslide','BlockedRoad','Other')),
  occurred_at TEXT NOT NULL,
  summary     TEXT NOT NULL
);
CREATE INDEX idx_historical_scope ON historical_incidents (hazard_type, district_id, occurred_at);

-- Parameters of the simulation model (assumption A4); kept in data, not code.
CREATE TABLE hazard_profiles (
  hazard_type                  TEXT PRIMARY KEY CHECK (hazard_type IN ('Flood','Landslide')),
  footprint_ratio              REAL NOT NULL,
  evacuation_rate_per_team_hr  REAL NOT NULL,
  water_litres_per_person_day  REAL NOT NULL,
  food_kg_per_person_day       REAL NOT NULL,
  medicine_kits_per_100_people REAL NOT NULL,
  planning_days                INTEGER NOT NULL,
  avg_shelter_capacity         INTEGER NOT NULL
);
INSERT INTO hazard_profiles VALUES
  ('Flood',     0.20, 150, 15, 0.6, 5, 3, 400),
  ('Landslide', 0.05, 100, 15, 0.6, 8, 3, 400);

-- Representative national-standard clauses used by extension 8a. Phrase matching is deliberately
-- simple and explainable; maintaining the real rule set is out of scope (the team plan §9.4).
CREATE TABLE regulatory_rules (
  code             TEXT PRIMARY KEY,
  description      TEXT NOT NULL,
  forbidden_phrases TEXT NOT NULL
);
INSERT INTO regulatory_rules (code, description, forbidden_phrases) VALUES
  ('REG-RIVER-RESERVE', 'Construction inside river reserves and flood plains is prohibited.',
   '["construction within river reserve","build within river reserve","allow construction in flood plain","permit building in river reserve"]'),
  ('REG-LANDSLIDE-ZONE', 'No new settlement on slopes classified as landslide high-hazard.',
   '["allow construction in landslide zone","permit building on unstable slopes","allow settlement on unstable slopes"]'),
  ('REG-EVACUATION', 'Mandatory evacuation orders cannot be waived once issued.',
   '["waive mandatory evacuation","cancel mandatory evacuation"]'),
  ('REG-PUBLIC-WARNING', 'Official warnings must not be withheld from the public.',
   '["withhold warnings from the public","suppress public warnings"]');

CREATE TABLE trend_reports (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  analyst_id   INTEGER NOT NULL REFERENCES users(id),
  hazard_type  TEXT NOT NULL,
  district_ids TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL,
  sparse       INTEGER NOT NULL CHECK (sparse IN (0, 1)),
  result_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Policy as modelled in the revised class diagram: version, status, approvedBy (policy_reviews), effectiveDate.
CREATE TABLE policies (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_key            TEXT NOT NULL,
  version               INTEGER NOT NULL CHECK (version >= 1),
  status                TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','PendingApproval','Approved','Rejected')),
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  hazard_type           TEXT NOT NULL,
  trend_report_id       INTEGER NOT NULL REFERENCES trend_reports(id),
  district_ids          TEXT NOT NULL,
  mitigation_strategies TEXT NOT NULL DEFAULT '',
  land_use_guidelines   TEXT NOT NULL DEFAULT '',
  resource_rules        TEXT NOT NULL DEFAULT '',
  warning_risk_threshold REAL,
  proposed_effective_date TEXT,
  effective_date        TEXT,
  superseded_by         INTEGER REFERENCES policies(id),
  author_id             INTEGER NOT NULL REFERENCES users(id),
  client_id             TEXT UNIQUE,
  submitted_at          TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (policy_key, version)
);
CREATE INDEX idx_policies_status ON policies (status, hazard_type);

CREATE TABLE policy_reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id   INTEGER NOT NULL REFERENCES policies(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  decision    TEXT NOT NULL CHECK (decision IN ('Approved','Rejected')),
  comments    TEXT NOT NULL,
  decided_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_policy_reviews_policy ON policy_reviews (policy_id);

CREATE TABLE policy_simulations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id   INTEGER NOT NULL REFERENCES policies(id),
  reference   TEXT NOT NULL UNIQUE,
  hazard_type TEXT NOT NULL,
  input_json  TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_policy_simulations_policy ON policy_simulations (policy_id);
