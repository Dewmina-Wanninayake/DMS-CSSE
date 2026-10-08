import { ClipboardCheck, LayoutDashboard, Map, TrendingUp } from 'lucide-react';
import { Role } from '@dms/shared';
import { RequireRole } from '../../shared/auth/AuthContext';
import type { ClientModule } from '../../shared/layout/navigation';
import { DashboardPage } from './pages/DashboardPage';
import { DirectorReviewPage } from './pages/DirectorReviewPage';
import { HighRiskZonesPage } from './pages/HighRiskZonesPage';
import { PolicyDetailPage } from './pages/PolicyDetailPage';
import { PolicyListPage } from './pages/PolicyListPage';
import { PolicyWizardPage } from './pages/PolicyWizardPage';
import { TrendAnalysisPage } from './pages/TrendAnalysisPage';

const { DisasterAnalyst: analyst, PolicyDirector: director } = Role;
const staff = [analyst, director] as const;

/**
 * UC-DA-001 — Analyze Disaster Trends and Formulate Mitigation Policies (Member 2, IT23599086).
 * Registered in `app/moduleRegistry.ts`. Routes are role-guarded here, not in the shell.
 */
export const policyAnalyticsModule: ClientModule = {
  id: 'policy-analytics',
  nav: [
    { to: '/analytics', label: 'Dashboard', icon: LayoutDashboard, roles: staff, end: true },
    { to: '/analytics/map', label: 'Risk map', icon: Map, roles: staff },
    { to: '/analytics/trends', label: 'Trends', icon: TrendingUp, roles: [analyst] },
    { to: '/policies', label: 'Policy', icon: ClipboardCheck, roles: staff },
  ],
  routes: [
    {
      path: '/analytics',
      element: (
        <RequireRole roles={staff}>
          <DashboardPage />
        </RequireRole>
      ),
    },
    {
      path: '/analytics/map',
      element: (
        <RequireRole roles={staff}>
          <HighRiskZonesPage />
        </RequireRole>
      ),
    },
    {
      path: '/analytics/trends',
      element: (
        <RequireRole roles={[analyst]}>
          <TrendAnalysisPage />
        </RequireRole>
      ),
    },
    {
      path: '/policies',
      element: (
        <RequireRole roles={staff}>
          <PolicyListPage />
        </RequireRole>
      ),
    },
    {
      path: '/policies/new',
      element: (
        <RequireRole roles={[analyst]}>
          <PolicyWizardPage />
        </RequireRole>
      ),
    },
    {
      path: '/policies/:id',
      element: (
        <RequireRole roles={staff}>
          <PolicyDetailPage />
        </RequireRole>
      ),
    },
    {
      path: '/policies/:id/edit',
      element: (
        <RequireRole roles={[analyst]}>
          <PolicyWizardPage />
        </RequireRole>
      ),
    },
    {
      path: '/policies/:id/review',
      element: (
        <RequireRole roles={[director]}>
          <DirectorReviewPage />
        </RequireRole>
      ),
    },
  ],
};
