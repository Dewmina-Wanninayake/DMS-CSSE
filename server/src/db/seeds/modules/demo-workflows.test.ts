import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS } from '@dms/shared';
import { loadConfig } from '../../../config/env';
import { createContext } from '../../../core/create-context';
import { openDatabase } from '../../../core/db/connection';
import { runMigrations } from '../../../core/db/migrate';
import { silentLogger } from '../../../core/logger';
import { seedDevData, seedExtraData } from '../dev-seed';
import { seedDemoWorkflows } from './demo-workflows.seed';
import { seedEmergencyResponse } from './emergency-response.seed';
import { seedGroundReporting } from './ground-reporting.seed';

/** Runs the full seed the way `npm run db:seed` does, on a fresh in-memory database. */
async function seeded() {
  const db = openDatabase(':memory:');
  runMigrations(db);
  seedDevData(db, 'Demo-Password-1');
  seedExtraData(db);
  seedEmergencyResponse(db);
  seedGroundReporting(db);
  const config = loadConfig({ JWT_SECRET: 'seed-test-secret-0123456789', NODE_ENV: 'test' });
  const ctx = createContext(config, db, { logger: silentLogger });
  const summary = await seedDemoWorkflows(ctx);
  return { db, ctx, summary };
}

const count = (db: ReturnType<typeof openDatabase>, sql: string) =>
  (db.prepare(sql).get() as { n: number }).n;

describe('demo seed (markers open every screen on real data)', () => {
  it('should create every account and populate every use case in every state', async () => {
    const { db, summary } = await seeded();

    expect(count(db, 'SELECT COUNT(*) AS n FROM users')).toBe(DEMO_ACCOUNTS.length);
    expect(summary).toMatchObject({ warnings: 3, policies: 5, dispatches: 4, allocations: 4 });

    const statuses = (
      db
        .prepare(
          "SELECT DISTINCT status FROM hazard_reports WHERE client_id IS NOT NULL OR description LIKE '%'",
        )
        .all() as { status: string }[]
    ).map((r) => r.status);
    expect(statuses).toEqual(
      expect.arrayContaining(['Pending', 'Verified', 'Rejected', 'NeedsInformation']),
    );
    expect(
      count(db, 'SELECT COUNT(*) AS n FROM hazard_reports WHERE duplicate_of IS NOT NULL'),
    ).toBeGreaterThan(0);
    expect(count(db, 'SELECT COUNT(*) AS n FROM report_photos')).toBeGreaterThanOrEqual(4);
    expect(count(db, 'SELECT COUNT(*) AS n FROM report_updates')).toBe(1);

    const warnings = (
      db.prepare('SELECT status FROM warnings ORDER BY id').all() as { status: string }[]
    ).map((w) => w.status);
    expect(warnings).toEqual(['Issued', 'Corrected', 'PendingApproval']);

    const policies = (
      db.prepare('SELECT status FROM policies ORDER BY id').all() as { status: string }[]
    ).map((p) => p.status);
    expect(policies.sort()).toEqual(['Approved', 'Draft', 'Draft', 'PendingApproval', 'Rejected']);
    expect(count(db, 'SELECT COUNT(*) AS n FROM policy_simulations')).toBe(1);

    const dispatches = (
      db.prepare('SELECT status FROM dispatches ORDER BY id').all() as { status: string }[]
    ).map((d) => d.status);
    expect(dispatches).toEqual(['OnSite', 'Dispatched', 'Completed', 'Cancelled']);
    expect(
      count(db, "SELECT COUNT(*) AS n FROM resource_allocations WHERE entry_type = 'Reversal'"),
    ).toBe(1);
    expect(count(db, 'SELECT COUNT(*) AS n FROM resupply_requests')).toBe(1);
    expect(count(db, 'SELECT COUNT(*) AS n FROM notifications')).toBeGreaterThan(10);
  }, 60_000);

  it('should give each rescue team its own leader and apply the approved policy threshold', async () => {
    const { db } = await seeded();
    const leaders = db
      .prepare('SELECT leader_user_id AS id FROM rescue_teams ORDER BY name')
      .all() as { id: number }[];
    expect(new Set(leaders.map((l) => l.id)).size).toBe(3);
    expect(
      db.prepare("SELECT risk_threshold FROM policy_settings WHERE hazard_type = 'Flood'").get(),
    ).toEqual({ risk_threshold: 6 });
  }, 60_000);

  it('should do nothing the second time', async () => {
    const { ctx } = await seeded();
    expect(await seedDemoWorkflows(ctx)).toBeNull();
  }, 60_000);
});
