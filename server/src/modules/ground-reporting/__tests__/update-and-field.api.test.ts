import { beforeEach, describe, expect, it } from 'vitest';
import { ReportStatus } from '@dms/shared';
import { Scenario } from './helpers';

let s: Scenario;
let reportId: number;
beforeEach(async () => {
  s = new Scenario();
  reportId = (await s.submit(s.citizen)).id;
});

describe('PATCH /reports/:id (update report, #3)', () => {
  beforeEach(() => s.setStatus(reportId, ReportStatus.NeedsInformation));

  it('should apply the new description and send the report back to Pending', async () => {
    const res = await s.patch(`/reports/${reportId}`, s.citizen, {
      description: 'Water is knee high',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'Pending', description: 'Water is knee high' });
    expect(res.body.data.updates).toHaveLength(1);
    expect(res.body.data.updates[0]).toMatchObject({
      kind: 'CitizenUpdate',
      authorName: 'Nimal Citizen',
      note: 'Citizen updated the report: description.',
    });
  });

  it('should re-resolve the district when the location changes', async () => {
    const res = await s.patch(`/reports/${reportId}`, s.citizen, {
      latitude: 9.66,
      longitude: 80.01,
      locationSource: 'Manual',
    });
    expect(res.body.data).toMatchObject({
      districtName: 'Jaffna',
      locationSource: 'Manual',
      latitude: 9.66,
      status: 'Pending',
    });
    expect(res.body.data.updates[0].note).toBe('Citizen updated the report: location.');
  });

  it('should record both changes in one history entry', async () => {
    const res = await s.patch(`/reports/${reportId}`, s.citizen, {
      description: 'Moved to the other bank',
      latitude: 7.3,
      longitude: 80.6,
      locationSource: 'Gps',
    });
    expect(res.body.data.updates[0].note).toBe(
      'Citizen updated the report: description and location.',
    );
  });

  it.each([
    ['nothing to change', {}],
    ['a partial location', { latitude: 7.3 }],
    ['a location outside Sri Lanka', { latitude: 13, longitude: 80, locationSource: 'Gps' }],
    ['a 201-character description', { description: 'a'.repeat(201) }],
  ])('should reject %s (400) and keep the report as it was', async (_label, body) => {
    const res = await s.patch(`/reports/${reportId}`, s.citizen, body);
    expect(res.status).toBe(400);
    const detail = await s.get(`/reports/${reportId}`, s.citizen);
    expect(detail.body.data.status).toBe('NeedsInformation');
  });

  it('should not let an "Other" report lose its description', async () => {
    const other = await s.submit(s.citizen, {
      hazardType: 'Other',
      description: 'Fallen tree',
      latitude: 8.5,
      longitude: 81,
    });
    s.setStatus(other.id, ReportStatus.NeedsInformation);
    const res = await s.patch(`/reports/${other.id}`, s.citizen, { description: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('description');
  });

  it.each([ReportStatus.Pending, ReportStatus.Verified, ReportStatus.Rejected])(
    'should refuse to update a %s report (409)',
    async (status) => {
      s.setStatus(reportId, status);
      const res = await s.patch(`/reports/${reportId}`, s.citizen, { description: 'late edit' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    },
  );

  it('should refuse another user (403) and an unknown report (404)', async () => {
    expect(
      (await s.patch(`/reports/${reportId}`, s.otherCitizen, { description: 'x' })).status,
    ).toBe(403);
    expect((await s.patch('/reports/9999', s.citizen, { description: 'x' })).status).toBe(404);
  });
});

describe('POST /reports/:id/field-updates (volunteer field update, #7)', () => {
  it('should add a note for a volunteer certified in the report’s district', async () => {
    s.certify(s.volunteer, 'KDY');
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, {
      note: '  Road now fully under water  ',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      kind: 'VolunteerFieldUpdate',
      note: 'Road now fully under water',
      authorName: 'Saman Volunteer',
    });
    const detail = await s.get(`/reports/${reportId}`, s.citizen);
    expect(detail.body.data.updates).toHaveLength(1);
    expect(detail.body.data.status).toBe('Pending');
  });

  it('should refuse a volunteer certified only for another district (403 NOT_CERTIFIED_FOR_AREA)', async () => {
    s.certify(s.volunteer, 'GAL');
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, {
      note: 'Looks bad',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_CERTIFIED_FOR_AREA');
    expect(res.body.error.message).toContain('Kandy');
  });

  it('should refuse a volunteer with no certification at all', async () => {
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, {
      note: 'Looks bad',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_CERTIFIED_FOR_AREA');
  });

  it('should refuse citizens and officers (403 FORBIDDEN) and anonymous callers (401)', async () => {
    for (const actor of [s.citizen, s.officer]) {
      const res = await s.post(`/reports/${reportId}/field-updates`, actor, { note: 'x' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    const anonymous = await import('supertest').then(({ default: request }) =>
      request(s.env.app).post(`/api/v1/reports/${reportId}/field-updates`).send({ note: 'x' }),
    );
    expect(anonymous.status).toBe(401);
  });

  it('should refuse a field update on a Rejected report (409)', async () => {
    s.certify(s.volunteer, 'KDY');
    s.setStatus(reportId, ReportStatus.Rejected);
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, {
      note: 'Still flooded',
    });
    expect(res.status).toBe(409);
  });

  it.each([
    ['an empty note', { note: '   ' }],
    ['a 201-character note', { note: 'a'.repeat(201) }],
    ['no note', {}],
  ])('should reject %s (400)', async (_label, body) => {
    s.certify(s.volunteer, 'KDY');
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, body);
    expect(res.status).toBe(400);
  });

  it('should accept a 200-character note (boundary)', async () => {
    s.certify(s.volunteer, 'KDY');
    const res = await s.post(`/reports/${reportId}/field-updates`, s.volunteer, {
      note: 'a'.repeat(200),
    });
    expect(res.status).toBe(201);
  });

  it('should return 404 for an unknown report', async () => {
    s.certify(s.volunteer, 'KDY');
    expect((await s.post('/reports/9999/field-updates', s.volunteer, { note: 'x' })).status).toBe(
      404,
    );
  });
});

describe('GET /locations/resolve (location → district)', () => {
  it('should resolve coordinates to the nearest district', async () => {
    const res = await s.get('/locations/resolve?lat=7.29&lng=80.63', s.citizen);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      code: 'KDY',
      name: 'Kandy',
      province: 'Central',
      distanceKm: 0,
    });
  });

  it('should report the distance to the centroid', async () => {
    const res = await s.get('/locations/resolve?lat=7.38&lng=80.63', s.volunteer);
    expect(res.body.data.name).toBe('Kandy');
    expect(res.body.data.distanceKm).toBeGreaterThan(9);
    expect(res.body.data.distanceKm).toBeLessThan(11);
  });

  it.each(['lat=13.08&lng=80.27', 'lat=abc&lng=80', 'lat=7.3', ''])(
    'should reject the query "%s" (400)',
    async (query) => {
      expect((await s.get(`/locations/resolve?${query}`, s.citizen)).status).toBe(400);
    },
  );
});
