import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './connection';

export const MIGRATIONS_DIR = join(import.meta.dirname, '../../db/migrations');

/**
 * Applies every `NNN_*.sql` file in lexical order exactly once.
 * Ranges (the team plan §3.3): 0xx foundation, 1xx UC-DIST-02, 2xx UC-DA-001, 3xx UC-CV-003, 4xx UC-JOINT-001.
 * Applied migrations are never edited; add a new file instead.
 */
export function runMigrations(db: Db, dir: string = MIGRATIONS_DIR): string[] {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     )`,
  );
  const applied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => (row as { name: string }).name),
  );
  const files = readdirSync(dir)
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();
  const executed: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(dir, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    })();
    executed.push(file);
  }
  return executed;
}
