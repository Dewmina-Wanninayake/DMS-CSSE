import type { Request, Response } from 'express';
import type { Role } from '@dms/shared';
import type { DispatchStatus } from '../domain/team-status';
import type { Actor } from '../domain/types';
import type { AllocationService } from '../services/allocation.service';
import type { DashboardService } from '../services/dashboard.service';
import type { DispatchService } from '../services/dispatch.service';
import type { ReversalService } from '../services/reversal.service';
import type { ResupplyService } from '../services/resupply.service';
import type { ShelterQueryService } from '../services/shelter-query.service';

/** Shape the foundation's `requireAuth` attaches to the request (JWT payload). */
export interface AuthPayload {
  sub: number;
  role: Role;
}
type AuthedRequest = Request & { user: AuthPayload };

const actorOf = (req: Request): Actor => {
  const { sub, role } = (req as AuthedRequest).user;
  return { id: sub, role };
};
const idOf = (req: Request): number => Number(req.params.id);

const ok = (res: Response, data: unknown, status = 200): void => {
  res.status(status).json({ success: true, data });
};

/** Thin HTTP layer: parse → call one service → wrap in the envelope. No SQL, no rules. */
export class EmergencyResponseController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly shelters: ShelterQueryService,
    private readonly dispatches: DispatchService,
    private readonly allocations: AllocationService,
    private readonly reversals: ReversalService,
    private readonly resupply: ResupplyService,
  ) {}

  getDashboard = (_req: Request, res: Response): void => ok(res, this.dashboard.get());

  listShelters = (req: Request, res: Response): void => {
    const districtId = req.query.districtId === undefined ? undefined : Number(req.query.districtId);
    ok(res, this.shelters.list(districtId));
  };

  getShelter = (req: Request, res: Response): void => ok(res, this.shelters.getById(idOf(req)));

  listTeams = (_req: Request, res: Response): void => ok(res, this.dashboard.listTeams());

  previewDispatch = (req: Request, res: Response): void =>
    ok(res, this.dispatches.preview(req.body));

  createDispatch = async (req: Request, res: Response): Promise<void> => {
    const dispatch = await this.dispatches.create(req.body, actorOf(req));
    res.location(`/api/v1/dispatches/${dispatch.id}`);
    ok(res, dispatch, 201);
  };

  updateDispatchStatus = (req: Request, res: Response): void =>
    ok(res, this.dispatches.updateStatus(idOf(req), req.body.status as DispatchStatus, actorOf(req)));

  cancelDispatch = async (req: Request, res: Response): Promise<void> => {
    const { reason, replacementTeamId } = req.body;
    ok(res, await this.dispatches.cancel(idOf(req), reason, actorOf(req), replacementTeamId));
  };

  listResources = (_req: Request, res: Response): void => ok(res, this.dashboard.listResources());

  previewAllocation = (req: Request, res: Response): void =>
    ok(res, this.allocations.preview(req.body));

  createAllocation = (req: Request, res: Response): void => {
    const entry = this.allocations.create(req.body, actorOf(req));
    res.location(`/api/v1/allocations/${entry.id}`);
    ok(res, entry, 201);
  };

  reverseAllocation = (req: Request, res: Response): void =>
    ok(res, this.reversals.reverse(idOf(req), req.body.reason, actorOf(req)), 201);

  createResupplyRequest = (req: Request, res: Response): void =>
    ok(res, this.resupply.create(req.body, actorOf(req)), 201);
}
