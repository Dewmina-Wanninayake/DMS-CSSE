import {
  GroundReportingErrorCode,
  ReportUpdateKind,
  type AuthUser,
  type FieldUpdateInput,
  type ReportUpdateItem,
} from '@dms/shared';
import { AppError, NotFoundError } from '../../../core/http/errors';
import { assertFieldUpdateAllowed } from '../domain/report-rules';
import type { CertificationRepository } from '../repositories/certification.repository';
import type { ReportRepository } from '../repositories/report.repository';
import type { UpdateRepository } from '../repositories/update.repository';

/** Critique CV-003 #7: a certified volunteer adds an on-the-ground update for their area. */
export class FieldUpdateService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly certifications: CertificationRepository,
    private readonly updates: UpdateRepository,
  ) {}

  /** The report's status is left unchanged; the update only joins its history. */
  add(volunteer: AuthUser, reportId: number, input: FieldUpdateInput): ReportUpdateItem {
    const record = this.reports.findById(reportId);
    if (!record) throw new NotFoundError('Report');
    if (!this.certifications.isCertified(volunteer.id, record.districtId)) {
      throw new AppError(
        403,
        GroundReportingErrorCode.NotCertifiedForArea,
        `You are not certified for ${record.districtName}, so you cannot add field updates there.`,
      );
    }
    assertFieldUpdateAllowed(record.status);
    return this.updates.insert(
      reportId,
      volunteer.id,
      ReportUpdateKind.VolunteerFieldUpdate,
      input.note,
    );
  }
}
