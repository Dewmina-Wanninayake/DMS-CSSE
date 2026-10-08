import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Role } from '@dms/shared';
import { loadConfig } from '../../config/env';
import { hashPassword, verifyPassword } from '../auth/password';
import { createTokenService } from '../auth/token';
import { openDatabase } from '../db/connection';
import { runMigrations } from '../db/migrate';
import { UnauthenticatedError } from '../http/errors';
import { bearer, createTestEnv } from '../testing/test-env';

describe('password hashing', () => {
  it('should verify the right password and reject a wrong one', () => {
    const stored = hashPassword('Correct-Horse-9');
    expect(verifyPassword('Correct-Horse-9', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('should salt every hash and reject a malformed stored value', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
    expect(verifyPassword('same', 'not-a-hash')).toBe(false);
  });
});

describe('token service', () => {
  const user = { id: 7, email: 'a@dms.lk', fullName: 'A', role: Role.DisasterAnalyst };

  it('should round-trip a user', () => {
    const tokens = createTokenService('a-very-long-test-secret', '1h');
    expect(tokens.verify(tokens.sign(user))).toEqual(user);
  });

  it('should reject a token signed with another secret', () => {
    const token = createTokenService('first-secret-0123456789', '1h').sign(user);
    expect(() => createTokenService('other-secret-0123456789', '1h').verify(token)).toThrow(
      UnauthenticatedError,
    );
  });

  it('should reject an expired token', () => {
    const tokens = createTokenService('a-very-long-test-secret', '-10s');
    expect(() => tokens.verify(tokens.sign(user))).toThrow(UnauthenticatedError);
  });
});

describe('configuration', () => {
  it('should apply defaults and parse numbers', () => {
    const config = loadConfig({ JWT_SECRET: 'x'.repeat(16), PORT: '5000' });
    expect(config).toMatchObject({
      PORT: 5000,
      NODE_ENV: 'development',
      NOTIFICATION_MAX_RETRIES: 5,
    });
  });

  it('should fail fast with a readable message when the secret is missing or short', () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow(/at least 16/);
  });
});

describe('migrations', () => {
  it('should apply each file once and be idempotent', () => {
    const db = openDatabase(':memory:');
    const first = runMigrations(db);
    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(runMigrations(db)).toEqual([]);
    expect((db.prepare('SELECT COUNT(*) AS n FROM districts').get() as { n: number }).n).toBe(25);
  });

  it('should ignore files that do not match the NNN_name.sql pattern and roll back a failing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dms-migrations-'));
    writeFileSync(join(dir, '001_ok.sql'), 'CREATE TABLE a (id INTEGER);');
    writeFileSync(join(dir, 'notes.txt'), 'ignored');
    writeFileSync(join(dir, '002_bad.sql'), 'CREATE TABLE b (id INTEGER); THIS IS NOT SQL;');
    const db = openDatabase(':memory:');
    expect(() => runMigrations(db, dir)).toThrow();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    expect(tables.map((t) => t.name)).toContain('a');
    expect(tables.map((t) => t.name)).not.toContain('b');
  });
});

