import { Boxes, LayoutDashboard, Truck, Users } from 'lucide-react';
import { Role } from '@dms/shared';
import { RequireRole } from '../../shared/auth/AuthContext';
import type { ClientModule } from '../../shared/layout/navigation';
import { AllocationPage } from './pages/AllocationPage';
import { DispatchPage } from './pages/DispatchPage';
import { MyDispatchesPage } from './pages/MyDispatchesPage';
import { ResourceInventoryPage } from './pages/ResourceInventoryPage';
import { ResponseDashboardPage } from './pages/ResponseDashboardPage';
import { ShelterDetailPage } from './pages/ShelterDetailPage';
import { TeamCoordinationPage } from './pages/TeamCoordinationPage';

const { JointOpsLead: lead, RescueTeamLeader: teamLeader } = Role;

/**
 * UC-JOINT-001 — Dispatch and Coordinate Emergency Response (Member 4, IT23571334).
 * Desktop screens for the Joint Operations Lead; the Rescue Team Leader only updates team status.
 */
export const emergencyResponseModule: ClientModule = {
  id: 'emergency-response',
  nav: [
    { to: '/response', label: 'Dashboard', icon: LayoutDashboard, roles: [lead], end: true },
    { to: '/response/teams', label: 'Rescue teams', icon: Users, roles: [lead] },
    { to: '/response/resources', label: 'Resources', icon: Boxes, roles: [lead] },
    { to: '/response/my-dispatches', label: 'My dispatches', icon: Truck, roles: [teamLeader] },
  ],
  routes: [
    {
      path: '/response',
      element: (
        <RequireRole roles={[lead]}>
          <ResponseDashboardPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/shelters/:id',
      element: (
        <RequireRole roles={[lead, teamLeader]}>
          <ShelterDetailPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/teams',
      element: (
        <RequireRole roles={[lead]}>
          <TeamCoordinationPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/dispatch',
      element: (
        <RequireRole roles={[lead]}>
          <DispatchPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/resources',
      element: (
        <RequireRole roles={[lead]}>
          <ResourceInventoryPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/allocate',
      element: (
        <RequireRole roles={[lead]}>
          <AllocationPage />
        </RequireRole>
      ),
    },
    {
      path: '/response/my-dispatches',
      element: (
        <RequireRole roles={[teamLeader]}>
          <MyDispatchesPage />
        </RequireRole>
      ),
    },
  ],
};
