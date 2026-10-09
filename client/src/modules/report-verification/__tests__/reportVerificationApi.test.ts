import { afterEach, describe, expect, it, vi } from 'vitest';
import { Channel, Language, VerificationDecision, WarningLevel } from '@dms/shared';
import { reportVerificationApi as api } from '../api/reportVerificationApi';

describe('reportVerificationApi client', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = async (invoke: () => Promise<unknown>) => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: {}, meta: { page: 1, pageSize: 10, total: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await invoke();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return {
      url,
      method: init.method,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
  };

  it.each([
    ['getQueue', () => api.getQueue(), 'GET', '/api/v1/verification/queue'],
    ['getReportReview', () => api.getReportReview(1), 'GET', '/api/v1/verification/reports/1'],
    ['getWarningDelivery', () => api.getWarningDelivery(10), 'GET', '/api/v1/warnings/10/delivery'],
    ['getHazardTeamRules', () => api.getHazardTeamRules(), 'GET', '/api/v1/hazard-team-rules'],
  ])('%s', async (_name, invoke, method, url) => {
    expect(await call(invoke)).toMatchObject({ method, url });
  });

  it.each([
    [
      'submitDecision',
      () =>
        api.submitDecision(1, {
          decision: VerificationDecision.Verified,
          severity: 'High',
          notes: 'Verified via photo',
        }),
      'POST',
      '/api/v1/verification/reports/1/decision',
    ],
    [
      'previewWarning',
      () =>
        api.previewWarning({
          reportId: 1,
          level: WarningLevel.Warning,
          areaIds: [1],
          language: Language.English,
          channels: [Channel.Push],
        }),
      'POST',
      '/api/v1/warnings/preview',
    ],
    [
      'createWarning',
      () =>
        api.createWarning({
          reportId: 1,
          level: WarningLevel.Warning,
          areaIds: [1],
          reason: 'Severe flood warning',
          language: Language.Sinhala,
          channels: [Channel.Push, Channel.SMS],
        }),
      'POST',
      '/api/v1/warnings',
    ],
    [
      'approveWarning',
      () => api.approveWarning(10, { decision: 'Approved', notes: 'Approved' }),
      'POST',
      '/api/v1/warnings/10/approval',
    ],
    [
      'correctWarning',
      () => api.correctWarning(10, { action: 'Correct', level: WarningLevel.Watch }),
      'POST',
      '/api/v1/warnings/10/correction',
    ],
  ])('%s', async (_name, invoke, method, url) => {
    expect(await call(invoke)).toMatchObject({ method, url });
  });
});
