import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Role } from '@dms/shared';
import { bearer } from '../../../core/testing/test-env';
import { Scenario, api } from './helpers';

const s = new Scenario();

/** Every route of the module and who may call it (the role matrix from the plan). */
const ROUTES: { method: 'get' | 'post' | 'patch' | 'put'; path: string; allowed: Role[] }[] = [
  { method: 'get', path: '/reports/hazard-types', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'get', path: '/reports/mine', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'post', path: '/reports', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'post', path: '/reports/sync', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'get', path: '/reports/1', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'patch', path: '/reports/1', allowed: [Role.Citizen, Role.Volunteer] },
  { method: 'put', path: '/reports/1/photo', allowed: [Role.Citizen, Role.Volunteer] },
  {
    method: 'get',
    path: '/reports/1/photo',
    allowed: [Role.Citizen, Role.Volunteer, Role.DutyOfficer, Role.SecondApprover],
  },
  { method: 'post', path: '/reports/1/field-updates', allowed: [Role.Volunteer] },
  { method: 'get', path: '/locations/resolve', allowed: [Role.Citizen, Role.Volunteer] },
];

const OTHER_ROLES = Object.values(Role).filter((role) => role !== Role.Citizen);

describe('authentication and role matrix', () => {
  it.each(ROUTES)('should answer 401 without a token: $method $path', async ({ method, path }) => {
    const res = await request(s.env.app)[method](api(path));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each(ROUTES)(
    'should answer 403 to every role not listed: $method $path',
    async ({ method, path, allowed }) => {
      for (const role of Object.values(Role).filter((r) => !allowed.includes(r))) {
        const actor = s.env.signIn(role);
        const res = await request(s.env.app)[method](api(path)).set(bearer(actor.token));
        expect(res.status, `${role} on ${method} ${path}`).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    },
  );

  it('should reject an invalid token (401)', async () => {
    const res = await request(s.env.app).get(api('/reports/mine')).set(bearer('garbage'));
    expect(res.status).toBe(401);
  });

  it('should not shadow other modules’ routes with an unknown path (404)', async () => {
    const res = await request(s.env.app)
      .get(api('/reports/mine/extra'))
      .set(bearer(s.citizen.token));
    expect(res.status).toBe(404);
  });

  it('should cover every non-reporter role in the matrix', () => {
    expect(OTHER_ROLES).toHaveLength(9);
  });
});
