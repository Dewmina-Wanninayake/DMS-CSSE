import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emergencyResponseModule } from '../module';
import { emergencyResponseApi as api } from '../api/emergency-response.api';
import {
  AvailabilityBadge,
  DispatchStatusBadge,
  PriorityBadge,
  ShelterStateBadge,
} from '../components/badges';
import { shelterState } from '../lib/constants';
import { shelter } from './fixtures';

/** Pins the HTTP contract of docs/uc-joint-001-emergency-response.md so client and server cannot drift apart. */
describe('emergency response API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = async (invoke: () => Promise<unknown>) => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
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

  const dispatchInput = { location: 'Kaduwela', priority: 'High' as const, teamId: 1 };
  const allocationInput = {
    resourceId: 1,
    quantity: 5,
    destinationType: 'Shelter' as const,
    destinationId: 2,
  };

  it.each([
    ['dashboard', () => api.dashboard(), 'GET', '/api/v1/response/dashboard', undefined],
    ['shelter', () => api.shelter(3), 'GET', '/api/v1/shelters/3', undefined],
    [
      'requestRedirect',
      () => api.requestRedirect(3, 'Use Kalutara'),
      'POST',
      '/api/v1/shelters/3/redirect-requests',
      { note: 'Use Kalutara' },
    ],
    ['teams', () => api.teams(), 'GET', '/api/v1/rescue-teams', undefined],
    [
      'previewDispatch',
      () => api.previewDispatch(dispatchInput),
      'POST',
      '/api/v1/dispatches/preview',
      dispatchInput,
    ],
    [
      'createDispatch',
      () => api.createDispatch(dispatchInput),
      'POST',
      '/api/v1/dispatches',
      dispatchInput,
    ],
    ['myDispatches', () => api.myDispatches(), 'GET', '/api/v1/dispatches/mine', undefined],
    [
      'updateStatus',
      () => api.updateStatus(4, 'EnRoute'),
      'PATCH',
      '/api/v1/dispatches/4/status',
      { status: 'EnRoute' },
    ],
    [
      'cancelDispatch',
      () => api.cancelDispatch(4, 'Broke down', 2),
      'POST',
      '/api/v1/dispatches/4/cancel',
      { reason: 'Broke down', replacementTeamId: 2 },
    ],
    ['resources', () => api.resources(), 'GET', '/api/v1/resources', undefined],
    [
      'previewAllocation',
      () => api.previewAllocation(allocationInput),
      'POST',
      '/api/v1/allocations/preview',
      allocationInput,
    ],
    [
      'createAllocation',
      () => api.createAllocation(allocationInput),
      'POST',
      '/api/v1/allocations',
      allocationInput,
    ],
    [
      'reverseAllocation',
      () => api.reverseAllocation(9, 'Mistake'),
      'POST',
      '/api/v1/allocations/9/reversal',
      { reason: 'Mistake' },
    ],
    [
      'requestResupply',
      () => api.requestResupply({ resourceId: 1, quantity: 10 }),
      'POST',
      '/api/v1/resupply-requests',
      { resourceId: 1, quantity: 10 },
    ],
  ])('%s', async (_name, invoke, method, url, body) => {
    expect(await call(invoke)).toEqual({ method, url, body });
  });
});

describe('shelterState (display only)', () => {
  it.each([
    [{ capacity: 100, occupied: 100, available: 0 }, 'Full'],
    [{ capacity: 100, occupied: 90, available: 10 }, 'Near capacity'],
    [{ capacity: 100, occupied: 89, available: 11 }, 'Available'],
    [{ capacity: 100, occupied: 0, available: 100 }, 'Available'],
  ])('%j is %s', (input, expected) => {
    expect(shelterState(input)).toBe(expected);
  });
});

describe('status badges carry a text label, never colour alone', () => {
  it('should render the labels', () => {
    render(
      <>
        <DispatchStatusBadge status="EnRoute" />
        <PriorityBadge priority="Urgent" />
        <AvailabilityBadge availability="Busy" />
        <ShelterStateBadge shelter={shelter({ available: 0, occupied: 400 })} />
      </>,
    );
    expect(screen.getByText('En route')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Busy')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
  });
});

describe('module registration', () => {
  it('should give each role only its own navigation and guard every route', () => {
    const labels = (role: string) =>
      emergencyResponseModule.nav
        .filter((item) => item.roles.includes(role as never))
        .map((i) => i.label);
    expect(labels('JointOpsLead')).toEqual(['Dashboard', 'Rescue teams', 'Resources']);
    expect(labels('RescueTeamLeader')).toEqual(['My dispatches']);
    expect(labels('Citizen')).toEqual([]);
    expect(emergencyResponseModule.routes.map((route) => route.path)).toEqual([
      '/response',
      '/response/shelters/:id',
      '/response/teams',
      '/response/dispatch',
      '/response/resources',
      '/response/allocate',
      '/response/my-dispatches',
    ]);
  });
});
