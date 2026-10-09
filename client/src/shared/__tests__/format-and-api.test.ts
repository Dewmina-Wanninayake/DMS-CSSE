import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  NetworkError,
  api,
  errorMessage,
  fieldErrorMap,
  setAuthToken,
  setUnauthorizedHandler,
  toQuery,
} from '../api/api-client';
import {
  addDays,
  formatDate,
  formatMonth,
  formatNumber,
  formatRelativeTime,
  toDayString,
} from '../format/format';
import { RISK_COLORS } from '../ui/risk-colors';

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  it.each([
    ['2026-10-09T11:59:40Z', 'Just now'],
    ['2026-10-09T11:55:00Z', '5 min ago'],
    ['2026-10-09T10:00:00Z', '2h ago'],
    ['2026-10-06T12:00:00Z', '3d ago'],
    ['2026-09-01T12:00:00Z', '1 Sept 2026'],
  ])('should format %s as "%s"', (iso, expected) => {
    expect(formatRelativeTime(iso, now).replace('Sep ', 'Sept ')).toBe(expected);
  });
});

describe('date and number formatting', () => {
  it('should format day strings and timestamps without timezone drift', () => {
    expect(formatDate('2026-10-09')).toMatch(/9 Oct 2026/);
    expect(formatDate('2026-10-09T23:30:00Z')).toMatch(/9 Oct 2026/);
    expect(formatMonth('2026-02')).toMatch(/Feb 2026/);
  });

  it('should format numbers with grouping and limited decimals', () => {
    expect(formatNumber(1234567.89, 0)).toBe('1,234,568');
    expect(formatNumber(2.456)).toBe('2.5');
  });

  it('should convert dates to local day strings and shift them', () => {
    expect(toDayString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDayString(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });
});

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });

  const respond = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue({ status, json: () => Promise.resolve(body) });

  it('should unwrap the success envelope and send JSON with the bearer token', async () => {
    const fetchMock = respond(200, { success: true, data: { id: 1 } });
    vi.stubGlobal('fetch', fetchMock);
    setAuthToken('abc');

    const data = await api.post<{ id: number }>('/things', { name: 'x' });

    expect(data).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/things');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"x"}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer abc',
      'Content-Type': 'application/json',
    });
  });

  it('should send no auth header or body for a plain GET', async () => {
    const fetchMock = respond(200, { success: true, data: [] });
    vi.stubGlobal('fetch', fetchMock);
    await api.get('/things');
    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect(init.headers).toEqual({});
    expect(init.body).toBeUndefined();
  });

  it('should return rows and paging meta for getPage, with a fallback meta', async () => {
    vi.stubGlobal(
      'fetch',
      respond(200, { success: true, data: [1, 2], meta: { page: 2, pageSize: 2, total: 9 } }),
    );
    expect(await api.getPage('/x')).toEqual({
      items: [1, 2],
      meta: { page: 2, pageSize: 2, total: 9 },
    });
    vi.stubGlobal('fetch', respond(200, { success: true, data: [1] }));
    expect((await api.getPage('/x')).meta.total).toBe(1);
  });

  it('should raise ApiError with code, message and field errors from the failure envelope', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Bad data',
          details: [{ field: 'title', message: 'Too short' }],
        },
      }),
    );
    const error = await api.put('/x', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Bad data' });
    expect(fieldErrorMap(error)).toEqual({ title: 'Too short' });
  });

  it('should call the unauthorized handler on a 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal(
      'fetch',
      respond(401, { success: false, error: { code: 'UNAUTHENTICATED', message: 'Expired' } }),
    );
    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('should raise NetworkError when the request cannot be sent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.get('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('should raise ApiError for a non-JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 502, json: () => Promise.reject(new Error('html')) }),
    );
    await expect(api.get('/x')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('should send PATCH requests', async () => {
    const fetchMock = respond(200, { success: true, data: { ok: true } });
    vi.stubGlobal('fetch', fetchMock);
    await api.patch('/x', { a: 1 });
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].method).toBe('PATCH');
  });

  it('should upload a file as the raw request body with its own content type', async () => {
    const fetchMock = respond(200, { success: true, data: { sizeBytes: 3 } });
    vi.stubGlobal('fetch', fetchMock);
    const file = new Blob(['abc'], { type: 'image/png' });
    await api.putFile('/reports/1/photo', file);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/reports/1/photo');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(file);
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('image/png');
  });

  it('should build query strings and skip undefined values', () => {
    expect(toQuery({ a: 1, b: undefined, c: 'x y', d: false })).toBe('?a=1&c=x+y&d=false');
    expect(toQuery({})).toBe('');
  });

  it('should give a safe message for any error value', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('weird')).toMatch(/try again/);
    expect(fieldErrorMap(new Error('x'))).toEqual({});
    expect(new ApiError(400, 'X', 'm', 'not-an-array').fieldErrors).toEqual([]);
  });
});

describe('design tokens', () => {
  it('should keep the map colours equal to the risk tokens in tokens.css', () => {
    const css = readFileSync(join(import.meta.dirname, '../styles/tokens.css'), 'utf8');
    const token = (name: string) =>
      new RegExp(`--color-risk-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];
    expect(RISK_COLORS.High).toBe(token('high'));
    expect(RISK_COLORS.Medium).toBe(token('medium'));
    expect(RISK_COLORS.Low).toBe(token('low'));
  });

  it('should use the navy primary sampled from the hi-fi', () => {
    const css = readFileSync(join(import.meta.dirname, '../styles/tokens.css'), 'utf8');
    expect(css).toMatch(/--color-primary:\s*#1b365d/i);
    expect(css).toMatch(/--color-bg:\s*#f8fafc/i);
  });
});
