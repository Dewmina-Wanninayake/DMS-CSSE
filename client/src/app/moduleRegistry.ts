import { registerModules } from '../shared/layout/navigation';
import { groundReportingModule } from '../modules/ground-reporting/module';
import { emergencyResponseModule } from '../modules/emergency-response/module';
import { policyAnalyticsModule } from '../modules/policy-analytics/module';
import { reportVerificationModule } from '../modules/report-verification/module';

/**
 * Add exactly one line per module (the team plan §6.3). On a merge conflict keep **both** lines.
 */
registerModules([
  policyAnalyticsModule, // UC-DA-001 (Member 2)
  reportVerificationModule, // UC-DIST-02 (Member 1)
  groundReportingModule, // UC-CV-003 (Member 3)
  emergencyResponseModule, // UC-JOINT-001 (Member 4)
]);
