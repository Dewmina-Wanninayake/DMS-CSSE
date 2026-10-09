import { afterEach, describe, expect, it, vi } from 'vitest';
import { groundReportingApi as api } from '../api/ground-reporting.api';

/** Pins the HTTP contract of docs/uc-cv-003-ground-reporting.md so client and server cannot drift apart. */
describe('ground reporting API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = async (invoke: () => Promise<unknown>) => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: [], meta: { page: 1, pageSize: 50, total: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await invoke();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, method: init.method, body: init.body };
  };

  const input = {
    hazardType: 'Flood' as const,
    description: 'Water rising',
    latitude: 7.25,
    longitude: 80.35,
    locationSource: 'Gps' as const,
  };

  it.each([
    ['hazardTypes', () => api.hazardTypes(), 'GET', '/api/v1/reports/hazard-types'],
    ['mine', () => api.mine({ pageSize: 50 }), 'GET', '/api/v1/reports/mine?pageSize=50'],
    [
      'mine with a status',
      () => api.mine({ status: 'Verified' }),
      'GET',
      '/api/v1/reports/mine?status=Verified',
    ],
    ['get', () => api.get(4), 'GET', '/api/v1/reports/4'],
    [
      'resolveLocation',
      () => api.resolveLocation(7.25, 80.35),
      'GET',
      '/api/v1/locations/resolve?lat=7.25&lng=80.35',
    ],
  ])('%s', async (_name, invoke, method, url) => {
    expect(await call(invoke)).toMatchObject({ method, url });
  });

  it.each([
    ['submit', () => api.submit(input), 'POST', '/api/v1/reports', input],
    [
      'sync',
      () => api.sync([{ ...input, clientId: 'c1' }]),
      'POST',
      '/api/v1/reports/sync',
      { reports: [{ ...input, clientId: 'c1' }] },
    ],
    [
      'update',
      () => api.update(4, { description: 'More detail' }),
      'PATCH',
      '/api/v1/reports/4',
      { description: 'More detail' },
    ],
    [
      'addFieldUpdate',
      () => api.addFieldUpdate(4, { note: 'Water over the bridge' }),
      'POST',
      '/api/v1/reports/4/field-updates',
      { note: 'Water over the bridge' },
    ],
  ])('%s', async (_name, invoke, method, url, body) => {
    const sent = await call(invoke);
    expect(sent).toMatchObject({ method, url });
    expect(JSON.parse(sent.body as string)).toEqual(body);
  });

  it('uploadPhoto sends the compressed photo as raw bytes with its own content type', async () => {
    const photo = new Blob(['abc'], { type: 'image/jpeg' });
    expect(await call(() => api.uploadPhoto(4, photo))).toEqual({
      method: 'PUT',
      url: '/api/v1/reports/4/photo',
      body: photo,
    });
  });
});
