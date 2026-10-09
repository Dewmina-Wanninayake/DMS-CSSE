import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { Role } from '@dms/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../../../core/http/errors';
import { createEmergencyResponseModule } from '../index';
import type { HttpToolkit } from '../routes';
import { createTestDb } from './test-db';

/**
 * Stand-ins for the foundation's JWT guard and validate(): the test sends the
 * identity in headers. Swap for the foundation's real helpers once merged.
 */
const toolkit: HttpToolkit = {
  authenticate: ((req, res, next) => {
    const role = req.header('x-role');
    const sub = Number(req.header('x-user'));
    if (!role) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in.' } });
      return;
    }
    (req as unknown as { user: unknown }).user = { sub, role };
    next();
  }) as RequestHandler,
  requireRole:
    (...roles: Role[]): RequestHandler =>
    (req, res, next) => {
      const { role } = (req as unknown as { user: { role: Role } }).user;
      if (!roles.includes(role)) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'No access.' } });
        return;
      }
      next();
    },
  validate:
    (schemas: { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny }): RequestHandler =>
    (req, res, next) => {
      for (const key of ['params', 'query', 'body'] as const) {
        const schema = schemas[key];
        if (!schema) continue;
        const parsed = schema.safeParse(req[key]);
        if (!parsed.success) {
          res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } });
          return;
        }
        if (key === 'body') req.body = parsed.data;
      }
      next();
    },
};

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err instanceof AppError ? err.status : 500;
  res.status(status).json({
    success: false,
    error: { code: err instanceof AppError ? err.code : 'INTERNAL', message: err.message, details: err.details },
  });
};

const ops = { 'x-role': Role.JointOpsLead, 'x-user': '1' };
const leader = (id: number) => ({ 'x-role': Role.RescueTeamLeader, 'x-user': String(id) });
const coordinator = { 'x-role': Role.ShelterCoordinator, 'x-user': '9' };

