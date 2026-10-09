import { CheckSquare, ShieldAlert } from 'lucide-react';
import { Role } from '@dms/shared';
import { RequireRole } from '../../shared/auth/AuthContext';
import type { ClientModule } from '../../shared/layout/navigation';
import { DeliveryStatusPage } from './pages/DeliveryStatusPage';
import { ReportReviewPage } from './pages/ReportReviewPage';
import { SecondApproverPage } from './pages/SecondApproverPage';
import { VerificationQueuePage } from './pages/VerificationQueuePage';
import { WarningPreviewPage } from './pages/WarningPreviewPage';

const { DutyOfficer: officer, SecondApprover: approver } = Role;
const staff = [officer, approver] as const;

/**
 * UC-DIST-02 — Verify Ground Hazard Report and Escalate Warning (Member 1, IT23598928).
 */
export const reportVerificationModule: ClientModule = {
  id: 'report-verification',
  nav: [
    {
      to: '/verification',
      label: 'Verification Queue',
      icon: CheckSquare,
      roles: staff,
      end: true,
    },
    {
      to: '/verification/approvals',
      label: 'Warning Approvals',
      icon: ShieldAlert,
      roles: [approver, officer],
    },
  ],
  routes: [
    {
      path: '/verification',
      element: (
        <RequireRole roles={staff}>
          <VerificationQueuePage />
        </RequireRole>
      ),
    },
    {
      path: '/verification/reports/:id',
      element: (
        <RequireRole roles={staff}>
          <ReportReviewPage />
        </RequireRole>
      ),
    },
    {
      path: '/verification/reports/:id/warn',
      element: (
        <RequireRole roles={[officer]}>
          <WarningPreviewPage />
        </RequireRole>
      ),
    },
    {
      path: '/verification/approvals',
      element: (
        <RequireRole roles={staff}>
          <SecondApproverPage />
        </RequireRole>
      ),
    },
    {
      path: '/warnings/:id/delivery',
      element: (
        <RequireRole roles={staff}>
          <DeliveryStatusPage />
        </RequireRole>
      ),
    },
  ],
};
