import type { Request, Response } from 'express';
import type { DecisionRequest } from '@dms/shared';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { ReportVerificationService } from '../services/report-verification.service';

const idOf = (req: Request): number => (req.validated.params as { id: number }).id;

/** Thin HTTP layer: validated input in, one service call, envelope out. No rules and no SQL. */
export class VerificationController {
  constructor(private readonly service: ReportVerificationService) {}

  queue = (_req: Request, res: Response): void => {
    sendOk(res, this.service.queue());
  };

  review = (req: Request, res: Response): void => {
    sendOk(res, this.service.review(idOf(req)));
  };

  decide = (req: Request, res: Response): void => {
    sendOk(
      res,
      this.service.decide(currentUser(req), idOf(req), req.validated.body as DecisionRequest),
    );
  };
}
