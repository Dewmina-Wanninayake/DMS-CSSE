import { Role } from '@dms/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { bearer, createTestEnv, type TestEnv } from '../../../core/testing/test-env';
import { seedEmergencyResponse } from '../../../db/seeds/modules/emergency-response.seed';

/** The module wired into the real app: JWT guard, core validate(), core notifications. */
describe('emergency-response through the real app', () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
    seedEmergencyResponse(env.db);
  });

  it('rejects unauthenticated and wrong-role callers', async () => {
    expect((await request(env.app).get('/api/v1/response/dashboard')).status).toBe(401);
    const citizen = env.signIn(Role.Citizen);
    expect(
      (await request(env.app).get('/api/v1/response/dashboard').set(bearer(citizen.token))).status,
    ).toBe(403);
  });

  it('A1-A5: dispatch is confirmed, the leader is notified and moves the status', async () => {
    const ops = env.signIn(Role.JointOpsLead);
    const leader = env.signIn(Role.RescueTeamLeader);
    env.db.prepare('UPDATE rescue_teams SET leader_user_id = ? WHERE id = 1').run(leader.user.id);

    const created = await request(env.app)
      .post('/api/v1/dispatches')
      .set(bearer(ops.token))
      .send({ location: 'Kaduwela', priority: 'Urgent', teamId: '1', instructions: 'Boats' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      priority: 'Urgent',
      teamId: 1,
      status: 'Dispatched',
    });
    expect(env.gateway.delivered.join()).toContain('Dispatched to Kaduwela');

    const moved = await request(env.app)
      .patch(`/api/v1/dispatches/${created.body.data.id}/status`)
      .set(bearer(leader.token))
      .send({ status: 'EnRoute' });
    expect(moved.body.data.status).toBe('EnRoute');
  });

  it('B1-B5: allocation reduces stock once and a stale confirm reports the current quantity', async () => {
    const ops = env.signIn(Role.JointOpsLead);
    const resource = env.db
      .prepare("SELECT id FROM resources WHERE name = 'Drinking water'")
      .get() as {
      id: number;
    };
    const shelter = env.db.prepare('SELECT id FROM shelters ORDER BY id LIMIT 1').get() as {
      id: number;
    };
    const input = {
      resourceId: resource.id,
      quantity: 100,
      destinationType: 'Shelter',
      destinationId: shelter.id,
    };

    const first = await request(env.app)
      .post('/api/v1/allocations')
      .set(bearer(ops.token))
      .send(input);
    expect(first.status).toBe(201);
    const left = env.db.prepare('SELECT quantity FROM resources WHERE id = ?').get(resource.id);
    expect(left).toEqual({ quantity: 4900 });

    const big = { ...input, quantity: 99_999 };
    const preview = await request(env.app)
      .post('/api/v1/allocations/preview')
      .set(bearer(ops.token))
      .send(big);
    expect(preview.status).toBe(422);
    expect(preview.body.error.code).toBe('INSUFFICIENT_STOCK');

    const confirm = await request(env.app)
      .post('/api/v1/allocations')
      .set(bearer(ops.token))
      .send(big);
    expect(confirm.status).toBe(409);
    expect(confirm.body.error.code).toBe('STALE_STOCK');
    expect(confirm.body.error.details.currentQuantity).toBe(4900);
  });

  it('returns a field-level 400 from the core validate() for bad input', async () => {
    const ops = env.signIn(Role.JointOpsLead);
    const res = await request(env.app)
      .post('/api/v1/dispatches/preview')
      .set(bearer(ops.token))
      .send({ location: '', teamId: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
