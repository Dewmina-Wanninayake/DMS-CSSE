import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type PolicyDto } from '@dms/shared';
import { ApiError, NetworkError } from '../../../shared/api/api-client';
import { notification, policy, simulation, trendReport } from '../../../test/fixtures';
import { renderWithApp } from '../../../test/render';
import { policyAnalyticsApi as api } from '../api/policy-analytics.api';
import { loadPendingDrafts, savePendingDraft } from '../hooks/pending-drafts';
import { DirectorReviewPage } from '../pages/DirectorReviewPage';
import { PolicyDetailPage } from '../pages/PolicyDetailPage';
import { PolicyListPage } from '../pages/PolicyListPage';
import { PolicyWizardPage } from '../pages/PolicyWizardPage';

vi.mock('../api/policy-analytics.api');
vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.syncDrafts).mockResolvedValue([]);
});

const page = (items: PolicyDto[], total = items.length) => ({
  items,
  meta: { page: 1, pageSize: 10, total },
});

describe('Policy list', () => {
  it('should list policies with their status badges and links', async () => {
    vi.mocked(api.listPolicies).mockResolvedValue(
      page([
        policy({ id: 1 }),
        policy({ id: 2, title: 'Landslide plan', status: 'Rejected', policyKey: 'P-2026-002' }),
      ]),
    );
    renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst });

    const link = await screen.findByRole('link', { name: 'National Flood Mitigation Act' });
    expect(link).toHaveAttribute('href', '/policies/1');
    expect(screen.getByText('Draft', { selector: '.badge' })).toHaveClass('badge--neutral');
    expect(screen.getByText('Rejected', { selector: '.badge' })).toHaveClass('badge--danger');
    expect(screen.getByText('P-2026-002 · version 1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New policy/ })).toHaveAttribute(
      'href',
      '/policies/new',
    );
  });

  it('should filter by status through the URL and request that status', async () => {
    vi.mocked(api.listPolicies).mockResolvedValue(page([]));
    renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst, route: '/policies' });
    await screen.findByText('No policies yet');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PendingApproval');
    await waitFor(() =>
      expect(api.listPolicies).toHaveBeenLastCalledWith({
        status: 'PendingApproval',
        page: 1,
        pageSize: 10,
      }),
    );
    expect(await screen.findByText('No pending approval policies')).toBeInTheDocument();
  });

  it('should page through results', async () => {
    vi.mocked(api.listPolicies).mockImplementation(async (params) =>
      page([policy({ id: params?.page ?? 1, title: `Policy on page ${params?.page ?? 1}` })], 25),
    );
    renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByText('Policy on page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3 · 25 policies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Policy on page 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Policy on page 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('should tell the director that policies appear when analysts submit them, with no create button', async () => {
    vi.mocked(api.listPolicies).mockResolvedValue(page([]));
    renderWithApp(<PolicyListPage />, { role: Role.PolicyDirector });
    expect(
      await screen.findByText('Policies submitted by analysts appear here.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /New policy/ })).not.toBeInTheDocument();
  });

  it('should show an error state with retry', async () => {
    vi.mocked(api.listPolicies)
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(page([policy()]));
    renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst });
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('link', { name: 'National Flood Mitigation Act' }),
    ).toBeInTheDocument();
  });

  describe('Pending Sync (extension 9a)', () => {
    const local = {
      clientId: 'c1',
      ownerId: 1,
      savedAt: '2026-10-09T08:00:00Z',
      trendReportId: 5,
      title: 'Written offline',
      description: 'd',
      mitigationStrategies: 'm',
      landUseGuidelines: '',
      resourceRules: '',
      warningRiskThreshold: null,
      proposedEffectiveDate: null,
    };

    it('should show local drafts as Pending sync and upload them, reloading the list', async () => {
      savePendingDraft(local);
      vi.mocked(api.listPolicies).mockResolvedValue(page([]));
      vi.mocked(api.syncDrafts).mockResolvedValue([
        { clientId: 'c1', outcome: 'Created', policyId: 20 },
      ]);
      renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst, userId: 1 });

      await waitFor(() =>
        expect(screen.getByText('1 offline draft uploaded.')).toBeInTheDocument(),
      );
      expect(vi.mocked(api.listPolicies).mock.calls.length).toBeGreaterThanOrEqual(2); // reloaded after the upload
      expect(loadPendingDrafts(1)).toEqual([]);
    });

    it('should keep a draft the server refused and explain why', async () => {
      savePendingDraft(local);
      vi.mocked(api.listPolicies).mockResolvedValue(page([]));
      vi.mocked(api.syncDrafts).mockResolvedValue([
        {
          clientId: 'c1',
          outcome: 'Conflict',
          policyId: null,
          message: 'Trend report was not found.',
        },
      ]);
      renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst, userId: 1 });
      expect(await screen.findByText('Sync failed')).toBeInTheDocument();
      expect(screen.getByText(/Could not sync: Trend report was not found\./)).toBeInTheDocument();
      expect(screen.getByText('Written offline')).toBeInTheDocument();
    });

    it('should offer "Sync now" and surface a server error', async () => {
      savePendingDraft(local);
      vi.mocked(api.listPolicies).mockResolvedValue(page([]));
      vi.mocked(api.syncDrafts).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Not allowed'));
      renderWithApp(<PolicyListPage />, { role: Role.DisasterAnalyst, userId: 1 });
      expect(await screen.findByText('Not allowed')).toBeInTheDocument();
      expect(screen.getByText('Pending sync')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Sync now' }));
      await waitFor(() => expect(api.syncDrafts).toHaveBeenCalledTimes(2));
    });
  });
});

