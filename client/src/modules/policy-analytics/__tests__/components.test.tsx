import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsFilters, RegulatoryConflict } from '@dms/shared';
import { notification, policy, simulation, trendReport } from '../../../test/fixtures';
import { PolicyStatusBadge, RiskBadge, RiskLegend } from '../components/badges';
import {
  ConflictList,
  DeliveryStatusList,
  LatestReportsList,
  PolicySummary,
} from '../components/PolicyParts';
import {
  EMPTY_POLICY_FORM,
  PolicyDetailStep,
  PolicyMeasuresStep,
  toContent,
  toFormValues,
  validateDetail,
  type PolicyFormValues,
} from '../components/PolicyForm';
import { SimulationForm, SimulationSummary } from '../components/SimulationPanel';
import { TrendFilterForm } from '../components/TrendFilterForm';
import { TrendResults } from '../components/TrendResults';

vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('badges', () => {
  it('should show policy status and risk level as text', () => {
    render(
      <>
        <PolicyStatusBadge status="PendingApproval" />
        <RiskBadge level="High" />
      </>,
    );
    expect(screen.getByText('Pending approval')).toHaveClass('badge--warning');
    expect(screen.getByText('High risk')).toHaveClass('badge--danger');
  });

  it('should list every risk level with its zone in the legend', () => {
    render(<RiskLegend />);
    expect(screen.getAllByRole('listitem').map((n) => n.textContent)).toEqual([
      'High risk (Zone A)',
      'Medium risk (Zone B)',
      'Low risk (Zone C)',
    ]);
  });
});

describe('policy form helpers', () => {
  const filled: PolicyFormValues = {
    ...EMPTY_POLICY_FORM,
    title: '  Flood Act  ',
    description: 'desc',
    warningRiskThreshold: '7.5',
    proposedEffectiveDate: '2026-12-01',
  };

  it('should convert form values to content, trimming and parsing', () => {
    expect(toContent(filled)).toMatchObject({
      title: 'Flood Act',
      warningRiskThreshold: 7.5,
      proposedEffectiveDate: '2026-12-01',
    });
    expect(toContent(EMPTY_POLICY_FORM)).toMatchObject({
      warningRiskThreshold: null,
      proposedEffectiveDate: null,
    });
  });

  it('should round-trip content through form values', () => {
    const content = toContent(filled);
    expect(toContent(toFormValues(content))).toEqual(content);
    expect(
      toFormValues({ ...content, warningRiskThreshold: null, proposedEffectiveDate: null }),
    ).toMatchObject({
      warningRiskThreshold: '',
      proposedEffectiveDate: '',
    });
  });

  it('should validate the detail step against the same limits as the server', () => {
    const today = '2026-10-09';
    expect(validateDetail({ ...EMPTY_POLICY_FORM, title: 'abcd' }, today).title).toMatch(
      /at least 5/,
    );
    expect(validateDetail({ ...EMPTY_POLICY_FORM, title: 'x'.repeat(121) }, today).title).toMatch(
      /at most 120/,
    );
    expect(validateDetail({ ...EMPTY_POLICY_FORM, title: 'abcde' }, today)).toEqual({});
    expect(validateDetail({ ...EMPTY_POLICY_FORM, title: 'x'.repeat(120) }, today)).toEqual({});
    expect(
      validateDetail({ ...EMPTY_POLICY_FORM, title: 'valid', description: 'x'.repeat(2001) }, today)
        .description,
    ).toBeDefined();
    expect(
      validateDetail(
        { ...EMPTY_POLICY_FORM, title: 'valid', proposedEffectiveDate: '2026-10-08' },
        today,
      ).proposedEffectiveDate,
    ).toMatch(/today/);
    expect(
      validateDetail({ ...EMPTY_POLICY_FORM, title: 'valid', proposedEffectiveDate: today }, today),
    ).toEqual({});
  });

  it('should render the detail and measures steps and report edits', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PolicyDetailStep
        values={EMPTY_POLICY_FORM}
        errors={{ title: 'Enter a title' }}
        onChange={onChange}
        today="2026-10-09"
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title');
    await userEvent.type(screen.getByLabelText('Policy title'), 'A');
    expect(onChange).toHaveBeenCalledWith({ title: 'A' });
    expect(screen.getByLabelText('Proposed effective date')).toHaveAttribute('min', '2026-10-09');

    rerender(<PolicyMeasuresStep values={EMPTY_POLICY_FORM} errors={{}} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Land-use guidelines'), 'B');
    expect(onChange).toHaveBeenCalledWith({ landUseGuidelines: 'B' });
    await userEvent.type(screen.getByLabelText(/Warning threshold/), '6');
    expect(onChange).toHaveBeenCalledWith({ warningRiskThreshold: '6' });
  });
});

