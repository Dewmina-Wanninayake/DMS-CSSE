import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { ApiError } from '../../../shared/api/api-client';
import { renderWithApp } from '../../../test/render';
import { emergencyResponseApi as api } from '../api/emergency-response.api';
import { AllocationPage } from '../pages/AllocationPage';
import { DispatchPage } from '../pages/DispatchPage';
import { dashboard, dispatch, team } from './fixtures';

vi.mock('../api/emergency-response.api');

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

const summary = {
  location: 'Kaduwela',
  priority: 'High' as const,
  instructions: 'Bring boats',
  team: {
    id: 1,
    name: 'Alpha Rescue Team',
    agency: 'Sri Lanka Navy',
    leaderName: 'Cdr. S. Perera',
  },
};

describe('Dispatch a rescue team (A2-A4)', () => {
  const open = (route = '/response/dispatch') =>
    renderWithApp(<DispatchPage />, { role: Role.JointOpsLead, route });

  it('A2a: should block confirmation and highlight the missing fields', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Review dispatch' }));

    expect(screen.getByText('Enter the incident location.')).toBeInTheDocument();
    expect(screen.getByText('Choose a priority.')).toBeInTheDocument();
    expect(screen.getByText('Choose a rescue team.')).toBeInTheDocument();
    expect(api.previewDispatch).not.toHaveBeenCalled();
  });

  it('A2-A4: should show the summary, then confirm and notify', async () => {
    vi.mocked(api.teams).mockResolvedValue([
      team(),
      team({ id: 2, name: 'Bravo', availability: 'Busy' }),
    ]);
    vi.mocked(api.previewDispatch).mockResolvedValue(summary);
    vi.mocked(api.createDispatch).mockResolvedValue(dispatch());
    open('/response/dispatch?teamId=1');

    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.type(screen.getByLabelText('Instructions'), 'Bring boats');
    expect(screen.getByLabelText('Rescue team')).toHaveValue('1');
    expect(screen.queryByRole('option', { name: /Bravo/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));

    expect(api.previewDispatch).toHaveBeenCalledWith({
      location: 'Kaduwela',
      priority: 'High',
      teamId: 1,
      instructions: 'Bring boats',
    });
    const view = within(await screen.findByRole('region', { name: 'Dispatch summary' }));
    expect(view.getByText(/Alpha Rescue Team/)).toBeInTheDocument();
    expect(view.getByText('Bring boats')).toBeInTheDocument();
    expect(api.createDispatch).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm dispatch' }));
    expect(await screen.findByText('Team dispatched')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Monitor dispatches' })).toHaveAttribute(
      'href',
      '/response/teams',
    );
  });

  it('should let the lead go back and edit from the summary', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    vi.mocked(api.previewDispatch).mockResolvedValue({ ...summary, instructions: null });
    open('/response/dispatch?teamId=1');
    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(await screen.findByText('None')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Incident location')).toHaveValue('Kaduwela');
  });

  it('should return to the form when the team was taken before confirmation', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    vi.mocked(api.previewDispatch).mockResolvedValue(summary);
    vi.mocked(api.createDispatch).mockRejectedValue(
      new ApiError(422, 'TEAM_UNAVAILABLE', 'Alpha Rescue Team is already on another dispatch.'),
    );
    open('/response/dispatch?teamId=1');
    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm dispatch' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already on another dispatch');
    expect(screen.getByRole('button', { name: 'Review dispatch' })).toBeInTheDocument();
    expect(api.teams).toHaveBeenCalledTimes(2);
  });

  it('should show server field errors from the preview and keep the form', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    vi.mocked(api.previewDispatch).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', [
        { field: 'location', message: 'Location is too long.' },
      ]),
    );
    open('/response/dispatch?teamId=1');
    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    expect(await screen.findByText('Location is too long.')).toBeInTheDocument();
  });

  it('should show a non-API failure from confirm and keep the summary', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    vi.mocked(api.previewDispatch).mockResolvedValue(summary);
    vi.mocked(api.createDispatch).mockRejectedValue(new Error('Server error'));
    open('/response/dispatch?teamId=1');
    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm dispatch' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    expect(screen.getByRole('button', { name: 'Confirm dispatch' })).toBeInTheDocument();
  });

  it('A1a: should explain when no team is available, and show load and offline states', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    vi.mocked(api.teams).mockResolvedValueOnce([team({ availability: 'Busy' })]);
    const { unmount } = open();
    expect(await screen.findByText('No suitable team is available')).toBeInTheDocument();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    unmount();

    vi.mocked(api.teams).mockRejectedValueOnce(new Error('boom'));
    open();
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('should not allow confirming while offline', async () => {
    vi.mocked(api.teams).mockResolvedValue([team()]);
    vi.mocked(api.previewDispatch).mockResolvedValue(summary);
    open('/response/dispatch?teamId=1');
    await userEvent.type(await screen.findByLabelText('Incident location'), 'Kaduwela');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'High');
    await userEvent.click(screen.getByRole('button', { name: 'Review dispatch' }));
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByRole('button', { name: 'Confirm dispatch' })).toBeDisabled();
  });
});

