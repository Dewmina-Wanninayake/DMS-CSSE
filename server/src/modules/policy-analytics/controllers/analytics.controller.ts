import type { Request, Response } from 'express';
import { HAZARD_TYPES, type TrendReportRequest } from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { HazardDataRepository } from '../repositories/hazard-data.repository';
import type { SettingsService } from '../services/settings.service';
import type { TrendReportService } from '../services/trend-report.service';

const RECENT_REPORTS_LIMIT = 20;

/** HTTP adapter for the analytics half of UC-DA-001 (steps 1–5). */
export class AnalyticsController {
  constructor(
    private readonly trends: TrendReportService,
    private readonly districts: DistrictRepository,
    private readonly data: HazardDataRepository,
    private readonly settings: SettingsService,
  ) {}

  /** Form options for the trend request: districts, hazard types and the thresholds in force. */
  filters = (_req: Request, res: Response): void => {
    sendOk(res, {
      districts: this.districts.findAll().map(({ population: _p, areaKm2: _a, ...ref }) => ref),
      hazardTypes: HAZARD_TYPES,
      thresholds: this.settings.list(),
    });
  };

  latestVerified = (req: Request, res: Response): void => {
    const { limit } = req.validated.query as { limit: number };
    sendOk(res, this.data.latestVerified(limit));
  };

  createTrendReport = (req: Request, res: Response): void => {
    const report = this.trends.generate(
      currentUser(req).id,
      req.validated.body as TrendReportRequest,
    );
    res.location(`${req.baseUrl}/analytics/trend-reports/${report.id}`);
    sendOk(res, report, 201);
  };

  getTrendReport = (req: Request, res: Response): void => {
    sendOk(res, this.trends.get((req.validated.params as { id: number }).id));
  };

  listTrendReports = (_req: Request, res: Response): void => {
    sendOk(res, this.trends.listRecent(RECENT_REPORTS_LIMIT));
  };
}
