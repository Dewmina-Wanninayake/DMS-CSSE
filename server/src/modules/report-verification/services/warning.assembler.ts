import type { WarningDto } from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import type { WarningRecord, WarningRepository } from '../repositories/warning.repository';

/** Builds the warning DTO (areas and channels joined in) so services and controllers never see raw rows. */
export class WarningAssembler {
  constructor(
    private readonly warnings: WarningRepository,
    private readonly districts: DistrictRepository,
  ) {}

  toDto(record: WarningRecord): WarningDto {
    const areaIds = this.warnings.areaIds(record.id);
    const areas = this.districts.findByIds(areaIds);
    return {
      id: record.id,
      reportId: record.reportId,
      hazardType: record.hazardType,
      level: record.level,
      reason: record.reason,
      language: record.language,
      status: record.status,
      syncStatus: record.syncStatus,
      areaIds,
      areaNames: areas.map((d) => d.name),
      channels: this.warnings.channels(record.id),
      estimatedAudience: record.estimatedAudience,
      createdBy: record.createdBy,
      issuedAt: record.issuedAt,
      createdAt: record.createdAt,
    };
  }
}
