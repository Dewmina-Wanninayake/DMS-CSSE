import type { Request, Response } from 'express';
import type {
  ApprovalRequest,
  CorrectionRequest,
  CreateWarningRequest,
  WarningPreviewRequest,
} from '@dms/shared';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { CriteriaRepository } from '../repositories/criteria.repository';
import type { WarningService } from '../services/warning.service';

const idOf = (req: Request): number => (req.validated.params as { id: number }).id;

export class WarningController {
  constructor(
    private readonly warnings: WarningService,
    private readonly criteria: CriteriaRepository,
  ) {}

  preview = (req: Request, res: Response): void => {
    sendOk(res, this.warnings.preview(req.validated.body as WarningPreviewRequest));
  };

  create = (req: Request, res: Response): void => {
    const warning = this.warnings.create(currentUser(req), req.validated.body as CreateWarningRequest);
    res.location(`${req.baseUrl}/warnings/${warning.id}/delivery`);
    sendOk(res, warning, 201);
  };

  approve = (req: Request, res: Response): void => {
    sendOk(res, this.warnings.approve(currentUser(req), idOf(req), req.validated.body as ApprovalRequest));
  };

  correct = (req: Request, res: Response): void => {
    sendOk(res, this.warnings.correct(idOf(req), req.validated.body as CorrectionRequest));
  };

  delivery = (req: Request, res: Response): void => {
    sendOk(res, this.warnings.delivery(idOf(req)));
  };

  teamRules = (_req: Request, res: Response): void => {
    sendOk(res, this.criteria.listTeamRules());
  };
}
