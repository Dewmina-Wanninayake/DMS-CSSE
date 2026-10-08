import { Router } from 'express';
import { Role } from '@dms/shared';
import { requireRole } from '../../core/auth/middleware';
import type { AppContext } from '../../core/context';
import { validate } from '../../core/http/validate';
import { AnalyticsController } from './controllers/analytics.controller';
import { PolicyController } from './controllers/policy.controller';
import { SettingsController } from './controllers/settings.controller';
import { RuleBasedSimulationModel } from './domain/simulation-model';
import { ThresholdRiskClassifier } from './domain/risk-classifier';
import { HazardDataRepository } from './repositories/hazard-data.repository';
import { PolicyRepository } from './repositories/policy.repository';
import { ReferenceRepository } from './repositories/reference.repository';
import { SettingsRepository } from './repositories/settings.repository';
import { SimulationRepository } from './repositories/simulation.repository';
import { TrendReportRepository } from './repositories/trend-report.repository';
import * as schema from './schemas/policy-analytics.schemas';
import { PolicyDraftService } from './services/policy-draft.service';
import { PolicyQueryService } from './services/policy-query.service';
import { PolicyReviewService } from './services/policy-review.service';
import { PolicySubmissionService } from './services/policy-submission.service';
import { PolicyAssembler } from './services/policy.assembler';
import { SettingsService } from './services/settings.service';
import { SimulationService } from './services/simulation.service';
import { TrendReportService } from './services/trend-report.service';

/** Composition root of the module: wires repositories → services → controllers. */
function createControllers(ctx: AppContext) {
  const settingsRepo = new SettingsRepository(ctx.db);
  const dataRepo = new HazardDataRepository(ctx.db);
  const trendRepo = new TrendReportRepository(ctx.db);
  const policyRepo = new PolicyRepository(ctx.db);
  const simulationRepo = new SimulationRepository(ctx.db);
  const referenceRepo = new ReferenceRepository(ctx.db);

  const settings = new SettingsService(settingsRepo);
  const trends = new TrendReportService(
    ctx.districts,
    settingsRepo,
    dataRepo,
    trendRepo,
    ctx.hydromet,
    new ThresholdRiskClassifier(),
    ctx.today,
    ctx.logger,
  );
  const assembler = new PolicyAssembler(ctx.users, ctx.districts, policyRepo, simulationRepo);
  const queries = new PolicyQueryService(policyRepo, assembler, ctx.notifications, ctx.users);
  const drafts = new PolicyDraftService(policyRepo, trendRepo, assembler, queries, ctx.today);
  const submission = new PolicySubmissionService(
    policyRepo,
    referenceRepo,
    queries,
    assembler,
    ctx.notifications,
    ctx.clock,
    ctx.today,
  );
  const reviews = new PolicyReviewService(
    ctx.db,
    policyRepo,
    settingsRepo,
    queries,
    assembler,
    ctx.notifications,
    ctx.today,
  );
  const simulations = new SimulationService(
    queries,
    trendRepo,
    ctx.districts,
    referenceRepo,
    simulationRepo,
    new RuleBasedSimulationModel(),
    ctx.today,
  );

  return {
    analytics: new AnalyticsController(trends, ctx.districts, dataRepo, settings),
    policies: new PolicyController(drafts, queries, submission, reviews, simulations),
    settings: new SettingsController(settings),
  };
}

const { DisasterAnalyst: analyst, PolicyDirector: director } = Role;

/**
 * UC-DA-001 routes (mounted under `/api/v1`). Every route is authenticated and role-guarded (deny by default):
 * policies are internal to DMC teams only (critique §11.4), the Analyst drafts, the Director decides.
 * Static paths are declared before `/policies/:id` so they are not captured as an id.
 */
export function createPolicyAnalyticsRouter(ctx: AppContext): Router {
  const { analytics, policies, settings } = createControllers(ctx);
  const router = Router();

  // Guards are attached per route (never `router.use`), so unknown paths still get a 404 and
  // this router cannot intercept requests meant for other modules.
  const only = (...roles: Role[]) => [ctx.requireAuth, requireRole(...roles)];
  const staff = only(analyst, director);

  router.get('/analytics/filters', staff, analytics.filters);
  router.get(
    '/analytics/verified-reports/latest',
    staff,
    validate({ query: schema.latestReportsQuery }),
    analytics.latestVerified,
  );
  router.post(
    '/analytics/trend-reports',
    only(analyst),
    validate({ body: schema.trendReportBody }),
    analytics.createTrendReport,
  );
  router.get('/analytics/trend-reports', staff, analytics.listTrendReports);
  router.get(
    '/analytics/trend-reports/:id',
    staff,
    validate({ params: schema.idParams }),
    analytics.getTrendReport,
  );

  router.get('/policies/settings', staff, settings.list);
  router.put(
    '/policies/settings/:hazardType',
    only(director),
    validate({ params: schema.hazardParams, body: schema.settingsBody }),
    settings.update,
  );
  router.get(
    '/policies/active/warning-criteria',
    only(Role.DutyOfficer, Role.SecondApprover, analyst, director),
    settings.warningCriteria,
  );

  router.post(
    '/policies/drafts',
    only(analyst),
    validate({ body: schema.policyDraftBody }),
    policies.createDraft,
  );
  router.post(
    '/policies/sync',
    only(analyst),
    validate({ body: schema.syncBody }),
    policies.syncDrafts,
  );
  router.get('/policies', staff, validate({ query: schema.policyListQuery }), policies.list);

  router.get('/policies/:id', staff, validate({ params: schema.idParams }), policies.get);
  router.patch(
    '/policies/:id',
    only(analyst),
    validate({ params: schema.idParams, body: schema.policyContentBody }),
    policies.update,
  );
  router.get(
    '/policies/:id/conflicts',
    only(analyst),
    validate({ params: schema.idParams }),
    policies.conflicts,
  );
  router.post(
    '/policies/:id/submit',
    only(analyst),
    validate({ params: schema.idParams }),
    policies.submit,
  );
  router.post(
    '/policies/:id/review',
    only(director),
    validate({ params: schema.idParams, body: schema.reviewBody }),
    policies.review,
  );
  router.post(
    '/policies/:id/revise',
    only(analyst),
    validate({ params: schema.idParams }),
    policies.revise,
  );
  router.post(
    '/policies/:id/simulations',
    only(analyst),
    validate({ params: schema.idParams, body: schema.simulationBody }),
    policies.runSimulation,
  );
  router.get(
    '/policies/:id/simulations',
    staff,
    validate({ params: schema.idParams }),
    policies.listSimulations,
  );
  router.get(
    '/policies/:id/notifications',
    staff,
    validate({ params: schema.idParams }),
    policies.notifications,
  );

  return router;
}
