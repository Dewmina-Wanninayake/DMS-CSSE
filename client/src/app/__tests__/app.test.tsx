import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { api, setAuthToken } from '../../shared/api/api-client';
import { AuthProvider, RequireRole, useAuth } from '../../shared/auth/AuthContext';
import { homePathFor, navItemsFor, registeredModules } from '../../shared/layout/navigation';
import { signInAs } from '../../test/render';
import '../moduleRegistry';
import { createRoutes } from '../routes';

vi.mock('../../modules/policy-analytics/api/policy-analytics.api');
vi.mock('../../shared/ui/DistrictMap', async () => import('../../test/DistrictMapMock'));

function mount(path: string) {
  setAuthToken(null);
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

beforeEach(() => vi.restoreAllMocks());

describe('module registry', () => {
  it('should register the policy-analytics module with role-aware navigation', () => {
    expect(registeredModules().map((m) => m.id)).toContain('policy-analytics');
    expect(navItemsFor(Role.DisasterAnalyst).map((n) => n.label)).toEqual([
      'Dashboard',
      'Risk map',
      'Trends',
      'Policy',
    ]);
    // The Verify tab of the hi-fi is deliberately absent (critique DA #6); Trends is analyst-only.
    expect(navItemsFor(Role.PolicyDirector).map((n) => n.label)).toEqual([
      'Dashboard',
      'Risk map',
      'Policy',
    ]);
    expect(navItemsFor(Role.Citizen)).toEqual([]);
    expect(homePathFor(Role.DisasterAnalyst)).toBe('/analytics');
    expect(homePathFor(Role.Citizen)).toBeUndefined();
  });
});

describe('routing and role guards', () => {
  it('should send a signed-out visitor to the sign-in page', async () => {
    const router = mount('/analytics');
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('should land an analyst on the analytics dashboard inside the shell', async () => {
    const { policyAnalyticsApi } =
      await import('../../modules/policy-analytics/api/policy-analytics.api');
    vi.mocked(policyAnalyticsApi.latestVerified).mockResolvedValue([]);
    signInAs(Role.DisasterAnalyst);
    const router = mount('/');
    expect(await screen.findByRole('navigation', { name: 'Analyst tools' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/analytics');
    // Sidebar (≥1024px) and bottom tabs (<1024px) are both present in the DOM; CSS shows one.
    expect(screen.getAllByRole('link', { name: 'Trends' })).toHaveLength(2);
    expect(screen.getAllByText('Test DisasterAnalyst').length).toBeGreaterThan(0);
  });

  it('should keep a director out of analyst-only pages', async () => {
    signInAs(Role.PolicyDirector);
    const { policyAnalyticsApi } =
      await import('../../modules/policy-analytics/api/policy-analytics.api');
    vi.mocked(policyAnalyticsApi.listPolicies).mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
    const router = mount('/policies/new');
    await waitFor(() => expect(router.state.location.pathname).toBe('/analytics'));
  });

  it('should show an empty state for a role without screens', async () => {
    signInAs(Role.Citizen);
    mount('/');
    expect(await screen.findByText('Nothing to show for your role yet')).toBeInTheDocument();
  });

  it('should show a not-found page for unknown addresses', async () => {
    signInAs(Role.DisasterAnalyst);
    mount('/no/such/page');
    expect(await screen.findByText('This page does not exist')).toBeInTheDocument();
  });
});

describe('sign-in and sign-out', () => {
  it('should sign in, store the session and open the role home page', async () => {
    const { policyAnalyticsApi } =
      await import('../../modules/policy-analytics/api/policy-analytics.api');
    vi.mocked(policyAnalyticsApi.latestVerified).mockResolvedValue([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      token: 'tok',
      user: {
        id: 3,
        email: 'analyst@dms.lk',
        fullName: 'Dulaj Serasinghe',
        role: Role.DisasterAnalyst,
      },
    });
    const router = mount('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'analyst@dms.lk');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-pass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/analytics'));
    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'analyst@dms.lk',
      password: 'secret-pass',
    });
    expect(JSON.parse(window.sessionStorage.getItem('dms.session') as string).token).toBe('tok');
  });

  it('should show the server message for wrong credentials and stay on the page', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Incorrect email or password.'));
    const router = mount('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'a@dms.lk');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('should sign out from the sidebar and return to sign-in', async () => {
    const { policyAnalyticsApi } =
      await import('../../modules/policy-analytics/api/policy-analytics.api');
    vi.mocked(policyAnalyticsApi.latestVerified).mockResolvedValue([]);
    signInAs(Role.DisasterAnalyst);
    const router = mount('/analytics');
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(window.sessionStorage.getItem('dms.session')).toBeNull();
  });

  it('should redirect a signed-in user away from the sign-in page', async () => {
    const { policyAnalyticsApi } =
      await import('../../modules/policy-analytics/api/policy-analytics.api');
    vi.mocked(policyAnalyticsApi.latestVerified).mockResolvedValue([]);
    signInAs(Role.DisasterAnalyst);
    const router = mount('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/analytics'));
  });
});

describe('AuthContext', () => {
  it('should treat corrupt stored sessions as signed out', () => {
    window.sessionStorage.setItem('dms.session', '{bad json');
    function Probe() {
      return <span>{useAuth().user?.fullName ?? 'signed out'}</span>;
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('should throw a helpful error when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Probe() {
      useAuth();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });

  it('should sign the user out when the API reports an expired session', async () => {
    signInAs(Role.DisasterAnalyst);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'UNAUTHENTICATED', message: 'Expired' },
          }),
      }),
    );
    function Probe() {
      const { user } = useAuth();
      return (
        <>
          <span>{user ? 'in' : 'out'}</span>
          <button onClick={() => void api.get('/x').catch(() => {})}>call</button>
        </>
      );
    }
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByText('in')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'call' }));
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });

  it('RequireRole should render children only for allowed roles', () => {
    signInAs(Role.DisasterAnalyst);
    const router = createMemoryRouter(
      [
        { path: '/', element: <span>home</span> },
        {
          path: '/secret',
          element: <RequireRole roles={[Role.PolicyDirector]}>secret</RequireRole>,
        },
      ],
      { initialEntries: ['/secret'] },
    );
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(within(document.body).getByText('home')).toBeInTheDocument();
  });
});
