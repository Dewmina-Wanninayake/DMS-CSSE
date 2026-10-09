import type { Database as Db } from 'better-sqlite3';
import { Role } from '@dms/shared';
import { openDatabase } from '../../../core/db/connection';
import { runMigrations } from '../../../core/db/migrate';
import { seedEmergencyResponse } from '../../../db/seeds/modules/emergency-response.seed';

const USERS: [number, Role][] = [
  [1, Role.JointOpsLead],
  [2, Role.RescueTeamLeader],
  [3, Role.RescueTeamLeader],
  [4, Role.RescueTeamLeader],
];

/**
 * In-memory SQLite with the REAL foundation and module migrations (no DB mocks, plan §3.17),
 * the foundation's districts, four fixed users and the module seed.
 */
export function createTestDb(): Db {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, full_name, role, password_hash) VALUES (?, ?, ?, ?, 'x')",
  );
  for (const [id, role] of USERS) insertUser.run(id, `user${id}@test.lk`, `User ${id}`, role);
  seedEmergencyResponse(db);
  return db;
}