describe('TrendFilterForm (step 2)', () => {
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
      {
        id: 2,
        code: 'RAT',
        name: 'Ratnapura',
        province: 'Sabaragamuwa',
        latitude: 6.68,
        longitude: 80.4,
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
      {
        hazardType: 'Landslide',
        riskThreshold: 4,
        mediumRatio: 0.5,
        minDataPoints: 3,
        sourcePolicyId: 7,
        sourcePolicyKey: 'P-2026-002',
      },
    ],
  };

  it('should submit all districts with the default 90-day period ending today', async () => {
    const onSubmit = vi.fn();
    render(<TrendFilterForm filters={filters} busy={false} errors={{}} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Generate risk report' }));
    const request = onSubmit.mock.calls[0]?.[0];
    expect(request).toMatchObject({ hazardType: 'Flood', districtIds: 'all' });
    expect(request.periodStart < request.periodEnd).toBe(true);
  });

  it('should show the rule in force, including the policy that set it', async () => {
    render(<TrendFilterForm filters={filters} busy={false} errors={{}} onSubmit={vi.fn()} />);
    expect(screen.getByText(/above 5 verified reports/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Hazard type'), 'Landslide');
    expect(screen.getByText(/above 4 verified reports.*P-2026-002/)).toBeInTheDocument();
  });

  it('should require at least one district when not using all districts', async () => {
    const onSubmit = vi.fn();
    render(<TrendFilterForm filters={filters} busy={false} errors={{}} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByLabelText('All districts'));
    await userEvent.click(screen.getByRole('button', { name: 'Generate risk report' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one district');
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Kegalle'));
    await userEvent.click(screen.getByLabelText('Ratnapura'));
    await userEvent.click(screen.getByLabelText('Ratnapura')); // deselect again
    await userEvent.click(screen.getByRole('button', { name: 'Generate risk report' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ districtIds: [1] }));
  });

  it('should display server field errors and disable submission while busy', () => {
    render(
      <TrendFilterForm
        filters={filters}
        busy
        errors={{
          periodStart: 'The start date must not be after the end date.',
          districtIds: 'Unknown district',
        }}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('The start date must not be after the end date.')).toBeInTheDocument();
    expect(screen.getByText('Unknown district')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate risk report' })).toBeDisabled();
  });
});

describe('TrendResults (steps 4–5)', () => {
  it('should summarise the report and rank districts by risk', () => {
    inRouter(<TrendResults report={trendReport()} canFormulatePolicy />);
    const summary = within(screen.getByRole('group', { name: 'Summary' }));
    expect(summary.getByText('12')).toBeInTheDocument();
    expect(summary.getByText('Rising')).toBeInTheDocument();
    expect(summary.getByText(/\(\+25%\)/)).toBeInTheDocument();

    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Kegalle',
      'Ratnapura',
      'Galle',
    ]);
    expect(within(rows[0] as HTMLElement).getByText('High risk')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('120.5')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getAllByText('–')).toHaveLength(2);
  });

  it('should plot only districts with activity or elevated risk on the map', () => {
    inRouter(<TrendResults report={trendReport()} canFormulatePolicy />);
    const markers = within(
      screen.getByRole('list', { name: 'Map of district risk levels' }),
    ).getAllByRole('listitem');
    expect(markers.map((m) => m.textContent)).toEqual([
      'Kegalle: 8 verified, high risk',
      'Ratnapura: 3 verified, medium risk',
    ]);
    expect(markers[0]).toHaveAttribute('data-color', '#dc2626');
  });

  it('3a: should warn that the analysis is limited when data is sparse', () => {
    inRouter(<TrendResults report={trendReport({ sparse: true })} canFormulatePolicy />);
    expect(screen.getByRole('status')).toHaveTextContent(/Limited analysis/);
    expect(screen.getByRole('status')).toHaveTextContent(/at least 3 are needed/);
  });

  it('should explain when weather and river data is unavailable', () => {
    inRouter(
      <TrendResults report={trendReport({ hydrometAvailable: false })} canFormulatePolicy />,
    );
    expect(screen.getByText('Weather and river data unavailable')).toBeInTheDocument();
  });

  it('should link "Formulate policy" to the wizard with the report id, for analysts only', () => {
    const { unmount } = inRouter(
      <TrendResults report={trendReport({ id: 9 })} canFormulatePolicy />,
    );
    expect(screen.getByRole('link', { name: 'Formulate policy' })).toHaveAttribute(
      'href',
      '/policies/new?trendReportId=9',
    );
    unmount();
    inRouter(<TrendResults report={trendReport()} canFormulatePolicy={false} />);
    expect(screen.queryByRole('link', { name: 'Formulate policy' })).not.toBeInTheDocument();
  });

  it('should word a falling trend and a missing baseline sensibly', () => {
    const { unmount } = inRouter(
      <TrendResults
        report={trendReport({
          summary: { ...trendReport().summary, trendDirection: 'Falling', percentChange: -30 },
        })}
        canFormulatePolicy
      />,
    );
    expect(screen.getByText(/\(-30%\)/)).toBeInTheDocument();
    unmount();
    inRouter(
      <TrendResults
        report={trendReport({
          summary: { ...trendReport().summary, trendDirection: 'Stable', percentChange: null },
        })}
        canFormulatePolicy
      />,
    );
    expect(screen.getByText('Trend vs previous period')).toBeInTheDocument();
  });
});

describe('policy parts', () => {
  it('should list latest verified reports with relative time, or an empty state', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    const { unmount } = render(
      <LatestReportsList
        now={now}
        reports={[
          {
            id: 1,
            hazardType: 'Flood',
            description: 'River rising',
            districtName: 'Kegalle',
            verifiedAt: '2026-10-09T10:00:00Z',
          },
        ]}
      />,
    );
    expect(screen.getByText('Rising river / flood confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Kegalle district/)).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    unmount();
    render(<LatestReportsList reports={[]} />);
    expect(screen.getByText('No verified reports yet')).toBeInTheDocument();
  });

  it('12a: should show delivery status and flag failed notifications with their retry count', () => {
    render(
      <DeliveryStatusList
        notifications={[
          notification(),
          notification({
            id: 2,
            recipientName: 'Kasun',
            recipientRole: 'DutyOfficer',
            deliveryStatus: 'Failed',
            retryCount: 2,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Sent')).toBeInTheDocument();
    expect(screen.getByText('Failed (retries: 2)')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 notification could not be delivered');
    expect(screen.getByText(/Duty Officer/)).toBeInTheDocument();
  });

  it('should say so when nobody was notified, and omit the warning when all sent', () => {
    const { unmount } = render(<DeliveryStatusList notifications={[]} />);
    expect(screen.getByText('No notifications were sent for this policy.')).toBeInTheDocument();
    unmount();
    render(<DeliveryStatusList notifications={[notification()]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('8a: should name the field, clause and rule of each regulatory conflict', () => {
    const conflicts: RegulatoryConflict[] = [
      {
        ruleCode: 'REG-RIVER-RESERVE',
        field: 'landUseGuidelines',
        clause: 'Allow construction in flood plain.',
        message: 'Construction inside river reserves is prohibited.',
      },
    ];
    const { unmount } = render(<ConflictList conflicts={conflicts} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Land-use guidelines: “Allow construction in flood plain.”',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('REG-RIVER-RESERVE');
    unmount();
    const { container } = render(<ConflictList conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should summarise a policy like the hi-fi review cards', () => {
    const long = 'x'.repeat(200);
    render(
      <PolicySummary
        policy={policy({
          mitigationStrategies: long,
          simulationReference: 'S-2026-0001',
          proposedEffectiveDate: '2026-12-01',
        })}
      />,
    );
    expect(screen.getByLabelText('Policy summary')).toBeInTheDocument();
    expect(screen.getByText('National Flood Mitigation Act')).toBeInTheDocument();
    expect(screen.getByText('Kegalle, Ratnapura · Rising river / flood')).toBeInTheDocument();
    expect(screen.getByText('Dulaj Serasinghe')).toBeInTheDocument();
    expect(screen.getByText('S-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/1 Dec 2026/)).toBeInTheDocument();
    expect(screen.getByText(/^x+…$/).textContent?.length).toBeLessThan(150);
  });

  it('should fall back when there is no simulation, no date or no measures', () => {
    render(<PolicySummary policy={policy({ mitigationStrategies: '' })} />);
    expect(screen.getByText('No simulation run')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });
});

describe('simulation panels (step 7)', () => {
  it('should submit the model inputs', async () => {
    const onRun = vi.fn();
    render(<SimulationForm busy={false} errors={{}} onRun={onRun} />);
    await userEvent.clear(screen.getByLabelText('Rescue teams deployed'));
    await userEvent.type(screen.getByLabelText('Rescue teams deployed'), '4');
    await userEvent.clear(screen.getByLabelText('Shelters activated'));
    await userEvent.type(screen.getByLabelText('Shelters activated'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    expect(onRun).toHaveBeenCalledWith({ intensity: 5, teamsDeployed: 4, sheltersActivated: 12 });
  });

  it('should show server errors per field and block the button while running', () => {
    render(
      <SimulationForm
        busy
        errors={{ teamsDeployed: 'Deploy at least one team.' }}
        onRun={vi.fn()}
      />,
    );
    expect(screen.getByText('Deploy at least one team.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run simulation' })).toBeDisabled();
  });

  it('should present the four hi-fi tiles, the simulation id and status', () => {
    render(<SimulationSummary result={simulation()} />);
    expect(screen.getByRole('img', { name: /Evacuation times \(hours\)/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Affected area/ })).toBeInTheDocument();
    expect(screen.getByText('450,000 litres')).toBeInTheDocument();
    expect(screen.getByText('18,000 kg')).toBeInTheDocument();
    expect(screen.getByText('500 kits')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Predicted affected zone' })).toBeInTheDocument();
    expect(screen.getByText('S-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Status: Success')).toBeInTheDocument();
    expect(screen.getByText(/planning estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/shelters cover 40%/)).toBeInTheDocument();
  });
});
