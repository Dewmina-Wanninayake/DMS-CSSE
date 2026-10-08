import type { Express } from 'express';
import { HazardType, ReportStatus, Role, type AuthUser } from '@dms/shared';
import { createApp } from '../../app';
import { loadConfig } from '../../config/env';
import { hashPassword } from '../auth/password';
import { createContext } from '../create-context';
import type { AppContext } from '../context';
import { openDatabase, type Db } from '../db/connection';
import { runMigrations } from '../db/migrate';
import type { HydrometProvider } from '../hydromet/hydromet-provider';
import { silentLogger } from '../logger';
import type { NotificationGateway } from '../notifications/notification.types';

/** Gateway test double: deliveries succeed unless `failing` is set. */
export class FakeGateway implements NotificationGateway {
  failing = false;
  readonly delivered: string[] = [];

  async deliver(n: { recipient: string; subject: string }): Promise<void> {
    if (this.failing) throw new Error('recipient unreachable');
    this.delivered.push(`${n.recipient}: ${n.subject}`);
  }
}

export interface TestEnv {
  db: Db;
  ctx: AppContext;
  app: Express;
  gateway: FakeGateway;
  /** Mutable "now" used by the injected clock. */
  clock: { now: Date };
  /** Creates a user with the role and returns it with a valid bearer token. */
  signIn(role: Role, name?: string): { user: AuthUser; token: string };
  insertReport(input: ReportFixture): number;
}

export interface ReportFixture {
  districtCode: string;
  hazardType?: HazardType;
  status?: ReportStatus;
  reportedAt?: string;
  duplicateOf?: number | null;
  description?: string;
}

/** scrypt is deliberately slow, so hash once for every test user. */
const TEST_PASSWORD_HASH = hashPassword('unused-password');

export const TEST_NOW = '2026-10-09T10:00:00.000Z';

/** Fresh in-memory database with every migration applied, wired exactly like production. */
export function createTestEnv(options: { hydromet?: HydrometProvider } = {}): TestEnv {
  const db = openDatabase(':memory:');
  runMigrations(db);
  const config = loadConfig({ JWT_SECRET: 'test-secret-0123456789', NODE_ENV: 'test' });
  const gateway = new FakeGateway();
  const clock = { now: new Date(TEST_NOW) };
  const ctx = createContext(config, db, {
    logger: silentLogger,
    clock: () => clock.now,
    gateway,
    hydromet: options.hydromet,
  });
  const app = createApp(ctx);
  let counter = 0;
  const reporter = ctx.users.create({
    email: 'reporter@test.lk',
    fullName: 'Test Reporter',
    role: Role.Citizen,
    passwordHash: TEST_PASSWORD_HASH,
  });

  return {
    db,
    ctx,
    app,
    gateway,
    clock,
    signIn(role, name = `Test ${role}`) {
      counter += 1;
      const user = ctx.users.create({
        email: `${role.toLowerCase()}${counter}@test.lk`,
        fullName: name,
        role,
        passwordHash: TEST_PASSWORD_HASH,
      });
      return { user, token: ctx.tokens.sign(user) };
    },
    insertReport(input) {
      const district = db
        .prepare('SELECT id, latitude, longitude FROM districts WHERE code = ?')
        .get(input.districtCode) as { id: number; latitude: number; longitude: number };
      const result = db
        .prepare(
          `INSERT INTO hazard_reports
             (reporter_id, hazard_type, description, status, latitude, longitude, district_id, reported_at, duplicate_of, verified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          reporter.id,
          input.hazardType ?? HazardType.Flood,
          input.description ?? 'Test report',
          input.status ?? ReportStatus.Verified,
          district.latitude,
          district.longitude,
          district.id,
          input.reportedAt ?? '2026-09-15T08:00:00.000Z',
          input.duplicateOf ?? null,
          input.status === ReportStatus.Verified || input.status === undefined
            ? (input.reportedAt ?? '2026-09-15T08:00:00.000Z')
            : null,
        );
      return Number(result.lastInsertRowid);
    },
  };
}

export const bearer = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

export function districtId(db: Db, code: string): number {
  return (db.prepare('SELECT id FROM districts WHERE code = ?').get(code) as { id: number }).id;
}
