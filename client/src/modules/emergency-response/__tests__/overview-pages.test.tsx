import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { ApiError } from '../../../shared/api/api-client';
import { renderWithApp } from '../../../test/render';
import { emergencyResponseApi as api } from '../api/emergency-response.api';
import { MyDispatchesPage } from '../pages/MyDispatchesPage';
import { ResourceInventoryPage } from '../pages/ResourceInventoryPage';
import { ResponseDashboardPage } from '../pages/ResponseDashboardPage';
import { ShelterDetailPage } from '../pages/ShelterDetailPage';
import { TeamCoordinationPage } from '../pages/TeamCoordinationPage';
import { dashboard, dispatch, resource, shelter } from './fixtures';

vi.mock('../api/emergency-response.api');

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

describe('Emergency Response Dashboard (steps 1-2)', () => {
  it('should show KPI tiles, read-only shelters, dispatches and stock', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    renderWithApp(<ResponseDashboardPage />, { role: Role.JointOpsLead });

    expect(screen.getByRole('status')).toHaveTextContent('Loading the response dashboard');
    const tools = within(await screen.findByRole('navigation', { name: 'Response tools' }));
    expect(tools.getByRole('link', { name: /Shelter beds free/ })).toHaveTextContent('280');
    expect(tools.getByRole('link', { name: /Low-stock resources/ })).toHaveTextContent('1');

    expect(screen.getByText(/This view is read only/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Colombo Central Relief Centre' })).toHaveAttribute(
      'href',
      '/response/shelters/1',
    );
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('Near capacity')).toBeInTheDocument();
    expect(screen.getByText('Kaduwela')).toBeInTheDocument();
    expect(screen.getByText('Low stock')).toBeInTheDocument();
    expect(screen.getByText('5,000 litres')).toBeInTheDocument();
  });

  it('should show an empty state when nothing is dispatched', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard({ activeDispatches: [] }));
    renderWithApp(<ResponseDashboardPage />, { role: Role.JointOpsLead });
    expect(await screen.findByText('No active dispatches')).toBeInTheDocument();
  });

  it('2a: should warn that data may be stale and show when it was last updated', async () => {
    const old = new Date(Date.now() - 30 * 60_000).toISOString();
    vi.mocked(api.dashboard).mockResolvedValue(dashboard({ generatedAt: old }));
    renderWithApp(<ResponseDashboardPage />, { role: Role.JointOpsLead });
    expect(await screen.findByText(/may be out of date/)).toHaveTextContent(
      'Last updated 30 min ago',
    );
  });

  it('2a: should say the device is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    renderWithApp(<ResponseDashboardPage />, { role: Role.JointOpsLead });
    expect(await screen.findByText(/You are offline/)).toBeInTheDocument();
  });

  it('should show the error state and retry', async () => {
    vi.mocked(api.dashboard).mockRejectedValueOnce(new Error('down'));
    vi.mocked(api.dashboard).mockResolvedValueOnce(dashboard());
    renderWithApp(<ResponseDashboardPage />, { role: Role.JointOpsLead });
    expect(await screen.findByRole('alert')).toHaveTextContent('down');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('navigation', { name: 'Response tools' })).toBeInTheDocument();
  });
});