describe('Policy wizard (steps 6–9)', () => {
  const route = '/policies/new?trendReportId=5';
  const open = (role: Role = Role.DisasterAnalyst) =>
    renderWithApp(<PolicyWizardPage />, { route, path: '/policies/new', role, userId: 1 });
  const ids = { policyId: 11 };

  beforeEach(() => {
    vi.mocked(api.getTrendReport).mockResolvedValue(trendReport());
    vi.mocked(api.createDraft).mockResolvedValue(policy({ id: ids.policyId }));
    vi.mocked(api.updateDraft).mockResolvedValue(policy({ id: ids.policyId, title: 'Flood Act' }));
    vi.mocked(api.getPolicy).mockResolvedValue(
      policy({ id: ids.policyId, simulationReference: 'S-2026-0001' }),
    );
    vi.mocked(api.checkConflicts).mockResolvedValue([]);
    vi.mocked(api.runSimulation).mockResolvedValue(simulation());
    vi.mocked(api.submitPolicy).mockResolvedValue(
      policy({ id: ids.policyId, status: 'PendingApproval', submittedAt: '2026-10-09T10:00:00Z' }),
    );
    vi.mocked(api.policyNotifications).mockResolvedValue([notification()]);
  });

  const fillDetail = async (title = 'Flood Act') => {
    await userEvent.type(await screen.findByLabelText('Policy title'), title);
  };

  it('should show a true step counter and validate step 1 before saving', async () => {
    open();
    expect(await screen.findByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Step 1 of 4: Policy detail',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    expect(await screen.findByText(/Enter a title of at least 5 characters/)).toBeInTheDocument();
    expect(api.createDraft).not.toHaveBeenCalled();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('should walk through all four steps and submit for approval after confirmation', async () => {
    open();
    await fillDetail();
    await userEvent.type(screen.getByLabelText('Description'), 'Reduce losses');

    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    expect(await screen.findByText('Step 2 of 4')).toBeInTheDocument();
    expect(api.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        trendReportId: 5,
        title: 'Flood Act',
        clientId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      }),
    );

    await userEvent.type(screen.getByLabelText('Mitigation strategies'), 'Early alerts');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    expect(await screen.findByText('Step 3 of 4')).toBeInTheDocument();
    expect(api.updateDraft).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ mitigationStrategies: 'Early alerts' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Run simulation' }));
    expect(await screen.findByText('S-2026-0001')).toBeInTheDocument();
    expect(api.runSimulation).toHaveBeenCalledWith(11, {
      intensity: 5,
      teamsDeployed: 10,
      sheltersActivated: 10,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Next: review' }));
    expect(await screen.findByText('Step 4 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Policy summary')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const dialog = screen.getByRole('dialog', { name: 'Submit for approval?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit for approval' }));

    expect(await screen.findByText('Submitted for approval')).toBeInTheDocument();
    expect(api.submitPolicy).toHaveBeenCalledWith(11);
    expect(screen.getByText('Nimali Perera')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View policy' })).toHaveAttribute(
      'href',
      '/policies/11',
    );
  });

  it('7: should let the analyst skip the optional simulation', async () => {
    vi.mocked(api.getPolicy).mockResolvedValue(
      policy({ id: ids.policyId, simulationReference: null }),
    );
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Skip simulation' }));
    expect(await screen.findByText('Step 4 of 4')).toBeInTheDocument();
    expect(api.runSimulation).not.toHaveBeenCalled();
    expect(screen.getByText('No simulation run')).toBeInTheDocument();
  });

  it('should explain simulation is unavailable for other hazards and still allow continuing', async () => {
    vi.mocked(api.getTrendReport).mockResolvedValue(trendReport({ hazardType: 'BlockedRoad' }));
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    expect(
      await screen.findByText(/available for flood and landslide policies only/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run simulation' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next: review' }));
    expect(await screen.findByText('Step 4 of 4')).toBeInTheDocument();
  });

  it('should show simulation errors next to the fields', async () => {
    vi.mocked(api.runSimulation).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', [
        { field: 'teamsDeployed', message: 'Deploy at least one team.' },
      ]),
    );
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Run simulation' }));
    expect(await screen.findByText('Deploy at least one team.')).toBeInTheDocument();
  });

  it('8a: should flag regulatory conflicts at review and block submission until fixed', async () => {
    vi.mocked(api.checkConflicts).mockResolvedValue([
      {
        ruleCode: 'REG-RIVER-RESERVE',
        field: 'landUseGuidelines',
        clause: 'Allow construction in flood plain.',
        message: 'Construction inside river reserves is prohibited.',
      },
    ]);
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Skip simulation' }));
    expect(
      await screen.findByText(/conflicts with national regulatory standards/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
    expect(await screen.findByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('8a: should show the conflict list when the server rejects the submission with 422', async () => {
    vi.mocked(api.submitPolicy).mockRejectedValue(
      new ApiError(
        422,
        'REGULATORY_CONFLICT',
        'The policy conflicts with national regulatory standards.',
        [
          {
            ruleCode: 'REG-EVACUATION',
            field: 'resourceRules',
            clause: 'Waive mandatory evacuation.',
            message: 'Evacuations cannot be waived.',
          },
        ],
      ),
    );
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Skip simulation' }));
    await screen.findByText('Step 4 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit for approval' }),
    );
    expect(await screen.findByText(/Waive mandatory evacuation\./)).toBeInTheDocument();
    expect(screen.getByText('Resource allocation rules:')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });

  it('should allow cancelling the confirmation without submitting', async () => {
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    await screen.findByText('Step 2 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Skip simulation' }));
    await screen.findByText('Step 4 of 4');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.submitPolicy).not.toHaveBeenCalled();
  });

  it('should keep the analyst on the step and show the message when saving fails', async () => {
    vi.mocked(api.createDraft).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', [
        { field: 'title', message: 'The title needs at least 5 characters.' },
      ]),
    );
    open();
    await fillDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
    expect(await screen.findByText('The request contains invalid data.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  describe('offline (extension 9a)', () => {
    it('should store a new draft on the device, mark it Pending Sync and allow writing step 2', async () => {
      vi.mocked(api.createDraft).mockRejectedValue(new NetworkError());
      vi.mocked(api.updateDraft).mockRejectedValue(new NetworkError());
      open();
      await fillDetail('Offline plan');
      await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));

      expect(await screen.findByText('Step 2 of 4')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Saved on this device (Pending Sync)');
      expect(loadPendingDrafts(1)).toEqual([
        expect.objectContaining({ title: 'Offline plan', trendReportId: 5 }),
      ]);

      // Simulation and submission need the draft on the server, so step 2 cannot advance offline.
      await userEvent.type(screen.getByLabelText('Mitigation strategies'), 'Notes');
      await userEvent.click(screen.getByRole('button', { name: 'Next: simulation' }));
      await waitFor(() => expect(loadPendingDrafts(1)[0]?.mitigationStrategies).toBe('Notes'));
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    it('should explain when the device cannot store the draft either', async () => {
      vi.mocked(api.createDraft).mockRejectedValue(new NetworkError());
      open();
      await fillDetail();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });
      await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
      expect(await screen.findByText(/could not store the draft/)).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
      vi.restoreAllMocks();
    });

    it('should show the offline banner while the browser is offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      open();
      await fillDetail();
      expect(screen.getByRole('status')).toHaveTextContent('You are offline');
      vi.restoreAllMocks();
    });
  });

  describe('entry points', () => {
    it('should offer saved trend reports when started without one, and continue with the chosen report', async () => {
      vi.mocked(api.listTrendReports).mockResolvedValue([
        trendReport({ id: 8 }),
        trendReport({ id: 3, hazardType: 'Landslide' }),
      ]);
      renderWithApp(<PolicyWizardPage />, {
        route: '/policies/new',
        path: '/policies/new',
        role: Role.DisasterAnalyst,
      });
      await userEvent.selectOptions(await screen.findByLabelText('Trend report'), '3');
      await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(api.getTrendReport).toHaveBeenCalledWith(3)); // now starting from report 3
    });

    it('should send the analyst to run a trend analysis when no report exists', async () => {
      vi.mocked(api.listTrendReports).mockResolvedValue([]);
      renderWithApp(<PolicyWizardPage />, {
        route: '/policies/new',
        path: '/policies/new',
        role: Role.DisasterAnalyst,
      });
      expect(await screen.findByText('No trend report yet')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Analyse trends' })).toBeInTheDocument();
    });

    it('should show an error when the trend report cannot be loaded', async () => {
      vi.mocked(api.getTrendReport).mockRejectedValue(
        new ApiError(404, 'NOT_FOUND', 'Trend report was not found.'),
      );
      open();
      expect(await screen.findByRole('alert')).toHaveTextContent('Trend report was not found.');
    });

    it('should continue editing an existing draft with its saved values', async () => {
      vi.mocked(api.getPolicy).mockResolvedValue(
        policy({ id: 11, title: 'Saved draft', description: 'Saved description' }),
      );
      renderWithApp(<PolicyWizardPage />, {
        route: '/policies/11/edit',
        path: '/policies/:id/edit',
        role: Role.DisasterAnalyst,
      });
      expect(await screen.findByDisplayValue('Saved draft')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Saved description')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Next: measures' }));
      await screen.findByText('Step 2 of 4');
      expect(api.updateDraft).toHaveBeenCalledWith(
        11,
        expect.objectContaining({ title: 'Saved draft' }),
      );
      expect(api.createDraft).not.toHaveBeenCalled();
    });

    it('should open a non-draft policy read-only instead of editing it', async () => {
      vi.mocked(api.getPolicy).mockResolvedValue(policy({ id: 11, status: 'PendingApproval' }));
      renderWithApp(<PolicyWizardPage />, {
        route: '/policies/11/edit',
        path: '/policies/:id/edit',
        role: Role.DisasterAnalyst,
      });
      expect(await screen.findByText('other page')).toBeInTheDocument();
      expect(screen.queryByLabelText('Policy title')).not.toBeInTheDocument();
    });
  });
});

