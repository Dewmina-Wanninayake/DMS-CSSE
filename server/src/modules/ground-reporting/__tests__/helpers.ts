import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import { ReportStatus, Role } from '@dms/shared';
import { bearer, createTestEnv, districtId, type TestEnv } from '../../../core/testing/test-env';

export type Actor = { token: string; user: { id: number; email: string } };

export const api = (path = ''): string => `/api/v1${path}`;

/** A report that passes every validation rule (Kandy, GPS fix). */
export const validReport = (overrides: object = {}): Record<string, unknown> => ({
  hazardType: 'Flood',
  description: 'River is rising near the bridge',
  latitude: 7.29,
  longitude: 80.63,
  locationSource: 'Gps',
  ...overrides,
});

export const queued = (overrides: object = {}): Record<string, unknown> & { clientId: string } => {
  const clientId = randomUUID();
  return { ...validReport({ clientId, ...overrides }), clientId } as Record<string, unknown> & {
    clientId: string;
  };
};

export const minutesAgo = (now: Date, minutes: number): string =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

export class Scenario {
  readonly env: TestEnv = createTestEnv();
  readonly citizen = this.env.signIn(Role.Citizen, 'Nimal Citizen');
  readonly otherCitizen = this.env.signIn(Role.Citizen, 'Kamala Other');
  readonly volunteer = this.env.signIn(Role.Volunteer, 'Saman Volunteer');
  readonly officer = this.env.signIn(Role.DutyOfficer, 'Duty Officer');

  post(path: string, actor: Actor, body: object = {}) {
    return request(this.env.app).post(api(path)).set(bearer(actor.token)).send(body);
  }

  get(path: string, actor: Actor) {
    return request(this.env.app).get(api(path)).set(bearer(actor.token));
  }

  patch(path: string, actor: Actor, body: object = {}) {
    return request(this.env.app).patch(api(path)).set(bearer(actor.token)).send(body);
  }

  putPhoto(id: number | string, actor: Actor, bytes: Buffer, contentType = 'image/jpeg') {
    return request(this.env.app)
      .put(api(`/reports/${id}/photo`))
      .set(bearer(actor.token))
      .set('Content-Type', contentType)
      .send(bytes);
  }

  /** Submits through the API and returns the created report. */
  async submit(actor: Actor, overrides: object = {}) {
    const res = await this.post('/reports', actor, validReport(overrides));
    expect(res.status).toBe(201);
    return res.body.data as { id: number; duplicateOf: number | null; status: string };
  }

  setStatus(reportId: number, status: ReportStatus): void {
    this.env.db.prepare('UPDATE hazard_reports SET status = ? WHERE id = ?').run(status, reportId);
  }

  certify(actor: Actor, districtCode: string): void {
    this.env.db
      .prepare('INSERT INTO volunteer_certifications (user_id, district_id) VALUES (?, ?)')
      .run(actor.user.id, districtId(this.env.db, districtCode));
  }

  /** Simulates UC-DIST-02 telling the reporter about its decision. */
  notifyOutcome(reportId: number, recipient: Actor, body: string): void {
    this.env.db
      .prepare(
        `INSERT INTO notifications (recipient_user_id, recipient, channel, subject, body, related_type, related_id)
         VALUES (?, ?, 'Push', 'Report decision', ?, 'HazardReport', ?)`,
      )
      .run(recipient.user.id, recipient.user.email, body, reportId);
  }

  rowCount(): number {
    return (this.env.db.prepare('SELECT COUNT(*) AS n FROM hazard_reports').get() as { n: number })
      .n;
  }
}

/** Bytes of a JPEG-looking file of exactly `size` bytes. */
export const jpegOfSize = (size: number): Buffer => {
  const bytes = Buffer.alloc(size);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(bytes);
  return bytes;
};

export const pngOfSize = (size: number): Buffer => {
  const bytes = Buffer.alloc(size);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  return bytes;
};
