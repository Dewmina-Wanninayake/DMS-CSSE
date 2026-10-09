import { Router } from 'express';
import { Role } from '@dms/shared';
import { requireRole } from '../../core/auth/middleware';
import type { AppContext } from '../../core/context';
import { validate } from '../../core/http/validate';
import { VerificationController } from './controllers/verification.controller';
import { WarningController } from './controllers/warning.controller';
import { AudienceEstimator } from './domain/audience-estimator';
import { MinimumEvidenceRule } from './domain/evidence-rule';
import { CriteriaRepository } from './repositories/criteria.repository';
import { HazardReportRepository } from './repositories/hazard-report.repository';
import { VerificationRepository } from './repositories/verification.repository';
import { WarningRepository } from './repositories/warning.repository';
import * as schema from './schemas/report-verification.schemas';
import { ReportVerificationService } from './services/report-verification.service';
import { WarningAssembler } from './services/warning.assembler';
import { WarningService } from './services/warning.service';

function createControllers(ctx: AppContext) {
  const reports = new HazardReportRepository(ctx.db);
  const verifications = new VerificationRepository(ctx.db);
  const warnings = new WarningRepository(ctx.db);
  const criteria = new CriteriaRepository(ctx.db);
  const assembler = new WarningAssembler(warnings, ctx.districts);
  const verification = new ReportVerificationService(
    reports,
    verifications,
    warnings,
    criteria,
    new MinimumEvidenceRule(),
    ctx.hydromet,
    ctx.notifications,
    assembler,
    ctx.clock,
  );
  const warning = new WarningService(
    reports,
    warnings,
    criteria,
    ctx.districts,
    ctx.notifications,
    assembler,
    new AudienceEstimator(),
    ctx.clock,
  );
  return {
    verification: new VerificationController(verification),
    warnings: new WarningController(warning, criteria),
  };
}

const { DutyOfficer: officer, SecondApprover: approver } = Role;

export function createReportVerificationRouter(ctx: AppContext): Router {
  const { verification, warnings } = createControllers(ctx);
  const router = Router();
  const only = (...roles: Role[]) => [ctx.requireAuth, requireRole(...roles)];
  const staff = only(officer, approver);

  router.get('/verification/queue', staff, verification.queue);
  router.get(
    '/verification/reports/:id',
    staff,
    validate({ params: schema.idParams }),
    verification.review,
  );
  router.post(
    '/verification/reports/:id/decision',
    only(officer),
    validate({ params: schema.idParams, body: schema.decisionBody }),
    verification.decide,
  );

  router.post('/warnings/preview', only(officer), validate({ body: schema.previewBody }), warnings.preview);
  router.post('/warnings', only(officer), validate({ body: schema.createWarningBody }), warnings.create);
  router.post(
    '/warnings/:id/approval',
    only(approver),
    validate({ params: schema.idParams, body: schema.approvalBody }),
    warnings.approve,
  );
  router.post(
    '/warnings/:id/correction',
    only(officer),
    validate({ params: schema.idParams, body: schema.correctionBody }),
    warnings.correct,
  );
  router.get('/warnings/:id/delivery', staff, validate({ params: schema.idParams }), warnings.delivery);
  router.get('/hazard-team-rules', staff, warnings.teamRules);

  return router;
}
