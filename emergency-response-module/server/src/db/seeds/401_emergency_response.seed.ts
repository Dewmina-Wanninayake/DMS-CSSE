import type { Database } from 'better-sqlite3';

const SHELTERS = [
  { name: 'Colombo Central Relief Centre', district: 'Colombo', address: 'Maradana Road, Colombo 10', capacity: 400, occupied: 120 },
  { name: 'Gampaha Community Hall Shelter', district: 'Gampaha', address: 'Church Road, Gampaha', capacity: 250, occupied: 250 },
  { name: 'Kalutara Temple Shelter', district: 'Kalutara', address: 'Galle Road, Kalutara', capacity: 300, occupied: 90 },
  { name: 'Ratnapura Town School Shelter', district: 'Ratnapura', address: 'Main Street, Ratnapura', capacity: 350, occupied: 310 },
] as const;

const TEAMS = [
  { name: 'Alpha Rescue Team', agency: 'Sri Lanka Navy', leader: 'Cdr. S. Perera', location: 'Colombo' },
  { name: 'Bravo Rescue Team', agency: 'Sri Lanka Army', leader: 'Maj. K. Silva', location: 'Gampaha' },
  { name: 'Charlie Medical Team', agency: 'Red Cross Sri Lanka', leader: 'Dr. N. Fernando', location: 'Kalutara' },
] as const;

const RESOURCES = [
  { name: 'Drinking water', unit: 'litre', quantity: 5000, owner: 'DMC Warehouse', location: 'Colombo' },
  { name: 'Rice', unit: 'kg', quantity: 1200, owner: 'DMC Warehouse', location: 'Colombo' },
  { name: 'Blankets', unit: 'piece', quantity: 300, owner: 'Red Cross', location: 'Gampaha' },
  { name: 'First-aid kits', unit: 'box', quantity: 40, owner: 'Ministry of Health', location: 'Kalutara' },
] as const;

/**
 * Idempotent dev seed for UC-JOINT-001. Shelters are read-only reference data for this
 * module (JOINT #2). Leaders are linked to existing RescueTeamLeader users when present.
 * Safe to run repeatedly: every insert is keyed on a UNIQUE name.
 */
export function seedEmergencyResponse(db: Database): void {
  db.transaction(() => {
    const districtId = db.prepare<[string], { id: number }>('SELECT id FROM districts WHERE name = ?');
    const insertShelter = db.prepare(
      'INSERT OR IGNORE INTO shelters (name, district_id, address, capacity) VALUES (?, ?, ?, ?)',
    );
    const shelterId = db.prepare<[string], { id: number }>('SELECT id FROM shelters WHERE name = ?');
    const insertOccupancy = db.prepare(
      'INSERT OR IGNORE INTO shelter_occupancy (shelter_id, occupied) VALUES (?, ?)',
    );
    for (const s of SHELTERS) {
      const district = districtId.get(s.district);
      if (!district) continue; // district not seeded by the foundation: skip, never invent one
      insertShelter.run(s.name, district.id, s.address, s.capacity);
      const shelter = shelterId.get(s.name);
      if (shelter) insertOccupancy.run(shelter.id, s.occupied);
    }

    const leaders = db
      .prepare<[], { id: number }>("SELECT id FROM users WHERE role = 'RescueTeamLeader' ORDER BY id")
      .all();
    const insertTeam = db.prepare(
      `INSERT OR IGNORE INTO rescue_teams (name, agency, leader_name, leader_user_id, location)
       VALUES (?, ?, ?, ?, ?)`,
    );
    TEAMS.forEach((t, i) => insertTeam.run(t.name, t.agency, t.leader, leaders[i]?.id ?? null, t.location));

    const insertResource = db.prepare(
      'INSERT OR IGNORE INTO resources (name, unit, quantity, owner, location) VALUES (?, ?, ?, ?, ?)',
    );
    for (const r of RESOURCES) insertResource.run(r.name, r.unit, r.quantity, r.owner, r.location);
  })();
}
