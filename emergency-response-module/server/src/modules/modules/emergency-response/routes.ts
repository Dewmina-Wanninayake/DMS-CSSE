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
  validate: (schemas: { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny }) => RequestHandler;
}

const OPS = Role.JointOpsLead;
const TEAM_LEAD = Role.RescueTeamLeader;

/** Every route is guarded (deny by default, plan §3.10). Mounted under /api/v1. */
export function createEmergencyResponseRouter(
  c: EmergencyResponseController,
  { authenticate, requireRole, validate }: HttpToolkit,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get('/response/dashboard', requireRole(OPS), c.getDashboard);

  router.get('/shelters', requireRole(OPS, TEAM_LEAD), validate({ query: shelterListQuerySchema }), c.listShelters);
  router.get('/shelters/:id', requireRole(OPS, TEAM_LEAD), validate({ params: idParamSchema }), c.getShelter);

  router.get('/rescue-teams', requireRole(OPS), c.listTeams);

  router.post('/dispatches/preview', requireRole(OPS), validate({ body: dispatchInputSchema }), c.previewDispatch);
  router.post('/dispatches', requireRole(OPS), validate({ body: dispatchInputSchema }), c.createDispatch);
  router.patch(
    '/dispatches/:id/status',
    requireRole(TEAM_LEAD),
    validate({ params: idParamSchema, body: statusUpdateSchema }),
    c.updateDispatchStatus,
  );
  router.post(
    '/dispatches/:id/cancel',
    requireRole(OPS),
    validate({ params: idParamSchema, body: cancelDispatchSchema }),
    c.cancelDispatch,
  );

  router.get('/resources', requireRole(OPS), c.listResources);

  router.post('/allocations/preview', requireRole(OPS), validate({ body: allocationInputSchema }), c.previewAllocation);
  router.post('/allocations', requireRole(OPS), validate({ body: allocationInputSchema }), c.createAllocation);
  router.post(
    '/allocations/:id/reversal',
    requireRole(OPS),
    validate({ params: idParamSchema, body: reversalSchema }),
    c.reverseAllocation,
  );

  router.post('/resupply-requests', requireRole(OPS), validate({ body: resupplyRequestSchema }), c.createResupplyRequest);

  return router;
}
