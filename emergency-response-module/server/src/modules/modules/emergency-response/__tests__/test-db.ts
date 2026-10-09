import Database, { type Database as Db } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seedEmergencyResponse } from '../../../db/seeds/401_emergency_response.seed';

const MIGRATION = path.resolve(__dirname, '../../../db/migrations/401_emergency_response_init.sql');

/**
 * In-memory SQLite with the REAL migration (no DB mocks, plan §3.17).
 * Replace the two stub tables with the foundation's migrate() once it is merged.
 */
export function createTestDb(): Db {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, role TEXT NOT NULL);
    CREATE TABLE districts (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    INSERT INTO districts (name) VALUES ('Colombo'), ('Gampaha'), ('Kalutara'), ('Ratnapura');
    INSERT INTO users (id, role) VALUES (1, 'JointOpsLead'), (2, 'RescueTeamLeader'),
      (3, 'RescueTeamLeader'), (4, 'RescueTeamLeader');
  `);
  db.exec(fs.readFileSync(MIGRATION, 'utf8'));
  seedEmergencyResponse(db);
  return db;
}
