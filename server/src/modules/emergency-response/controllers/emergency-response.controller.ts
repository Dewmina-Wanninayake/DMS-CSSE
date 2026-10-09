import type { Request, Response } from 'express';
import { currentUser } from '../../../core/auth/middleware';
import type { DispatchStatus } from '../domain/team-status';
import type { Actor } from '../domain/types';
import type { AllocationService } from '../services/allocation.service';
import type { DashboardService } from '../services/dashboard.service';
import type { DispatchService } from '../services/dispatch.service';
import type { ReversalService } from '../services/reversal.service';
import type { ResupplyService } from '../services/resupply.service';
import type { ShelterQueryService } from '../services/shelter-query.service';

const actorOf = (req: Request): Actor => {
  const { id, role } = currentUser(req);
  return { id, role };
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
    const districtId =
      req.query.districtId === undefined ? undefined : Number(req.query.districtId);
    ok(res, this.shelters.list(districtId));
  };

  getShelter = (req: Request, res: Response): void => ok(res, this.shelters.getById(idOf(req)));

  requestRedirect = async (req: Request, res: Response): Promise<void> =>
    ok(
      res,
      await this.shelters.requestRedirect(idOf(req), req.body.note ?? null, actorOf(req)),
      201,
    );

  listTeams = (_req: Request, res: Response): void => ok(res, this.dashboard.listTeams());

  myDispatches = (req: Request, res: Response): void =>
    ok(res, this.dispatches.listMine(actorOf(req)));

  previewDispatch = (req: Request, res: Response): void =>
    ok(res, this.dispatches.preview(req.body));

  createDispatch = async (req: Request, res: Response): Promise<void> => {
    const dispatch = await this.dispatches.create(req.body, actorOf(req));
    res.location(`/api/v1/dispatches/${dispatch.id}`);
    ok(res, dispatch, 201);
  };

  updateDispatchStatus = (req: Request, res: Response): void =>
    ok(
      res,
      this.dispatches.updateStatus(idOf(req), req.body.status as DispatchStatus, actorOf(req)),
    );

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
