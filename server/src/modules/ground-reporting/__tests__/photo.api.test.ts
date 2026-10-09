import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, ReportStatus } from '@dms/shared';
import { bearer } from '../../../core/testing/test-env';
import { Scenario, api, jpegOfSize, pngOfSize } from './helpers';

let s: Scenario;
let reportId: number;
beforeEach(async () => {
  s = new Scenario();
  reportId = (await s.submit(s.citizen)).id;
});

describe('PUT /reports/:id/photo (critique #2 and #6)', () => {
  it('should store a JPEG and mark the report as having a photo', async () => {
    const res = await s.putPhoto(reportId, s.citizen, jpegOfSize(1000));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ mimeType: 'image/jpeg', sizeBytes: 1000 });
    const mine = await s.get('/reports/mine', s.citizen);
    expect(mine.body.data[0].hasPhoto).toBe(true);
  });

  it('should store a PNG and replace an earlier photo', async () => {
    await s.putPhoto(reportId, s.citizen, jpegOfSize(500));
    const res = await s.putPhoto(reportId, s.citizen, pngOfSize(700), 'image/png');
    expect(res.body.data).toEqual({ mimeType: 'image/png', sizeBytes: 700 });
    const count = s.env.db.prepare('SELECT COUNT(*) AS n FROM report_photos').get() as {
      n: number;
    };
    expect(count.n).toBe(1);
  });

  it('should accept exactly 2 MB and 2 MB - 1 byte (size boundary)', async () => {
    expect((await s.putPhoto(reportId, s.citizen, jpegOfSize(MAX_PHOTO_BYTES))).status).toBe(200);
    expect((await s.putPhoto(reportId, s.citizen, jpegOfSize(MAX_PHOTO_BYTES - 1))).status).toBe(
      200,
    );
  });

  it('should reject 2 MB + 1 byte with PHOTO_TOO_LARGE (422)', async () => {
    const res = await s.putPhoto(reportId, s.citizen, jpegOfSize(MAX_PHOTO_BYTES + 1));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_TOO_LARGE');
  });

  it('should answer a body above the parser limit with the same 422, not a 500', async () => {
    const res = await s.putPhoto(reportId, s.citizen, jpegOfSize(5 * 1024 * 1024));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_TOO_LARGE');
  });

  it.each(['image/gif', 'application/json', 'text/plain'])(
    'should reject the content type %s with PHOTO_INVALID_TYPE (422)',
    async (type) => {
      const res = await s.putPhoto(reportId, s.citizen, jpegOfSize(100), type);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('PHOTO_INVALID_TYPE');
    },
  );

  it('should reject a file whose bytes are not an image of the declared type', async () => {
    const res = await s.putPhoto(reportId, s.citizen, Buffer.from('definitely not a picture'));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_INVALID_TYPE');
  });

  it('should reject an empty body (400)', async () => {
    const res = await s.putPhoto(reportId, s.citizen, Buffer.alloc(0));
    expect(res.status).toBe(400);
  });

  it('should refuse another user (403) and an unknown report (404)', async () => {
    expect((await s.putPhoto(reportId, s.otherCitizen, jpegOfSize(100))).status).toBe(403);
    expect((await s.putPhoto(9999, s.citizen, jpegOfSize(100))).status).toBe(404);
    expect((await s.putPhoto('abc', s.citizen, jpegOfSize(100))).status).toBe(400);
  });

  it('should refuse a photo change once the report is Verified or Rejected (409)', async () => {
    s.setStatus(reportId, ReportStatus.Verified);
    const res = await s.putPhoto(reportId, s.citizen, jpegOfSize(100));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('should allow a new photo while the report needs information', async () => {
    s.setStatus(reportId, ReportStatus.NeedsInformation);
    expect((await s.putPhoto(reportId, s.citizen, jpegOfSize(100))).status).toBe(200);
  });

  it('should require authentication (401) and a reporter role (403)', async () => {
    const anonymous = await request(s.env.app)
      .put(api(`/reports/${reportId}/photo`))
      .set('Content-Type', 'image/jpeg')
      .send(jpegOfSize(10));
    expect(anonymous.status).toBe(401);
    expect((await s.putPhoto(reportId, s.officer, jpegOfSize(10))).status).toBe(403);
  });
});

describe('GET /reports/:id/photo', () => {
  beforeEach(async () => {
    await s.putPhoto(reportId, s.citizen, jpegOfSize(64));
  });

  it('should return the image bytes to the owner and to a duty officer', async () => {
    for (const actor of [s.citizen, s.officer]) {
      const res = await request(s.env.app)
        .get(api(`/reports/${reportId}/photo`))
        .set(bearer(actor.token));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/jpeg/);
      expect(Buffer.from(res.body).length).toBe(64);
    }
  });

  it('should refuse a different citizen (403)', async () => {
    expect((await s.get(`/reports/${reportId}/photo`, s.otherCitizen)).status).toBe(403);
  });

  it('should return 404 when the report has no photo or does not exist', async () => {
    const other = await s.submit(s.citizen, { latitude: 8.5, longitude: 81.2 });
    expect((await s.get(`/reports/${other.id}/photo`, s.citizen)).status).toBe(404);
    expect((await s.get('/reports/9999/photo', s.citizen)).status).toBe(404);
  });
});
