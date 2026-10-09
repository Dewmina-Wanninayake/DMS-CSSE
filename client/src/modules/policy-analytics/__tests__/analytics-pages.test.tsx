import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type AnalyticsFilters } from '@dms/shared';
import { ApiError, NetworkError } from '../../../shared/api/api-client';
import { policy, trendReport } from '../../../test/fixtures';
import { renderWithApp } from '../../../test/render';
import { policyAnalyticsApi as api } from '../api/policy-analytics.api';
import { savePendingDraft } from '../lib/pending-drafts';
import { DashboardPage } from '../pages/DashboardPage';
import { HighRiskZonesPage } from '../pages/HighRiskZonesPage';
import { TrendAnalysisPage } from '../pages/TrendAnalysisPage';

vi.mock('../api/policy-analytics.api');
vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

beforeEach(() => vi.resetAllMocks());

const verified = [
  {
    id: 1,
    hazardType: 'Flood' as const,
    description: 'Water over the road',
    districtName: 'Kegalle',
    verifiedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: 2,
    hazardType: 'BlockedRoad' as const,
    description: 'Tree down',
    districtName: 'Ratnapura',
    verifiedAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
];

describe('Analyst dashboard (hi-fi analyst-dashboard)', () => {
  it('should show the four tools and the latest verified ground reports', async () => {
    vi.mocked(api.latestVerified).mockResolvedValue(verified);
    renderWithApp(<DashboardPage />, { role: Role.DisasterAnalyst });

    expect(screen.getByRole('heading', { level: 1, name: 'DMC Admin' })).toBeInTheDocument();
    const tools = within(screen.getByRole('navigation', { name: 'Analyst tools' }));
    expect(tools.getByRole('link', { name: 'Map view and overlays' })).toHaveAttribute(
      'href',
      '/analytics/map',
    );
    expect(tools.getByRole('link', { name: 'Data trend analysis' })).toHaveAttribute(
      'href',
      '/analytics/trends',
    );
    expect(tools.getByRole('link', { name: 'Submit policy updates' })).toHaveAttribute(
      'href',
      '/policies/new',
    );
    expect(tools.getByRole('link', { name: 'Policy status' })).toHaveAttribute('href', '/policies');
    // DA #6: verifying field reports is UC-DIST-02's job, so there is no such tile or tab here.
    expect(screen.queryByText(/Field report verification/i)).not.toBeInTheDocument();

    expect(screen.getByRole('status')).toHaveTextContent('Loading verified reports');
    expect(await screen.findByText('Rising river / flood confirmed')).toBeInTheDocument();
    expect(screen.getByText('Blocked road confirmed')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('should show an empty state when nothing is verified', async () => {
    vi.mocked(api.latestVerified).mockResolvedValue([]);
    renderWithApp(<DashboardPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByText('No verified reports yet')).toBeInTheDocument();
  });

  it('should show an error with a working retry', async () => {
    vi.mocked(api.latestVerified)
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Server exploded'))
      .mockResolvedValueOnce(verified);
    renderWithApp(<DashboardPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Rising river / flood confirmed')).toBeInTheDocument();
  });

  it('9a: should tell the analyst about drafts waiting to sync', async () => {
    vi.mocked(api.latestVerified).mockResolvedValue([]);
    vi.mocked(api.syncDrafts).mockRejectedValue(new NetworkError());
    savePendingDraft({
      clientId: 'c1',
      ownerId: 1,
      savedAt: '2026-10-09T08:00:00Z',
      trendReportId: 5,
      title: 'Offline',
      description: '',
      mitigationStrategies: '',
      landUseGuidelines: '',
      resourceRules: '',
      warningRiskThreshold: null,
      proposedEffectiveDate: null,
    });
    renderWithApp(<DashboardPage />, { role: Role.DisasterAnalyst, userId: 1 });
    expect(await screen.findByText(/1 draft is saved on this device/)).toBeInTheDocument();
  });
});

describe('Policy director dashboard', () => {
  it('should list policies awaiting approval with a link to review each', async () => {
    vi.mocked(api.listPolicies).mockResolvedValue({
      items: [
        policy({
          id: 3,
          status: 'PendingApproval',
          submittedAt: new Date(Date.now() - 600_000).toISOString(),
        }),
      ],
      meta: { page: 1, pageSize: 20, total: 1 },
    });
    renderWithApp(<DashboardPage />, { role: Role.PolicyDirector });

    expect(api.listPolicies).toHaveBeenCalledWith({ status: 'PendingApproval' });
    const link = await screen.findByRole('link', { name: /National Flood Mitigation Act/ });
    expect(link).toHaveAttribute('href', '/policies/3/review');
    expect(screen.getByRole('link', { name: /Awaiting your approval/ })).toHaveTextContent('1');
  });

  it('should say when there is nothing to approve', async () => {
    vi.mocked(api.listPolicies).mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
    renderWithApp(<DashboardPage />, { role: Role.PolicyDirector });
    expect(await screen.findByText('Nothing to approve')).toBeInTheDocument();
  });

  it('should show an error state with retry', async () => {
    vi.mocked(api.listPolicies).mockRejectedValue(new Error('no network'));
    renderWithApp(<DashboardPage />, { role: Role.PolicyDirector });
    expect(await screen.findByRole('alert')).toHaveTextContent('no network');
  });
});

describe('High-risk zones (hi-fi map-view-high-risk-zones)', () => {
  it('should open on the newest report with only the High overlay shown, and toggle overlays', async () => {
    vi.mocked(api.listTrendReports).mockResolvedValue([trendReport()]);
    renderWithApp(<HighRiskZonesPage />, { role: Role.DisasterAnalyst });

    const map = await screen.findByRole('list', { name: 'Map of high-risk zones' });
    expect(
      within(map)
        .getAllByRole('listitem')
        .map((n) => n.textContent),
    ).toEqual(['Kegalle: 8 verified reports (high risk)']);

    await userEvent.click(screen.getByLabelText('Zone B – medium risk'));
    expect(within(map).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(screen.getByLabelText('Zone A – high risk'));
    expect(
      within(map)
        .getAllByRole('listitem')
        .map((n) => n.textContent),
    ).toEqual(['Ratnapura: 3 verified reports (medium risk)']);
  });

  it('should say so when no overlay is selected', async () => {
    vi.mocked(api.listTrendReports).mockResolvedValue([trendReport()]);
    renderWithApp(<HighRiskZonesPage />, { role: Role.DisasterAnalyst });
    await screen.findByRole('list', { name: 'Map of high-risk zones' });
    await userEvent.click(screen.getByLabelText('Zone A – high risk'));
    expect(screen.getByText('No districts match the selected overlays.')).toBeInTheDocument();
  });

  it('should switch between saved reports', async () => {
    vi.mocked(api.listTrendReports).mockResolvedValue([
      trendReport({ id: 2 }),
      trendReport({
        id: 1,
        districts: [{ ...trendReport().districts[0]!, name: 'Matara', verifiedCount: 9 }],
      }),
    ]);
    renderWithApp(<HighRiskZonesPage />, { role: Role.DisasterAnalyst });
    await screen.findByRole('list', { name: 'Map of high-risk zones' });
    await userEvent.selectOptions(screen.getByLabelText('Report'), '1');
    expect(screen.getByText('Matara: 9 verified reports (high risk)')).toBeInTheDocument();
  });

  it('should invite the analyst to run a trend analysis when there is no report', async () => {
    vi.mocked(api.listTrendReports).mockResolvedValue([]);
    renderWithApp(<HighRiskZonesPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByText('No risk report yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Analyse trends' })).toHaveAttribute(
      'href',
      '/analytics/trends',
    );
  });

  it('should show an error state', async () => {
    vi.mocked(api.listTrendReports).mockRejectedValue(new Error('offline'));
    renderWithApp(<HighRiskZonesPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  });
});

describe('Trend analysis (steps 2–5)', () => {
  const filters: AnalyticsFilters = {
    districts: [
      {
        id: 1,
        code: 'KEG',
        name: 'Kegalle',
        province: 'Sabaragamuwa',
        latitude: 7.25,
        longitude: 80.35,
      },
    ],
    hazardTypes: ['Flood', 'Landslide'],
    thresholds: [
      {
        hazardType: 'Flood',
        riskThreshold: 5,
        mediumRatio: 0.5,
        minDataPoints: 3,
        sourcePolicyId: null,
        sourcePolicyKey: null,
      },
    ],
  };

  beforeEach(() => vi.mocked(api.filters).mockResolvedValue(filters));

  it('should request a report with the chosen parameters and show the results', async () => {
    vi.mocked(api.createTrendReport).mockResolvedValue(trendReport());
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });

    await userEvent.selectOptions(await screen.findByLabelText('Hazard type'), 'Landslide');
    await userEvent.click(screen.getByRole('button', { name: 'Generate risk report' }));

    expect(await screen.findByRole('group', { name: 'Summary' })).toBeInTheDocument();
    expect(api.createTrendReport).toHaveBeenCalledWith(
      expect.objectContaining({ hazardType: 'Landslide', districtIds: 'all' }),
    );
    expect(screen.getByRole('link', { name: 'Formulate policy' })).toHaveAttribute(
      'href',
      '/policies/new?trendReportId=5',
    );
  });

  it('3a: should warn that the report is limited when data is insufficient', async () => {
    vi.mocked(api.createTrendReport).mockResolvedValue(trendReport({ sparse: true }));
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });
    await userEvent.click(await screen.findByRole('button', { name: 'Generate risk report' }));
    expect(await screen.findByText('Limited analysis: not enough data')).toBeInTheDocument();
  });

  it('should show a server validation problem next to the field and no results', async () => {
    vi.mocked(api.createTrendReport).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The end date cannot be in the future.', [
        { field: 'periodStart', message: 'The end date cannot be in the future.' },
      ]),
    );
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });
    await userEvent.click(await screen.findByRole('button', { name: 'Generate risk report' }));
    expect(await screen.findByText('The end date cannot be in the future.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Summary' })).not.toBeInTheDocument();
  });

  it('should show an alert when the server cannot be reached', async () => {
    vi.mocked(api.createTrendReport).mockRejectedValue(new NetworkError());
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });
    await userEvent.click(await screen.findByRole('button', { name: 'Generate risk report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('should show a loading indicator while the report is being generated', async () => {
    let finish: (value: ReturnType<typeof trendReport>) => void = () => {};
    vi.mocked(api.createTrendReport).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });
    await userEvent.click(await screen.findByRole('button', { name: 'Generate risk report' }));
    expect(screen.getByText('Analysing verified reports…')).toBeInTheDocument();
    finish(trendReport());
    await waitFor(() =>
      expect(screen.queryByText('Analysing verified reports…')).not.toBeInTheDocument(),
    );
  });

  it('should show an error with retry when the form options fail to load', async () => {
    vi.mocked(api.filters)
      .mockReset()
      .mockRejectedValueOnce(new Error('options down'))
      .mockResolvedValueOnce(filters);
    renderWithApp(<TrendAnalysisPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByRole('alert')).toHaveTextContent('options down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByLabelText('Hazard type')).toBeInTheDocument();
  });
});
