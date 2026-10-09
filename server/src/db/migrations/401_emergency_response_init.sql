-- UC-JOINT-001 Dispatch and Coordinate Emergency Response (Member 4, range 4xx).
-- Own tables only. `districts` and `users` belong to the foundation.

-- JOINT #2: shelters are READ-ONLY for this module; the Shelter Coordinator
-- (UC-SHL-001) is the only writer of occupancy.
CREATE TABLE IF NOT EXISTS shelters (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  address     TEXT    NOT NULL,
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS shelter_occupancy (
  shelter_id INTEGER PRIMARY KEY REFERENCES shelters(id),
  occupied   INTEGER NOT NULL DEFAULT 0 CHECK (occupied >= 0),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS rescue_teams (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL UNIQUE,
  agency         TEXT    NOT NULL,
  leader_name    TEXT    NOT NULL,
  leader_user_id INTEGER REFERENCES users(id),
  location       TEXT    NOT NULL,
  availability   TEXT    NOT NULL DEFAULT 'Available' CHECK (availability IN ('Available', 'Busy'))
);

-- JOINT #6: statuses and allowed transitions are enforced by TeamStatusMachine.
CREATE TABLE IF NOT EXISTS dispatches (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  location             TEXT    NOT NULL,
  priority             TEXT    NOT NULL CHECK (priority IN ('Low', 'Normal', 'High', 'Urgent')),
  team_id              INTEGER NOT NULL REFERENCES rescue_teams(id),
  instructions         TEXT,
  status               TEXT    NOT NULL
    CHECK (status IN ('Dispatched', 'EnRoute', 'OnSite', 'Completed', 'Cancelled')),
  cancel_reason        TEXT,
  replaces_dispatch_id INTEGER REFERENCES dispatches(id),
  created_by           INTEGER NOT NULL,
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_team   ON dispatches(team_id);

-- JOINT #7: one unit per item, enforced by an enum CHECK on the column.
CREATE TABLE IF NOT EXISTS resources (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT    NOT NULL UNIQUE,
  unit     TEXT    NOT NULL CHECK (unit IN ('Kilogram', 'Litre', 'Unit', 'Pallet')),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  owner    TEXT    NOT NULL,
  location TEXT    NOT NULL
);

-- JOINT #7: ledger. Rows are never edited; a correction is a 'Reversal' row.
CREATE TABLE IF NOT EXISTS resource_allocations (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_type             TEXT    NOT NULL CHECK (entry_type IN ('Allocation', 'Reversal')),
  resource_id            INTEGER NOT NULL REFERENCES resources(id),
  quantity               INTEGER NOT NULL CHECK (quantity > 0),
  unit                   TEXT    NOT NULL CHECK (unit IN ('Kilogram', 'Litre', 'Unit', 'Pallet')),
  destination_type       TEXT    NOT NULL CHECK (destination_type IN ('Shelter', 'Area', 'Team')),
  destination_id         INTEGER NOT NULL,
  instructions           TEXT,
  reverses_allocation_id INTEGER REFERENCES resource_allocations(id),
  reason                 TEXT,
  created_by             INTEGER NOT NULL,
  created_at             TEXT    NOT NULL,
  CHECK ((entry_type = 'Reversal') = (reverses_allocation_id IS NOT NULL))
);
-- An allocation can be reversed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_allocations_one_reversal
  ON resource_allocations(reverses_allocation_id) WHERE reverses_allocation_id IS NOT NULL;

-- JOINT #8: resupply request when stock is insufficient.
CREATE TABLE IF NOT EXISTS resupply_requests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id  INTEGER NOT NULL REFERENCES resources(id),
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  note         TEXT,
  status       TEXT    NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Fulfilled', 'Rejected')),
  requested_by INTEGER NOT NULL,
  created_at   TEXT    NOT NULL
);