const allocationSummary = {
  resource: { id: 1, name: 'Drinking water', unit: 'Litre' as const },
  quantity: 1200,
  quantityLabel: '1,200 litres',
  availableLabel: '5,000 litres',
  remainingLabel: '3,800 litres',
  destination: { type: 'Shelter' as const, id: 1, name: 'Colombo Central Relief Centre' },
  instructions: null,
};

const entry = {
  id: 7,
  entryType: 'Allocation' as const,
  resourceId: 1,
  quantity: 1200,
  unit: 'Litre' as const,
  destinationType: 'Shelter' as const,
  destinationId: 1,
  instructions: null,
  reversesAllocationId: null,
  reason: null,
  createdBy: 5,
  createdAt: '2026-10-09T08:00:00.000Z',
};

async function fillAllocation(quantity = '1200') {
  await userEvent.selectOptions(await screen.findByLabelText('Resource'), '1');
  await userEvent.type(screen.getByLabelText('Quantity'), quantity);
  await userEvent.selectOptions(screen.getByLabelText('Destination type'), 'Shelter');
  await userEvent.selectOptions(screen.getByLabelText('Destination'), '1');
  await userEvent.click(screen.getByRole('button', { name: 'Review allocation' }));
}

describe('Allocate resources (B1-B5)', () => {
  const open = (route = '/response/allocate') =>
    renderWithApp(<AllocationPage />, { role: Role.JointOpsLead, route });

  beforeEach(() => vi.mocked(api.dashboard).mockResolvedValue(dashboard()));

  it('B2: should block the review until every field is valid', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Review allocation' }));
    expect(screen.getByText('Choose a resource.')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number above zero.')).toBeInTheDocument();
    expect(screen.getByText('Choose where the stock is going.')).toBeInTheDocument();
    expect(screen.getByText('Choose the destination.')).toBeInTheDocument();
    expect(api.previewAllocation).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('Quantity'), '2.5');
    await userEvent.click(screen.getByRole('button', { name: 'Review allocation' }));
    expect(screen.getByText('Enter a whole number above zero.')).toBeInTheDocument();
  });

  it('B3-B5: should show the summary, confirm, then show remaining stock', async () => {
    vi.mocked(api.previewAllocation).mockResolvedValue(allocationSummary);
    vi.mocked(api.createAllocation).mockResolvedValue(entry);
    open();
    await fillAllocation();

    expect(api.previewAllocation).toHaveBeenCalledWith({
      resourceId: 1,
      quantity: 1200,
      destinationType: 'Shelter',
      destinationId: 1,
      instructions: undefined,
    });
    const view = within(await screen.findByRole('region', { name: 'Allocation summary' }));
    expect(view.getByText('1,200 litres')).toBeInTheDocument();
    expect(view.getByText('3,800 litres')).toBeInTheDocument();
    expect(view.getByText(/Colombo Central Relief Centre/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirm allocation' }));
    expect(await screen.findByText('Allocation confirmed')).toBeInTheDocument();
    expect(screen.getByText(/Remaining stock: 3,800 litres/)).toBeInTheDocument();
  });

  it('should prefill the resource and destination from the link that opened the page', async () => {
    open('/response/allocate?resourceId=1&destinationType=Shelter&destinationId=3');
    expect(await screen.findByLabelText('Resource')).toHaveValue('1');
    expect(screen.getByLabelText('Destination type')).toHaveValue('Shelter');
    expect(screen.getByLabelText('Destination')).toHaveValue('3');
  });

  it('should offer area and team destinations', async () => {
    open();
    await userEvent.selectOptions(await screen.findByLabelText('Destination type'), 'Area');
    expect(screen.getByRole('option', { name: 'Colombo' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Destination type'), 'Team');
    expect(screen.getByRole('option', { name: 'Alpha Rescue Team' })).toBeInTheDocument();
  });

  it('B3a: should block an over-allocation and request resupply for the shortfall', async () => {
    vi.mocked(api.previewAllocation).mockRejectedValue(
      new ApiError(422, 'INSUFFICIENT_STOCK', 'Only 5000 Litre available; 8000 requested.', {
        resourceId: 1,
        requested: 8000,
        available: 5000,
        unit: 'Litre',
        canRequestResupply: true,
      }),
    );
    vi.mocked(api.requestResupply).mockResolvedValue({
      id: 1,
      resourceId: 1,
      quantity: 3000,
      note: null,
      status: 'Open',
      requestedBy: 5,
      createdAt: 'x',
    });
    open();
    await fillAllocation('8000');

    expect(await screen.findByText('Not enough stock')).toBeInTheDocument();
    expect(api.createAllocation).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Request resupply' }));
    expect(api.requestResupply).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 1, quantity: 3000 }),
    );
    expect(
      await screen.findByText('Resupply requested from the Resource Provider.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request resupply' })).not.toBeInTheDocument();
  });

  it('B3a: should show a failed resupply request', async () => {
    vi.mocked(api.previewAllocation).mockRejectedValue(
      new ApiError(422, 'INSUFFICIENT_STOCK', 'Short.', {
        resourceId: 1,
        requested: 9,
        available: 5,
      }),
    );
    vi.mocked(api.requestResupply).mockRejectedValue(new Error('Provider unreachable'));
    open();
    await fillAllocation('9');
    await userEvent.click(await screen.findByRole('button', { name: 'Request resupply' }));
    expect(await screen.findByText('Provider unreachable')).toBeInTheDocument();
  });

  it('B4a: should report the current quantity when stock changed before confirm', async () => {
    vi.mocked(api.previewAllocation).mockResolvedValue(allocationSummary);
    vi.mocked(api.createAllocation).mockRejectedValue(
      new ApiError(
        409,
        'STALE_STOCK',
        'Stock changed since you previewed this allocation. 900 now available.',
        {
          currentQuantity: 900,
        },
      ),
    );
    open();
    await fillAllocation();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm allocation' }));

    expect(await screen.findByText('Stock changed since you reviewed this')).toBeInTheDocument();
    expect(screen.getByText(/900 now available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review allocation' })).toBeInTheDocument();
    expect(api.dashboard).toHaveBeenCalledTimes(2);
  });

  it('3a: should list other shelters when the destination is full and link to the redirect request', async () => {
    vi.mocked(api.previewAllocation).mockRejectedValue(
      new ApiError(422, 'SHELTER_FULL', 'Gampaha Hall Shelter is full.', {
        alternatives: [{ id: 3, name: 'Kalutara Temple Shelter', available: 20 }],
      }),
    );
    open();
    await fillAllocation();
    expect(await screen.findByText('This shelter is full')).toBeInTheDocument();
    expect(screen.getByText(/Kalutara Temple Shelter · 20 spaces/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /ask the Shelter Coordinator to redirect/ }),
    ).toHaveAttribute('href', '/response/shelters/1');
  });

  it('should show other server errors in an alert', async () => {
    vi.mocked(api.previewAllocation).mockRejectedValue(
      new ApiError(404, 'NOT_FOUND', 'Resource 1 was not found.'),
    );
    open();
    await fillAllocation();
    expect(await screen.findByRole('alert')).toHaveTextContent('Resource 1 was not found.');
    vi.mocked(api.previewAllocation).mockRejectedValue(new Error('Network down'));
    await userEvent.click(screen.getByRole('button', { name: 'Review allocation' }));
    expect(await screen.findByText('Network down')).toBeInTheDocument();
  });

  it('B5a: should reverse a confirmed allocation with a reason, never an edit', async () => {
    vi.mocked(api.previewAllocation).mockResolvedValue(allocationSummary);
    vi.mocked(api.createAllocation).mockResolvedValue(entry);
    vi.mocked(api.reverseAllocation).mockResolvedValue({
      ...entry,
      id: 8,
      entryType: 'Reversal',
      reversesAllocationId: 7,
      reason: 'Wrong shelter',
    });
    open();
    await fillAllocation();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm allocation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reverse this allocation' }));

    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Reverse allocation' }));
    expect(dialog.getByText(/Give a reason/)).toBeInTheDocument();
    expect(api.reverseAllocation).not.toHaveBeenCalled();

    await userEvent.type(dialog.getByLabelText('Reason'), 'Wrong shelter');
    await userEvent.click(dialog.getByRole('button', { name: 'Reverse allocation' }));
    expect(api.reverseAllocation).toHaveBeenCalledWith(7, 'Wrong shelter');
    expect(await screen.findByText('Allocation reversed')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reverse this allocation' }),
    ).not.toBeInTheDocument();
  });

  it('B5a: should show why a reversal was refused and allow keeping the allocation', async () => {
    vi.mocked(api.previewAllocation).mockResolvedValue(allocationSummary);
    vi.mocked(api.createAllocation).mockResolvedValue(entry);
    vi.mocked(api.reverseAllocation).mockRejectedValue(
      new ApiError(409, 'ALREADY_REVERSED', 'Allocation 7 was already reversed.'),
    );
    open();
    await fillAllocation();
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm allocation' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reverse this allocation' }));
    await userEvent.type(screen.getByLabelText('Reason'), 'Mistake');
    await userEvent.click(screen.getByRole('button', { name: 'Reverse allocation' }));
    expect(await screen.findByText('Allocation 7 was already reversed.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keep allocation' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('2a: should show offline and error states and disable confirming offline', async () => {
    vi.mocked(api.previewAllocation).mockResolvedValue(allocationSummary);
    const { unmount } = open();
    await fillAllocation();
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/You are offline/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm allocation' })).toBeDisabled();
    unmount();

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
    vi.mocked(api.dashboard).mockRejectedValueOnce(new Error('no data'));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('no data');
  });
});