describe('Policy detail', () => {
  const open = (p: PolicyDto, role: Role, userId = 1, notifications = [notification()]) => {
    vi.mocked(api.getPolicy).mockResolvedValue(p);
    vi.mocked(api.policyNotifications).mockResolvedValue(notifications);
    return renderWithApp(<PolicyDetailPage />, {
      route: `/policies/${p.id}`,
      path: '/policies/:id',
      role,
      userId,
    });
  };

  it('should show the content, status and delivery of a pending policy, with a review link for the director', async () => {
    open(
      policy({
        status: 'PendingApproval',
        landUseGuidelines: 'Buffer zones.',
        warningRiskThreshold: 7,
      }),
      Role.PolicyDirector,
      2,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'National Flood Mitigation Act' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText('Buffer zones.')).toBeInTheDocument();
    expect(screen.getAllByText('Not provided.')).toHaveLength(1);
    expect(screen.getByText('7 verified reports per district.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review this policy' })).toHaveAttribute(
      'href',
      '/policies/11/review',
    );
    expect(screen.getByText('Nimali Perera')).toBeInTheDocument();
  });

  it('should let the author continue editing a draft and not show review actions', async () => {
    open(policy(), Role.DisasterAnalyst);
    expect(await screen.findByRole('link', { name: 'Continue editing' })).toHaveAttribute(
      'href',
      '/policies/11/edit',
    );
    expect(screen.queryByRole('link', { name: 'Review this policy' })).not.toBeInTheDocument();
  });

  it('should hide edit actions from another analyst', async () => {
    open(policy(), Role.DisasterAnalyst, 99);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('link', { name: 'Continue editing' })).not.toBeInTheDocument();
  });

  it('10a: should show the rejection comments and let the author revise it as a new version', async () => {
    vi.mocked(api.revisePolicy).mockResolvedValue(policy({ id: 12, version: 2 }));
    open(
      policy({
        status: 'Rejected',
        review: {
          decision: 'Rejected',
          comments: 'Needs a funding plan.',
          reviewerName: 'Nimali Perera',
          decidedAt: '2026-10-05T00:00:00Z',
        },
      }),
      Role.DisasterAnalyst,
    );
    expect(await screen.findByText('Rejected by Nimali Perera')).toBeInTheDocument();
    expect(screen.getByText(/Needs a funding plan\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revise as new version' }));
    expect(api.revisePolicy).toHaveBeenCalledWith(11);
    expect(await screen.findByText('other page')).toBeInTheDocument(); // navigated to /policies/12/edit
  });

  it('should show why a revision failed and re-enable the button', async () => {
    vi.mocked(api.revisePolicy).mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'This policy has already been revised.'),
    );
    open(policy({ status: 'Rejected' }), Role.DisasterAnalyst);
    await userEvent.click(await screen.findByRole('button', { name: 'Revise as new version' }));
    expect(await screen.findByText('This policy has already been revised.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revise as new version' })).toBeEnabled();
  });

  it('should show an approved policy with its effective date, and no revise button once superseded', async () => {
    const approved = policy({
      status: 'Approved',
      effectiveDate: '2026-10-09',
      review: {
        decision: 'Approved',
        comments: 'Good.',
        reviewerName: 'Nimali Perera',
        decidedAt: '2026-10-09T00:00:00Z',
      },
    });
    const { unmount } = open(approved, Role.DisasterAnalyst);
    expect(await screen.findByText('Approved by Nimali Perera')).toBeInTheDocument();
    expect(screen.getByText(/In force from 9 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revise as new version' })).toBeInTheDocument();
    unmount();

    open({ ...approved, supersededBy: 30 }, Role.DisasterAnalyst);
    expect(
      await screen.findByText('A newer version of this policy has been approved.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revise as new version' })).not.toBeInTheDocument();
  });

  it('should show an error state when the policy cannot be loaded', async () => {
    vi.mocked(api.getPolicy).mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Policy was not found.'),
    );
    vi.mocked(api.policyNotifications).mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Policy was not found.'),
    );
    renderWithApp(<PolicyDetailPage />, {
      route: '/policies/11',
      path: '/policies/:id',
      role: Role.DisasterAnalyst,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Policy was not found.');
  });
});