describe('Shelter detail (step 3, read only)', () => {
  const open = () =>
    renderWithApp(<ShelterDetailPage />, {
      role: Role.JointOpsLead,
      route: '/response/shelters/2',
      path: '/response/shelters/:id',
    });

  it('should show occupancy and offer allocation when there is space', async () => {
    vi.mocked(api.shelter).mockResolvedValue(shelter({ id: 2 }));
    open();
    expect(await screen.findByText('120 of 400')).toBeInTheDocument();
    expect(screen.getByText(/You can view it here but not change it/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Allocate supplies here' })).toHaveAttribute(
      'href',
      '/response/allocate?destinationType=Shelter&destinationId=2',
    );
    expect(screen.queryByRole('button', { name: 'Request redirect' })).not.toBeInTheDocument();
  });

  it('3a: should request a redirect for a full shelter and list shelters with space', async () => {
    vi.mocked(api.shelter).mockResolvedValue(
      shelter({ id: 2, name: 'Gampaha Hall Shelter', occupied: 250, capacity: 250, available: 0 }),
    );
    vi.mocked(api.requestRedirect).mockResolvedValue({
      shelterId: 2,
      status: 'Requested',
      alternatives: [shelter({ id: 3, name: 'Kalutara Temple Shelter', available: 20 })],
    });
    open();
    await userEvent.type(
      await screen.findByLabelText('Note for the Shelter Coordinator'),
      'Use Kalutara',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Request redirect' }));

    expect(api.requestRedirect).toHaveBeenCalledWith(2, 'Use Kalutara');
    expect(
      await screen.findByText('The Shelter Coordinator has been notified.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Kalutara Temple Shelter · 20 spaces/)).toBeInTheDocument();
  });

  it('3a: should say when no other shelter has space, and show a failed request', async () => {
    vi.mocked(api.shelter).mockResolvedValue(shelter({ id: 2, available: 0, occupied: 400 }));
    vi.mocked(api.requestRedirect).mockRejectedValueOnce(new Error('Could not send'));
    vi.mocked(api.requestRedirect).mockResolvedValueOnce({
      shelterId: 2,
      status: 'Requested',
      alternatives: [],
    });
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Request redirect' }));
    expect(await screen.findByText('Could not send')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Request redirect' }));
    expect(await screen.findByText('No other shelter has space right now.')).toBeInTheDocument();
    expect(api.requestRedirect).toHaveBeenLastCalledWith(2, undefined);
  });

  it('should show the error state when the shelter cannot load', async () => {
    vi.mocked(api.shelter).mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Shelter 2 was not found.'),
    );
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Shelter 2 was not found.');
  });
});

describe('Rescue Team Coordination (A1, A4a)', () => {
  it('should list teams with agency, leader, location and status, and link to dispatch', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    renderWithApp(<TeamCoordinationPage />, { role: Role.JointOpsLead });

    expect(await screen.findAllByText('Sri Lanka Navy')).not.toHaveLength(0);
    expect(screen.getAllByText('Cdr. S. Perera')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Dispatch Alpha Rescue Team' })).toHaveAttribute(
      'href',
      '/response/dispatch?teamId=1',
    );
    expect(
      screen.queryByRole('link', { name: 'Dispatch Bravo Rescue Team' }),
    ).not.toBeInTheDocument();
  });

  it('A1a: should explain that no suitable team is available', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(
      dashboard({
        teams: [dashboard().teams[1]],
        activeDispatches: [],
      }),
    );
    renderWithApp(<TeamCoordinationPage />, { role: Role.JointOpsLead });
    expect(await screen.findByText('No suitable team is available')).toBeInTheDocument();
    expect(screen.getByText('No open dispatches')).toBeInTheDocument();
  });

  it('A4a: should cancel a dispatch with a reason and a replacement team', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(
      dashboard({
        teams: [dashboard().teams[0], { ...dashboard().teams[1], availability: 'Available' }],
      }),
    );
    vi.mocked(api.cancelDispatch).mockResolvedValue({
      cancelled: dispatch({ status: 'Cancelled' }),
      replacement: dispatch({ id: 11, teamId: 2 }),
    });
    renderWithApp(<TeamCoordinationPage />, { role: Role.JointOpsLead });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel dispatch to Kaduwela' }),
    );
    const dialog = within(screen.getByRole('dialog'));

    await userEvent.click(dialog.getByRole('button', { name: 'Cancel dispatch' }));
    expect(dialog.getByText(/Give a reason/)).toBeInTheDocument();
    expect(api.cancelDispatch).not.toHaveBeenCalled();

    await userEvent.type(dialog.getByLabelText('Reason'), 'Boat broke down');
    await userEvent.selectOptions(dialog.getByLabelText('Replacement team'), '2');
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel dispatch' }));

    expect(api.cancelDispatch).toHaveBeenCalledWith(10, 'Boat broke down', 2);
    expect(await screen.findByText(/cancelled and replaced/)).toBeInTheDocument();
  });

  it('A4a: should cancel without a replacement and show a server refusal', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    vi.mocked(api.cancelDispatch).mockRejectedValueOnce(new Error('Already on site'));
    vi.mocked(api.cancelDispatch).mockResolvedValueOnce({
      cancelled: dispatch({ status: 'Cancelled' }),
      replacement: null,
    });
    renderWithApp(<TeamCoordinationPage />, { role: Role.JointOpsLead });

    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel dispatch to Kaduwela' }),
    );
    await userEvent.type(screen.getByLabelText('Reason'), 'Wrong location');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel dispatch' }),
    );
    expect(await screen.findByText('Already on site')).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel dispatch' }),
    );
    expect(await screen.findByText('Dispatch cancelled.')).toBeInTheDocument();
    expect(api.cancelDispatch).toHaveBeenLastCalledWith(10, 'Wrong location', undefined);
  });

  it('should let the lead keep the dispatch', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    renderWithApp(<TeamCoordinationPage />, { role: Role.JointOpsLead });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancel dispatch to Kaduwela' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Keep dispatch' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Resource Inventory (B1)', () => {
  it('should show quantity in one unit, owner, location and a low-stock flag', async () => {
    vi.mocked(api.resources).mockResolvedValue([
      resource(),
      resource({ id: 4, name: 'First-aid kits', quantityLabel: '10 units', lowStock: true }),
    ]);
    renderWithApp(<ResourceInventoryPage />, { role: Role.JointOpsLead });

    expect(await screen.findByText('5,000 litres')).toBeInTheDocument();
    expect(screen.getAllByText('DMC Warehouse')).not.toHaveLength(0);
    expect(screen.getByText(/First-aid kits is\s+running low/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Allocate Drinking water' })).toHaveAttribute(
      'href',
      '/response/allocate?resourceId=1',
    );
  });

  it('should show empty and error states', async () => {
    vi.mocked(api.resources).mockResolvedValueOnce([]);
    const { unmount } = renderWithApp(<ResourceInventoryPage />, { role: Role.JointOpsLead });
    expect(await screen.findByText('No resources recorded')).toBeInTheDocument();
    unmount();

    vi.mocked(api.resources).mockRejectedValueOnce(new Error('offline'));
    renderWithApp(<ResourceInventoryPage />, { role: Role.JointOpsLead });
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  });
});

