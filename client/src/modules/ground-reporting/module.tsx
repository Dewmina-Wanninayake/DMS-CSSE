import { ClipboardList, MapPinned, PlusCircle } from 'lucide-react';
import { Role } from '@dms/shared';
import { RequireRole } from '../../shared/auth/AuthContext';
import type { ClientModule } from '../../shared/layout/navigation';
import { FieldUpdatePage } from './pages/FieldUpdatePage';
import { MyReportsPage } from './pages/MyReportsPage';
import { ReportWizardPage } from './pages/ReportWizardPage';
import { UpdateReportPage } from './pages/UpdateReportPage';

const { Citizen: citizen, Volunteer: volunteer } = Role;
const reporters = [citizen, volunteer] as const;

/**
 * UC-CV-003 — Submit Disaster Ground Report (Member 3, IT23554054). Mobile screens for citizens and
 * volunteers; a certified volunteer can also add field updates (critique CV-003 #7).
 */
export const groundReportingModule: ClientModule = {
  id: 'ground-reporting',
  nav: [
    { to: '/report', label: 'Report hazard', icon: PlusCircle, roles: reporters, end: true },
    { to: '/report/mine', label: 'My reports', icon: ClipboardList, roles: reporters },
    { to: '/report/field-update', label: 'Field update', icon: MapPinned, roles: [volunteer] },
  ],
  routes: [
    {
      path: '/report',
      element: (
        <RequireRole roles={reporters}>
          <ReportWizardPage />
        </RequireRole>
      ),
    },
    {
      path: '/report/mine',
      element: (
        <RequireRole roles={reporters}>
          <MyReportsPage />
        </RequireRole>
      ),
    },
    {
      path: '/report/field-update',
      element: (
        <RequireRole roles={[volunteer]}>
          <FieldUpdatePage />
        </RequireRole>
      ),
    },
    {
      path: '/report/:id/update',
      element: (
        <RequireRole roles={reporters}>
          <UpdateReportPage />
        </RequireRole>
      ),
    },
  ],
};
