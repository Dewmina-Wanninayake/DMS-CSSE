import type { Db } from '../../../core/db/connection';

/** Districts the seeded volunteer is certified for, so field updates (extension 13c) work in the demo. */
const CERTIFIED_DISTRICT_CODES = ['KEG', 'RAT', 'CMB'] as const;

/**
 * Idempotent dev seed for UC-CV-003: certifies `volunteer@dms.lk` for a few districts. Skips quietly
 * when the user or a district is missing (the foundation seed has not run).
 */
export function seedGroundReporting(db: Db): number {
  const volunteer = db.prepare("SELECT id FROM users WHERE email = 'volunteer@dms.lk'").get() as
    { id: number } | undefined;
  if (!volunteer) return 0;
  const district = db.prepare('SELECT id FROM districts WHERE code = ?');
  const insert = db.prepare(
    'INSERT OR IGNORE INTO volunteer_certifications (user_id, district_id) VALUES (?, ?)',
  );
  let added = 0;
  for (const code of CERTIFIED_DISTRICT_CODES) {
    const row = district.get(code) as { id: number } | undefined;
    if (row) added += insert.run(volunteer.id, row.id).changes;
  }
  return added;
}
