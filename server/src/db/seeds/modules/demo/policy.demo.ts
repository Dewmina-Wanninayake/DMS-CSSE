import { DAY_MS, type DemoApi, type DemoSummary, type Json } from './demo-api';

/**
 * UC-DA-001: two trend reports and policies in every status: approved (after a simulation),
 * rejected then revised into a new version, waiting for the Director, and a plain draft.
 */
export async function seedPolicies(api: DemoApi, summary: DemoSummary) {
  const { ctx, as, district } = api;
  // ---- UC-DA-001: trend reports and policies in every status ---------------------------------
  const analyst = as('analyst@dms.lk');
  const director = as('director@dms.lk');
  const today = ctx.today();
  const periodStart = new Date(Date.parse(`${today}T00:00:00Z`) - 180 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const floodTrend = await analyst.post('/analytics/trend-reports', {
    hazardType: 'Flood',
    districtIds: ['KEG', 'RAT', 'GPH', 'KLT', 'CMB'].map((code) => district(code).id),
    periodStart,
    periodEnd: today,
  });
  const landslideTrend = await analyst.post('/analytics/trend-reports', {
    hazardType: 'Landslide',
    districtIds: ['NWE', 'BDL', 'KEG', 'KDY'].map((code) => district(code).id),
    periodStart,
    periodEnd: today,
  });
  const content = (title: string, extra: Json = {}) => ({
    title,
    description: 'Drafted from the six-month verified-report trend.',
    mitigationStrategies:
      'Pre-position boats and pumps in high-risk districts; issue early alerts at the policy threshold.',
    landUseGuidelines:
      'Keep a 30 m buffer along riverbanks; no new settlements on mapped flood plains.',
    resourceRules: 'Hold 5,000 litres of water and 1,200 kg of food per high-risk district.',
    warningRiskThreshold: null,
    proposedEffectiveDate: null,
    ...extra,
  });
  const draft = (trend: Json & { id: number }, title: string, extra: Json = {}) =>
    analyst.post('/policies/drafts', { trendReportId: trend.id, ...content(title, extra) });

  // Approved and published, after a simulation the Director could read.
  const approved = await draft(floodTrend, 'Kelani and Kalu basin flood early-action policy', {
    warningRiskThreshold: 6,
  });
  await analyst.post(`/policies/${approved.id}/simulations`, {
    intensity: 7,
    teamsDeployed: 6,
    sheltersActivated: 4,
  });
  await analyst.post(`/policies/${approved.id}/submit`);
  await director.post(`/policies/${approved.id}/review`, {
    decision: 'Approved',
    comments: 'Approved. The threshold matches the last two flood seasons.',
  });

  // Rejected with comments, then revised into a new Draft version.
  const rejected = await draft(landslideTrend, 'Hill-country landslide response policy');
  await analyst.post(`/policies/${rejected.id}/submit`);
  await director.post(`/policies/${rejected.id}/review`, {
    decision: 'Rejected',
    comments: 'Add the resource rules for the Nuwara Eliya estates before resubmitting.',
  });
  await analyst.post(`/policies/${rejected.id}/revise`);

  // Waiting for the Director, and a plain draft.
  const pending = await draft(floodTrend, 'Regional evacuation drill standard');
  await analyst.post(`/policies/${pending.id}/submit`);
  await draft(landslideTrend, 'Slope-monitoring guidelines for estates');
  summary.policies = 5;
}
