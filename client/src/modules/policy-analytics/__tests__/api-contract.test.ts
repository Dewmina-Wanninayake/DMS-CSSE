import { afterEach, describe, expect, it, vi } from 'vitest';
import { policyAnalyticsApi as api } from '../api/policy-analytics.api';

/** Pins the HTTP contract of docs/api/policy-analytics.md so client and server cannot drift apart silently. */
describe('policy analytics API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = async (invoke: () => Promise<unknown>) => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () =>
        Promise.resolve({ success: true, data: [], meta: { page: 1, pageSize: 10, total: 0 } }),
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

  const content = {
    title: 'T',
    description: '',
    mitigationStrategies: '',
    landUseGuidelines: '',
    resourceRules: '',
    warningRiskThreshold: null,
    proposedEffectiveDate: null,
  };

  it.each([
    ['filters', () => api.filters(), 'GET', '/api/v1/analytics/filters'],
    [
      'latestVerified',
      () => api.latestVerified(3),
      'GET',
      '/api/v1/analytics/verified-reports/latest?limit=3',
    ],
    [
      'latestVerified without a limit',
      () => api.latestVerified(),
      'GET',
      '/api/v1/analytics/verified-reports/latest',
    ],
    ['getTrendReport', () => api.getTrendReport(4), 'GET', '/api/v1/analytics/trend-reports/4'],
    ['listTrendReports', () => api.listTrendReports(), 'GET', '/api/v1/analytics/trend-reports'],
    [
      'listPolicies',
      () => api.listPolicies({ status: 'Draft', page: 2, pageSize: 5, mine: true }),
      'GET',
      '/api/v1/policies?status=Draft&page=2&pageSize=5&mine=true',
    ],
    ['listPolicies without filters', () => api.listPolicies(), 'GET', '/api/v1/policies'],
    ['getPolicy', () => api.getPolicy(7), 'GET', '/api/v1/policies/7'],
    ['checkConflicts', () => api.checkConflicts(7), 'GET', '/api/v1/policies/7/conflicts'],
    [
      'policyNotifications',
      () => api.policyNotifications(7),
      'GET',
      '/api/v1/policies/7/notifications',
    ],
  ])('%s', async (_name, invoke, method, url) => {
    expect(await call(invoke)).toMatchObject({ method, url });
  });

  it.each([
    [
      'createTrendReport',
      () =>
        api.createTrendReport({
          hazardType: 'Flood',
          districtIds: 'all',
          periodStart: '2026-01-01',
          periodEnd: '2026-02-01',
        }),
      'POST',
      '/api/v1/analytics/trend-reports',
    ],
    [
      'createDraft',
      () => api.createDraft({ ...content, trendReportId: 1 }),
      'POST',
      '/api/v1/policies/drafts',
    ],
    ['updateDraft', () => api.updateDraft(7, content), 'PATCH', '/api/v1/policies/7'],
    ['submitPolicy', () => api.submitPolicy(7), 'POST', '/api/v1/policies/7/submit'],
    [
      'reviewPolicy',
      () => api.reviewPolicy(7, { decision: 'Approved', comments: '' }),
      'POST',
      '/api/v1/policies/7/review',
    ],
    ['revisePolicy', () => api.revisePolicy(7), 'POST', '/api/v1/policies/7/revise'],
    [
      'runSimulation',
      () => api.runSimulation(7, { intensity: 5, teamsDeployed: 2, sheltersActivated: 1 }),
      'POST',
      '/api/v1/policies/7/simulations',
    ],
  ])('%s', async (_name, invoke, method, url) => {
    expect(await call(invoke)).toMatchObject({ method, url });
  });

  it('should wrap offline drafts as { drafts } for the sync endpoint', async () => {
    const result = await call(() =>
      api.syncDrafts([{ ...content, trendReportId: 1, clientId: 'c1' }]),
    );
    expect(result).toMatchObject({ method: 'POST', url: '/api/v1/policies/sync' });
    expect(result.body.drafts).toHaveLength(1);
  });

  it('should send the draft content as the PATCH body', async () => {
    expect((await call(() => api.updateDraft(7, content))).body).toEqual(content);
  });
});
