import express, { Router, type RequestHandler } from 'express';
import { GroundReportingErrorCode, PHOTO_MIME_TYPES, Role } from '@dms/shared';
import { requireRole } from '../../core/auth/middleware';
import type { AppContext } from '../../core/context';
import { UnprocessableError } from '../../core/http/errors';
import { validate } from '../../core/http/validate';
import { PhotoController } from './controllers/photo.controller';
import { ReportController } from './controllers/report.controller';
import { PhotoValidator } from './domain/photo-validator';
import { CertificationRepository } from './repositories/certification.repository';
import { OutcomeRepository } from './repositories/outcome.repository';
import { PhotoRepository } from './repositories/photo.repository';
import { ReportRepository } from './repositories/report.repository';
import { ReportSettingsRepository } from './repositories/settings.repository';
import { UpdateRepository } from './repositories/update.repository';
import * as schema from './schemas/ground-reporting.schemas';
import { FieldUpdateService } from './services/field-update.service';
import { ReportPhotoService } from './services/report-photo.service';
import { ReportQueryService } from './services/report-query.service';
import { ReportSubmissionService } from './services/report-submission.service';
import { ReportSyncService } from './services/report-sync.service';
import { ReportUpdateService } from './services/report-update.service';
import { ReportAssembler } from './services/report.assembler';

/** Above the 2 MB cap on purpose: `PhotoValidator` decides, so the client gets a clear 422. */
const PHOTO_PARSER_LIMIT = '4mb';

/** Composition root of the module: wires repositories → services → controllers. */
function createControllers(ctx: AppContext) {
  const reports = new ReportRepository(ctx.db);
  const photos = new PhotoRepository(ctx.db);
  const updates = new UpdateRepository(ctx.db);
  const assembler = new ReportAssembler(new OutcomeRepository(ctx.db), updates);

  const submission = new ReportSubmissionService(
    reports,
    new ReportSettingsRepository(ctx.db),
    ctx.districts,
    assembler,
    ctx.clock,
  );
  const queries = new ReportQueryService(reports, assembler, ctx.districts);

  return {
    reports: new ReportController(
      submission,
      new ReportSyncService(submission),
      queries,
      new ReportUpdateService(ctx.db, reports, updates, ctx.districts, assembler),
      new FieldUpdateService(reports, new CertificationRepository(ctx.db), updates),
    ),
    photos: new PhotoController(new ReportPhotoService(reports, photos, new PhotoValidator())),
  };
}

/**
 * Reads the photo as raw bytes. The global JSON parser ignores image types, so this needs no change
 * to the shared app; a body over the parser limit becomes the same 422 as one over 2 MB.
 */
function rawPhotoBody(): RequestHandler {
  const parse = express.raw({ type: [...PHOTO_MIME_TYPES], limit: PHOTO_PARSER_LIMIT });
  return (req, res, next) => {
    parse(req, res, (error?: unknown) => {
      if ((error as { type?: string } | undefined)?.type === 'entity.too.large') {
        next(
          new UnprocessableError(
            GroundReportingErrorCode.PhotoTooLarge,
            'The photo is larger than 2 MB. Choose a smaller photo or take a new one.',
          ),
        );
        return;
      }
      next(error);
    });
  };
}

const { Citizen: citizen, Volunteer: volunteer } = Role;

/**
 * UC-CV-003 routes (mounted under `/api/v1`). Login is required for every route (critique CV-003 #6)
 * and citizens and volunteers only ever reach their own reports. Static paths are declared before
 * `/reports/:id` so they are not captured as an id.
 */
export function createGroundReportingRouter(ctx: AppContext): Router {
  const { reports, photos } = createControllers(ctx);
  const router = Router();

  // Guards are attached per route (never `router.use`), so unknown paths still get a 404.
  const only = (...roles: Role[]) => [ctx.requireAuth, requireRole(...roles)];
  const reporter = only(citizen, volunteer);
  const photoViewer = only(citizen, volunteer, Role.DutyOfficer, Role.SecondApprover);

  router.get('/reports/hazard-types', reporter, reports.hazardTypes);
  router.get('/reports/mine', reporter, validate({ query: schema.mineQuery }), reports.mine);
  router.post('/reports/sync', reporter, validate({ body: schema.syncBody }), reports.syncReports);
  router.post('/reports', reporter, validate({ body: schema.submitBody }), reports.submit);

  router.get('/reports/:id', reporter, validate({ params: schema.idParams }), reports.get);
  router.patch(
    '/reports/:id',
    reporter,
    validate({ params: schema.idParams, body: schema.updateBody }),
    reports.update,
  );
  router.put(
    '/reports/:id/photo',
    reporter,
    rawPhotoBody(),
    validate({ params: schema.idParams }),
    photos.put,
  );
  router.get('/reports/:id/photo', photoViewer, validate({ params: schema.idParams }), photos.get);
  router.post(
    '/reports/:id/field-updates',
    only(volunteer),
    validate({ params: schema.idParams, body: schema.fieldUpdateBody }),
    reports.addFieldUpdate,
  );

  router.get(
    '/locations/resolve',
    reporter,
    validate({ query: schema.resolveQuery }),
    reports.resolveLocation,
  );

  return router;
}