describe('Director review (steps 10–13, 10a)', () => {
  const pending = policy({
    status: 'PendingApproval',
    submittedAt: '2026-10-09T09:00:00Z',
    proposedEffectiveDate: '2026-12-01',
  });

  beforeEach(() => {
    vi.mocked(api.getPolicy).mockResolvedValue(pending);
    vi.mocked(api.getTrendReport).mockResolvedValue(trendReport());
    vi.mocked(api.policyNotifications).mockResolvedValue([
      notification({
        recipientName: 'Kasun Fernando',
        recipientRole: 'DutyOfficer',
        subject: 'New policy published',
      }),
      notification({
        id: 3,
        recipientName: 'Chamara',
        recipientRole: 'RescueTeamLeader',
        deliveryStatus: 'Failed',
        retryCount: 1,
      }),
    ]);
  });

  const open = () =>
    renderWithApp(<DirectorReviewPage />, {
      route: '/policies/11/review',
      path: '/policies/:id/review',
      role: Role.PolicyDirector,
      userId: 2,
    });

  it('should show the draft with its evidence and default the date to the analyst’s proposal', async () => {
    open();
    expect(await screen.findByText('Review draft policy')).toBeInTheDocument();
    expect(screen.getByLabelText('Policy summary')).toBeInTheDocument();
    expect(screen.getByText(/12 verified reports, 1 high-risk districts/)).toBeInTheDocument();
    expect(screen.getByLabelText('Effective date')).toHaveValue('2026-12-01');
  });

  it('should approve after confirmation and report who was notified, including failures', async () => {
    vi.mocked(api.reviewPolicy).mockResolvedValue(
      policy({ status: 'Approved', effectiveDate: '2026-12-01' }),
    );
    open();
    await userEvent.type(await screen.findByLabelText('Comments'), 'Looks good.');
    await userEvent.click(screen.getByRole('button', { name: 'Approve and publish' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and publish' }),
    );

    expect(await screen.findByText('Approved and published')).toBeInTheDocument();
    expect(api.reviewPolicy).toHaveBeenCalledWith(11, {
      decision: 'Approved',
      comments: 'Looks good.',
      effectiveDate: '2026-12-01',
    });
    expect(screen.getByText(/in force from 1 Dec 2026/)).toBeInTheDocument();
    expect(screen.getByText('Kasun Fernando')).toBeInTheDocument();
    expect(screen.getByText('Failed (retries: 1)')).toBeInTheDocument();
  });

  it('should use the date the director typed', async () => {
    vi.mocked(api.reviewPolicy).mockResolvedValue(policy({ status: 'Approved' }));
    open();
    const date = await screen.findByLabelText('Effective date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Approve and publish' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and publish' }),
    );
    await screen.findByText('Approved and published');
    expect(api.reviewPolicy).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ effectiveDate: '2027-01-15' }),
    );
  });

  it('10a: should require comments to reject, then reject after confirmation', async () => {
    vi.mocked(api.reviewPolicy).mockResolvedValue(policy({ status: 'Rejected' }));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    expect(screen.getByText(/Explain the rejection in at least 5 characters/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.reviewPolicy).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Comments'), 'Needs a funding plan');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject policy' }),
    );
    expect(await screen.findByText('Rejected', { selector: '.alert__title' })).toBeInTheDocument();
    expect(api.reviewPolicy).toHaveBeenCalledWith(11, {
      decision: 'Rejected',
      comments: 'Needs a funding plan',
      effectiveDate: undefined,
    });
  });

  it('should show the server message and keep the form when the decision fails', async () => {
    vi.mocked(api.reviewPolicy).mockRejectedValue(
      new ApiError(
        409,
        'INVALID_STATE_TRANSITION',
        'A policy that is Approved cannot become Rejected.',
      ),
    );
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Approve and publish' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve and publish' }),
    );
    expect(
      await screen.findByText('A policy that is Approved cannot become Rejected.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeEnabled();
  });

  it('should not offer a decision on a policy that is not pending', async () => {
    vi.mocked(api.getPolicy).mockResolvedValue(policy({ status: 'Approved' }));
    open();
    expect(
      await screen.findByText(/This policy is approved and cannot be reviewed/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve and publish' })).not.toBeInTheDocument();
  });

  it('should note when no district was above the threshold', async () => {
    vi.mocked(api.getTrendReport).mockResolvedValue(
      trendReport({ districts: [trendReport().districts[2]!] }),
    );
    open();
    expect(
      await screen.findByText('No district was above the risk threshold in this period.'),
    ).toBeInTheDocument();
  });

  it('should show an error state when the policy cannot be loaded', async () => {
    vi.mocked(api.getPolicy).mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Policy was not found.'),
    );
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Policy was not found.');
  });
});