describe('HTTP behaviour', () => {
  it('should report health without authentication', async () => {
    const { app } = createTestEnv();
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('should answer unknown routes with the 404 envelope', async () => {
    const { app } = createTestEnv();
    const res = await request(app).get('/api/v1/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('should answer malformed JSON with 400, not 500', async () => {
    const { app, signIn } = createTestEnv();
    const { token } = signIn(Role.DisasterAnalyst);
    const res = await request(app)
      .post('/api/v1/analytics/trend-reports')
      .set(bearer(token))
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should hide internals of unexpected errors behind a generic 500', async () => {
    const env = createTestEnv();
    const { token } = env.signIn(Role.DisasterAnalyst);
    env.db.exec('DROP TABLE policy_settings');
    const res = await request(env.app)
      .post('/api/v1/analytics/trend-reports')
      .set(bearer(token))
      .send({
        hazardType: 'Flood',
        districtIds: 'all',
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
      });
    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/policy_settings|SQLITE/i);
  });

  it('should send security headers and no x-powered-by', async () => {
    const { app } = createTestEnv();
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('auth routes (foundation, not graded)', () => {
  it('should sign in with valid credentials and return a usable token', async () => {
    const env = createTestEnv();
    env.ctx.users.create({
      email: 'login@dms.lk',
      fullName: 'Login User',
      role: Role.PolicyDirector,
      passwordHash: hashPassword('Secret-Pass-1'),
    });
    const login = await request(env.app)
      .post('/api/v1/auth/login')
      .send({ email: 'LOGIN@dms.lk', password: 'Secret-Pass-1' });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ email: 'login@dms.lk', role: 'PolicyDirector' });
    expect(login.body.data.user).not.toHaveProperty('passwordHash');

    const me = await request(env.app).get('/api/v1/auth/me').set(bearer(login.body.data.token));
    expect(me.body.data.fullName).toBe('Login User');
  });

  it('should give the same 401 for a wrong password and an unknown user', async () => {
    const env = createTestEnv();
    env.ctx.users.create({
      email: 'x@dms.lk',
      fullName: 'X',
      role: Role.Citizen,
      passwordHash: hashPassword('Right-Pass-1'),
    });
    const wrong = await request(env.app)
      .post('/api/v1/auth/login')
      .send({ email: 'x@dms.lk', password: 'nope' });
    const unknown = await request(env.app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@dms.lk', password: 'nope' });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('should validate the login body', async () => {
    const { app } = createTestEnv();
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' }))
        .status,
    ).toBe(400);
  });
});

describe('notification service', () => {
  it('should stop retrying after the configured maximum (extension 12a)', async () => {
    const env = createTestEnv();
    const user = env.signIn(Role.DutyOfficer).user;
    env.gateway.failing = true;
    const sent = await env.ctx.notifications.notifyUser(user.id, {
      subject: 'S',
      body: 'B',
      relatedType: 'Test',
      relatedId: 1,
    });
    expect(sent?.deliveryStatus).toBe('Failed');
    for (let i = 0; i < 10; i += 1) await env.ctx.notifications.retryFailed();
    const [record] = env.ctx.notifications.listFor('Test', 1);
    expect(record).toMatchObject({
      deliveryStatus: 'Failed',
      retryCount: env.ctx.config.NOTIFICATION_MAX_RETRIES,
      lastError: 'recipient unreachable',
    });
  });

  it('should return null when the user no longer exists', async () => {
    const env = createTestEnv();
    expect(
      await env.ctx.notifications.notifyUser(9999, {
        subject: 'S',
        body: 'B',
        relatedType: 'Test',
        relatedId: 1,
      }),
    ).toBeNull();
  });

  it('should clear the error once a retry succeeds', async () => {
    const env = createTestEnv();
    const user = env.signIn(Role.DutyOfficer).user;
    env.gateway.failing = true;
    await env.ctx.notifications.notifyUser(user.id, {
      subject: 'S',
      body: 'B',
      relatedType: 'Test',
      relatedId: 2,
    });
    env.gateway.failing = false;
    expect(await env.ctx.notifications.retryFailed()).toBe(1);
    expect(env.ctx.notifications.listFor('Test', 2)[0]).toMatchObject({
      deliveryStatus: 'Sent',
      lastError: null,
    });
  });
});

describe('repositories', () => {
  it('should find districts by ids and return nothing for an empty list', () => {
    const { ctx } = createTestEnv();
    expect(ctx.districts.findByIds([])).toEqual([]);
    expect(ctx.districts.findByIds([1, 2])).toHaveLength(2);
  });

  it('should find users by role and by email', () => {
    const env = createTestEnv();
    const { user } = env.signIn(Role.RegionalAdmin);
    expect(env.ctx.users.findByRoles([Role.RegionalAdmin]).map((u) => u.id)).toEqual([user.id]);
    expect(env.ctx.users.findByEmail(user.email)?.id).toBe(user.id);
    expect(env.ctx.users.findByEmail('missing@dms.lk')).toBeUndefined();
    expect(env.ctx.users.findById(9999)).toBeUndefined();
  });
});