describe('emergency-response routes', () => {
  let app: express.Express;
  const notify = vi.fn();

  beforeEach(() => {
    const db = createTestDb();
    app = express();
    app.use(express.json());
    app.use(createEmergencyResponseModule(db, { notifyTeamDispatched: notify }, toolkit));
    app.use(errorHandler);
    notify.mockClear();
  });

  describe('auth matrix', () => {
    const cases: [string, string, Record<string, string> | undefined, number][] = [
      ['get', '/response/dashboard', undefined, 401],
      ['get', '/response/dashboard', leader(2), 403],
      ['get', '/response/dashboard', ops, 200],
      ['get', '/shelters', leader(2), 200],
      ['get', '/shelters', ops, 200],
      ['get', '/shelters', coordinator, 403],
      ['get', '/rescue-teams', leader(2), 403],
      ['get', '/resources', leader(2), 403],
      ['get', '/resources', ops, 200],
    ];
    it.each(cases)('%s %s as %j → %i', async (method, path, headers, status) => {
      const req = (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);
      for (const [k, v] of Object.entries(headers ?? {})) req.set(k, v);
      expect((await req).status).toBe(status);
    });

    it('only Joint Ops may dispatch, allocate, reverse or request resupply', async () => {
      for (const path of ['/dispatches', '/dispatches/preview', '/allocations', '/allocations/preview', '/resupply-requests']) {
        expect((await request(app).post(path).set(leader(2)).send({})).status).toBe(403);
      }
      expect((await request(app).post('/allocations/1/reversal').set(leader(2)).send({ reason: 'x y z' })).status).toBe(403);
      expect((await request(app).post('/dispatches/1/cancel').set(leader(2)).send({ reason: 'xyz' })).status).toBe(403);
    });

    it('Joint Ops cannot push team status (Rescue Team Leader only)', async () => {
      expect((await request(app).patch('/dispatches/1/status').set(ops).send({ status: 'EnRoute' })).status).toBe(403);
    });
  });

  describe('dispatch flow', () => {
    const body = { location: 'Kaduwela', priority: 'High', teamId: 1, instructions: 'Boats' };

    it('preview → confirm (201 + Location) → leader updates status → illegal move 409', async () => {
      const preview = await request(app).post('/dispatches/preview').set(ops).send(body);
      expect(preview.status).toBe(200);
      expect(preview.body.data.team.name).toBe('Alpha Rescue Team');

      const created = await request(app).post('/dispatches').set(ops).send(body);
      expect(created.status).toBe(201);
      expect(created.headers.location).toBe(`/api/v1/dispatches/${created.body.data.id}`);
      expect(notify).toHaveBeenCalledOnce();
      const id = created.body.data.id;

      const enRoute = await request(app).patch(`/dispatches/${id}/status`).set(leader(2)).send({ status: 'EnRoute' });
      expect(enRoute.body).toMatchObject({ success: true, data: { status: 'EnRoute' } });

      const skip = await request(app).patch(`/dispatches/${id}/status`).set(leader(2)).send({ status: 'Completed' });
      expect(skip.status).toBe(409);
      expect(skip.body.error.code).toBe('INVALID_STATE_TRANSITION');

      const stranger = await request(app).patch(`/dispatches/${id}/status`).set(leader(3)).send({ status: 'OnSite' });
      expect(stranger.status).toBe(403);
    });

    it('400 for missing priority, with a sentence message', async () => {
      const res = await request(app).post('/dispatches').set(ops).send({ ...body, priority: undefined });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Choose a priority.');
    });

    it('team leaders cannot send Cancelled through the status endpoint', async () => {
      const res = await request(app).patch('/dispatches/1/status').set(leader(2)).send({ status: 'Cancelled' });
      expect(res.status).toBe(400);
    });

    it('cancel needs a reason, then cancels and can replace the team', async () => {
      const { body: created } = await request(app).post('/dispatches').set(ops).send(body);
      const id = created.data.id;
      expect((await request(app).post(`/dispatches/${id}/cancel`).set(ops).send({ reason: '' })).status).toBe(400);
      const res = await request(app).post(`/dispatches/${id}/cancel`).set(ops).send({ reason: 'Team broke down', replacementTeamId: 2 });
      expect(res.status).toBe(200);
      expect(res.body.data.cancelled.status).toBe('Cancelled');
      expect(res.body.data.replacement.teamId).toBe(2);
    });
  });

  describe('allocation flow', () => {
    const body = { resourceId: 1, quantity: 100, destinationType: 'Shelter', destinationId: 1 };
    const resource = async () =>
      (await request(app).get('/resources').set(ops)).body.data.find((r: { id: number }) => r.id === 1);

    it('preview → confirm → reverse restores stock', async () => {
      const start = (await resource()).quantity;
      expect((await request(app).post('/allocations/preview').set(ops).send(body)).body.data.quantityLabel).toBe('100 litres');
      const created = await request(app).post('/allocations').set(ops).send(body);
      expect(created.status).toBe(201);
      expect((await resource()).quantity).toBe(start - 100);

      expect((await request(app).post(`/allocations/${created.body.data.id}/reversal`).set(ops).send({ reason: 'x' })).status).toBe(400);
      const reversed = await request(app).post(`/allocations/${created.body.data.id}/reversal`).set(ops).send({ reason: 'Wrong shelter' });
      expect(reversed.status).toBe(201);
      expect((await resource()).quantity).toBe(start);
    });

    it('B3a: insufficient stock → 422, then a resupply request is accepted (201)', async () => {
      const big = { ...body, quantity: 999999 };
      const res = await request(app).post('/allocations/preview').set(ops).send(big);
      expect(res.status).toBe(422);
      expect(res.body.error.details.canRequestResupply).toBe(true);
      const resupply = await request(app).post('/resupply-requests').set(ops).send({ resourceId: 1, quantity: 5000 });
      expect(resupply.status).toBe(201);
    });

    it('rejects a fractional quantity at the schema (400)', async () => {
      expect((await request(app).post('/allocations').set(ops).send({ ...body, quantity: 1.5 })).status).toBe(400);
    });
  });

  describe('shelters', () => {
    it('lists, filters and reads one shelter; 404 for unknown', async () => {
      expect((await request(app).get('/shelters').set(ops)).body.data).toHaveLength(4);
      expect((await request(app).get('/shelters?districtId=1').set(ops)).body.data).toHaveLength(1);
      expect((await request(app).get('/shelters/1').set(leader(2))).body.data.id).toBe(1);
      expect((await request(app).get('/shelters/999').set(ops)).status).toBe(404);
    });
    it('lists rescue teams for the coordination screen', async () => {
      const res = await request(app).get('/rescue-teams').set(ops);
      expect(res.body.data[0]).toMatchObject({ agency: expect.any(String), leaderName: expect.any(String), availability: 'Available' });
    });
    it('dashboard returns KPI cards and the four tables', async () => {
      const { data } = (await request(app).get('/response/dashboard').set(ops)).body;
      expect(Object.keys(data)).toEqual(['kpis', 'activeDispatches', 'shelters', 'teams', 'resources']);
    });
  });
});