describe('My dispatches (A5, Rescue Team Leader)', () => {
  it('should move the dispatch to the next status in order', async () => {
    vi.mocked(api.myDispatches).mockResolvedValue([dispatch()]);
    vi.mocked(api.updateStatus).mockResolvedValue(dispatch({ status: 'EnRoute' }));
    renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark en route at Kaduwela' }));
    expect(api.updateStatus).toHaveBeenCalledWith(10, 'EnRoute');
    expect(api.myDispatches).toHaveBeenCalledTimes(2);
  });

  it('A5a: should show the allowed transitions when the server refuses a move', async () => {
    vi.mocked(api.myDispatches).mockResolvedValue([dispatch({ status: 'OnSite' })]);
    vi.mocked(api.updateStatus).mockRejectedValue(
      new ApiError(409, 'INVALID_STATE_TRANSITION', 'A dispatch that is OnSite cannot move to X.', {
        allowed: ['Completed'],
      }),
    );
    renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark completed at Kaduwela' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Allowed next: Completed.');
  });

  it('should show a plain message for other failures, an empty state and an error state', async () => {
    vi.mocked(api.myDispatches).mockResolvedValueOnce([dispatch({ instructions: null })]);
    vi.mocked(api.updateStatus).mockRejectedValue(new Error('Network down'));
    const { unmount } = renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });
    expect(await screen.findByText('No instructions were given.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mark en route/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    unmount();

    vi.mocked(api.myDispatches).mockResolvedValueOnce([]);
    const second = renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });
    expect(await screen.findByText('No open dispatches')).toBeInTheDocument();
    second.unmount();

    vi.mocked(api.myDispatches).mockRejectedValueOnce(new Error('boom'));
    renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('should show no action for a completed dispatch', async () => {
    vi.mocked(api.myDispatches).mockResolvedValue([dispatch({ status: 'Completed' })]);
    renderWithApp(<MyDispatchesPage />, { role: Role.RescueTeamLeader });
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
