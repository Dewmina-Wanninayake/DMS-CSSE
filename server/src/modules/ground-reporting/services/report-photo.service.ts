import { Role, type AuthUser, type PhotoInfo } from '@dms/shared';
import { ForbiddenError, InvalidStateError, NotFoundError } from '../../../core/http/errors';
import { PhotoValidator } from '../domain/photo-validator';
import { canChangePhoto } from '../domain/report-rules';
import type { PhotoRepository, StoredPhoto } from '../repositories/photo.repository';
import type { ReportRepository } from '../repositories/report.repository';
import { loadOwnedReport } from './report-access';

/** Staff who may view a report's photo while deciding on it (UC-DIST-02). */
const OFFICER_ROLES: readonly Role[] = [Role.DutyOfficer, Role.SecondApprover];

/** Optional photo: store, replace and serve the one photo of a report. */
export class ReportPhotoService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly photos: PhotoRepository,
    private readonly validator: PhotoValidator,
  ) {}

  attach(
    user: AuthUser,
    reportId: number,
    bytes: Uint8Array,
    contentType: string | undefined,
  ): PhotoInfo {
    const record = loadOwnedReport(this.reports, user, reportId);
    if (!canChangePhoto(record.status)) {
      throw new InvalidStateError(
        `The photo of a ${record.status} report can no longer be changed.`,
      );
    }
    const mimeType = this.validator.validate(bytes, contentType);
    this.photos.save(reportId, mimeType, bytes);
    return { mimeType, sizeBytes: bytes.length };
  }

  /** Owner or duty officer; 404 also when the report simply has no photo. */
  get(user: AuthUser, reportId: number): StoredPhoto {
    const record = this.reports.findById(reportId);
    if (!record) throw new NotFoundError('Report');
    if (record.reporterId !== user.id && !OFFICER_ROLES.includes(user.role)) {
      throw new ForbiddenError('This is not your report.');
    }
    const photo = this.photos.find(reportId);
    if (!photo) throw new NotFoundError('Photo');
    return photo;
  }
}
