import { Router, type RequestHandler } from 'express';
import { Role } from '@dms/shared';
import type { ZodTypeAny } from 'zod';
import type { EmergencyResponseController } from './controllers/emergency-response.controller';
import {
  allocationInputSchema,
  cancelDispatchSchema,
  dispatchInputSchema,
  idParamSchema,
  resupplyRequestSchema,
  redirectRequestSchema,
  reversalSchema,
  shelterListQuerySchema,
  statusUpdateSchema,
} from './schemas/response.schemas';

/**
 * The foundation's HTTP helpers, injected so this router is unit-testable without
 * the real JWT stack (see composition in index.ts).
 */
export interface HttpToolkit {
  authenticate: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
  validate: (schemas: {
    body?: ZodTypeAny;
    params?: ZodTypeAny;
    query?: ZodTypeAny;
  }) => RequestHandler;
}

const OPS = Role.JointOpsLead;
const TEAM_LEAD = Role.RescueTeamLeader;

/** Every route is guarded (deny by default, plan §3.10). Mounted under /api/v1. */
export function buildEmergencyResponseRouter(
  c: EmergencyResponseController,
  { authenticate, requireRole, validate }: HttpToolkit,
): Router {
  const router = Router();
  // Guards are attached per route (never `router.use`) so other modules' paths still reach their own guards.
  const only = (...roles: Role[]) => [authenticate, requireRole(...roles)];

  router.get('/response/dashboard', ...only(OPS), c.getDashboard);

  router.get(
    '/shelters',
    ...only(OPS, TEAM_LEAD),
    validate({ query: shelterListQuerySchema }),
    c.listShelters,
  );
  router.get(
    '/shelters/:id',
    ...only(OPS, TEAM_LEAD),
    validate({ params: idParamSchema }),
    c.getShelter,
  );

  router.post(
    '/shelters/:id/redirect-requests',
    ...only(OPS),
    validate({ params: idParamSchema, body: redirectRequestSchema }),
    c.requestRedirect,
  );

  router.get('/rescue-teams', ...only(OPS), c.listTeams);

  router.get('/dispatches/mine', ...only(TEAM_LEAD), c.myDispatches);
  router.post(
    '/dispatches/preview',
    ...only(OPS),
    validate({ body: dispatchInputSchema }),
    c.previewDispatch,
  );
  router.post(
    '/dispatches',
    ...only(OPS),
    validate({ body: dispatchInputSchema }),
    c.createDispatch,
  );
  router.patch(
    '/dispatches/:id/status',
    ...only(TEAM_LEAD),
    validate({ params: idParamSchema, body: statusUpdateSchema }),
    c.updateDispatchStatus,
  );
  router.post(
    '/dispatches/:id/cancel',
    ...only(OPS),
    validate({ params: idParamSchema, body: cancelDispatchSchema }),
    c.cancelDispatch,
  );

  router.get('/resources', ...only(OPS), c.listResources);

  router.post(
    '/allocations/preview',
    ...only(OPS),
    validate({ body: allocationInputSchema }),
    c.previewAllocation,
  );
  router.post(
    '/allocations',
    ...only(OPS),
    validate({ body: allocationInputSchema }),
    c.createAllocation,
  );
  router.post(
    '/allocations/:id/reversal',
    ...only(OPS),
    validate({ params: idParamSchema, body: reversalSchema }),
    c.reverseAllocation,
  );

  router.post(
    '/resupply-requests',
    ...only(OPS),
    validate({ body: resupplyRequestSchema }),
    c.createResupplyRequest,
  );

  return router;
}
