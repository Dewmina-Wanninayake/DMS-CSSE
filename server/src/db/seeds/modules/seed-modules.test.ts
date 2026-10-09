import { describe, expect, it } from 'vitest';
import { Role } from '@dms/shared';
import { createTestEnv } from '../../../core/testing/test-env';
import { seedEmergencyResponse } from './emergency-response.seed';
import { seedGroundReporting } from './ground-reporting.seed';

describe('module dev seeds are idempotent', () => {
  it('should certify the seeded volunteer once, and only when the user exists', () => {
    const env = createTestEnv();
    expect(seedGroundReporting(env.db)).toBe(0);

    env.ctx.users.create({
      email: 'volunteer@dms.lk',
      fullName: 'Madhavi Dissanayake',
      role: Role.Volunteer,
      passwordHash: 'x',
    });
    expect(seedGroundReporting(env.db)).toBe(3);
    expect(seedGroundReporting(env.db)).toBe(0);
    expect(env.db.prepare('SELECT COUNT(*) AS n FROM volunteer_certifications').get()).toEqual({
      n: 3,
    });
  });

  it('should seed shelters, teams and resources once', () => {
    const env = createTestEnv();
    const count = (table: string) =>
      (env.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    seedEmergencyResponse(env.db);
    const first = [count('shelters'), count('rescue_teams'), count('resources')];
    seedEmergencyResponse(env.db);
    expect([count('shelters'), count('rescue_teams'), count('resources')]).toEqual(first);
    expect(first.every((n) => n > 0)).toBe(true);
  });
});
