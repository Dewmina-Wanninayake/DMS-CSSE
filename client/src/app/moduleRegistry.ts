import { registerModules } from '../shared/layout/navigation';
import { policyAnalyticsModule } from '../modules/policy-analytics/module';

/**
 * Add exactly one line per module (the team plan §6.3). On a merge conflict keep **both** lines.
 */
registerModules([
  policyAnalyticsModule, // UC-DA-001 (Member 2)
]);
