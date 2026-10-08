import type { Request, Response } from 'express';
import type { HazardType, RiskThresholds } from '@dms/shared';
import { sendOk } from '../../../core/http/envelope';
import type { SettingsService } from '../services/settings.service';

/** Risk thresholds ("policy settings") and the warning criteria published for UC-DIST-02. */
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  list = (_req: Request, res: Response): void => {
    sendOk(res, this.settings.list());
  };

  update = (req: Request, res: Response): void => {
    const { hazardType } = req.validated.params as { hazardType: HazardType };
    sendOk(res, this.settings.update(hazardType, req.validated.body as RiskThresholds));
  };

  warningCriteria = (_req: Request, res: Response): void => {
    sendOk(res, this.settings.activeWarningCriteria());
  };
}
