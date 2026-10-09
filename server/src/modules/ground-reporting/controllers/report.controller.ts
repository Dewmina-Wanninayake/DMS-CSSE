import type { Request, Response } from 'express';
import type {
  FieldUpdateInput,
  ReportStatus,
  SubmitReportInput,
  UpdateReportInput,
} from '@dms/shared';
import { currentUser } from '../../../core/auth/middleware';
import { sendOk } from '../../../core/http/envelope';
import type { FieldUpdateService } from '../services/field-update.service';
import type { ReportQueryService } from '../services/report-query.service';
import type { ReportSubmissionService } from '../services/report-submission.service';
import type { ReportSyncService } from '../services/report-sync.service';
import type { ReportUpdateService } from '../services/report-update.service';

const reportId = (req: Request): number => (req.validated.params as { id: number }).id;

/** HTTP adapter for UC-CV-003 reports (submit, My Reports, update-report and field-update flows). */
export class ReportController {
  constructor(
    private readonly submission: ReportSubmissionService,
    private readonly sync: ReportSyncService,
    private readonly queries: ReportQueryService,
    private readonly updates: ReportUpdateService,
    private readonly fieldUpdates: FieldUpdateService,
  ) {}

  hazardTypes = (_req: Request, res: Response): void => {
    sendOk(res, this.queries.hazardTypes());
  };

  submit = (req: Request, res: Response): void => {
    const { report, created } = this.submission.submit(
      currentUser(req),
      req.validated.body as SubmitReportInput,
    );
    res.location(`${req.baseUrl}/reports/${report.id}`);
    sendOk(res, report, created ? 201 : 200);
  };

  syncReports = (req: Request, res: Response): void => {
    const { reports } = req.validated.body as { reports: unknown[] };
    sendOk(res, this.sync.sync(currentUser(req), reports));
  };

  mine = (req: Request, res: Response): void => {
    const query = req.validated.query as { status?: ReportStatus; page: number; pageSize: number };
    const { items, total } = this.queries.listMine(currentUser(req), query);
    sendOk(res, items, 200, { page: query.page, pageSize: query.pageSize, total });
  };

  get = (req: Request, res: Response): void => {
    sendOk(res, this.queries.getOwned(currentUser(req), reportId(req)));
  };

  update = (req: Request, res: Response): void => {
    sendOk(
      res,
      this.updates.update(currentUser(req), reportId(req), req.validated.body as UpdateReportInput),
    );
  };

  addFieldUpdate = (req: Request, res: Response): void => {
    const item = this.fieldUpdates.add(
      currentUser(req),
      reportId(req),
      req.validated.body as FieldUpdateInput,
    );
    sendOk(res, item, 201);
  };

  resolveLocation = (req: Request, res: Response): void => {
    const { lat, lng } = req.validated.query as { lat: number; lng: number };
    sendOk(res, this.queries.resolveLocation(lat, lng));
  };
}
