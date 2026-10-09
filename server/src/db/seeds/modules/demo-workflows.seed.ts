import type { AppContext } from '../../../core/context';
import { startDemoApi, type DemoSummary } from './demo/demo-api';
import { seedPolicies } from './demo/policy.demo';
import { FIRST_DEMO_REPORT_ID, seedReportingAndVerification } from './demo/reporting.demo';
import { seedResponseWorkflows } from './demo/response.demo';

export type { DemoSummary };

/**
 * Demo data for the markers: runs each use case's real workflow through the real HTTP API as the
 * seeded users, so every screen opens with realistic records in every state and every business rule
 * (evidence rule, second approval, duplicate linking, stock transaction, policy versioning) has
 * already been applied.
 *
 * Dev only. Idempotent: it does nothing once its first report exists.
 */
export async function seedDemoWorkflows(ctx: AppContext): Promise<DemoSummary | null> {
  const done = ctx.db
    .prepare('SELECT 1 FROM hazard_reports WHERE client_id = ?')
    .get(FIRST_DEMO_REPORT_ID);
  if (done) return null;

  const api = await startDemoApi(ctx);
  const summary: DemoSummary = {
    reports: 0,
    warnings: 0,
    policies: 0,
    dispatches: 0,
    allocations: 0,
  };
  try {
    await seedReportingAndVerification(api, summary);
    await seedPolicies(api, summary);
    await seedResponseWorkflows(api, summary);
  } finally {
    api.close();
  }
  return summary;
}
