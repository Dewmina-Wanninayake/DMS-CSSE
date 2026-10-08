import type { Request, Response } from 'express';
import type {
  PolicyContentInput,
  PolicyDraftInput,
  PolicyStatus,
  ReviewRequest,
  SimulationRequest,
} from '@dms/shared';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { PolicyDraftService } from '../services/policy-draft.service';
import type { PolicyQueryService } from '../services/policy-query.service';
import type { PolicyReviewService } from '../services/policy-review.service';
import type { PolicySubmissionService } from '../services/policy-submission.service';
import type { SimulationService } from '../services/simulation.service';

const policyId = (req: Request): number => (req.validated.params as { id: number }).id;

/** HTTP adapter for the policy half of UC-DA-001 (steps 6–13 and extensions 8a–10a). */
export class PolicyController {
  constructor(
    private readonly drafts: PolicyDraftService,
    private readonly queries: PolicyQueryService,
    private readonly submission: PolicySubmissionService,
    private readonly reviews: PolicyReviewService,
    private readonly simulations: SimulationService,
  ) {}

  createDraft = (req: Request, res: Response): void => {
    const { policy, created } = this.drafts.createDraft(
      currentUser(req),
      req.validated.body as PolicyDraftInput,
    );
    res.location(`${req.baseUrl}/policies/${policy.id}`);
    sendOk(res, policy, created ? 201 : 200);
  };

  syncDrafts = (req: Request, res: Response): void => {
    const { drafts } = req.validated.body as { drafts: PolicyDraftInput[] };
    sendOk(res, this.drafts.syncDrafts(currentUser(req), drafts));
  };

  list = (req: Request, res: Response): void => {
    const query = req.validated.query as {
      status?: PolicyStatus;
      mine: boolean;
      page: number;
      pageSize: number;
    };
    const { items, total } = this.queries.list(currentUser(req), query);
    sendOk(res, items, 200, { page: query.page, pageSize: query.pageSize, total });
  };

  get = (req: Request, res: Response): void => {
    sendOk(res, this.queries.get(currentUser(req), policyId(req)));
  };

  update = (req: Request, res: Response): void => {
    sendOk(
      res,
      this.drafts.updateDraft(
        currentUser(req),
        policyId(req),
        req.validated.body as PolicyContentInput,
      ),
    );
  };

  conflicts = (req: Request, res: Response): void => {
    sendOk(res, this.submission.checkConflicts(currentUser(req), policyId(req)));
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    sendOk(res, await this.submission.submit(currentUser(req), policyId(req)));
  };

  review = async (req: Request, res: Response): Promise<void> => {
    sendOk(
      res,
      await this.reviews.review(
        currentUser(req),
        policyId(req),
        req.validated.body as ReviewRequest,
      ),
    );
  };

  revise = (req: Request, res: Response): void => {
    const revision = this.drafts.revise(currentUser(req), policyId(req));
    res.location(`${req.baseUrl}/policies/${revision.id}`);
    sendOk(res, revision, 201);
  };

  runSimulation = (req: Request, res: Response): void => {
    const result = this.simulations.run(
      currentUser(req),
      policyId(req),
      req.validated.body as SimulationRequest,
    );
    sendOk(res, result, 201);
  };

  listSimulations = (req: Request, res: Response): void => {
    sendOk(res, this.simulations.list(currentUser(req), policyId(req)));
  };

  notifications = (req: Request, res: Response): void => {
    sendOk(res, this.queries.notificationsFor(currentUser(req), policyId(req)));
  };
}
