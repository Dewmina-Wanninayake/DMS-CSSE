import {
  HazardType,
  ReportUpdateKind,
  type AuthUser,
  type ReportDetail,
  type UpdateReportInput,
} from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import type { DistrictRepository } from '../../../core/db/district.repository';
import { NotFoundError, ValidationError } from '../../../core/http/errors';
import { nearestDistrict } from '../domain/geo';
import { statusAfterCitizenUpdate } from '../domain/report-rules';
import type { ReportRecord, ReportRepository } from '../repositories/report.repository';
import type { UpdateRepository } from '../repositories/update.repository';
import { loadOwnedReport } from './report-access';
import type { ReportAssembler } from './report.assembler';

/** Extension 3 (critique CV-003 #3): the citizen answers a "needs more information" request. */
export class ReportUpdateService {
  constructor(
    private readonly db: Db,
    private readonly reports: ReportRepository,
    private readonly updates: UpdateRepository,
    private readonly districts: DistrictRepository,
    private readonly assembler: ReportAssembler,
  ) {}

  /** NeedsInformation → Pending: the report re-enters the officer queue with the new details. */
  update(user: AuthUser, reportId: number, input: UpdateReportInput): ReportDetail {
    const record = loadOwnedReport(this.reports, user, reportId);
    const status = statusAfterCitizenUpdate(record.status);

    if (record.hazardType === HazardType.Other && input.description === '') {
      throw new ValidationError('The request contains invalid data.', [
        { field: 'description', message: 'Describe the hazard when you choose "Other".' },
      ]);
    }

    const moved =
      input.latitude !== undefined && input.longitude !== undefined
        ? nearestDistrict(
            { latitude: input.latitude, longitude: input.longitude },
            this.districts.findAll(),
          )
        : null;
    if (input.latitude !== undefined && !moved) throw new NotFoundError('District');

    this.db.transaction(() => {
      this.reports.applyChanges(reportId, {
        ...input,
        districtId: moved?.district.id,
        status,
      });
      this.updates.insert(reportId, user.id, ReportUpdateKind.CitizenUpdate, describeChange(input));
    })();

    return this.assembler.detail(this.reports.findById(reportId) as ReportRecord);
  }
}

function describeChange(input: UpdateReportInput): string {
  const parts: string[] = [];
  if (input.description !== undefined) parts.push('description');
  if (input.latitude !== undefined) parts.push('location');
  return `Citizen updated the report: ${parts.join(' and ')}.`;
}
