import {
  HAZARD_TYPES,
  HAZARD_TYPE_LABELS,
  HazardType,
  type AuthUser,
  type HazardTypeOption,
  type ReportDetail,
  type ReportStatus,
  type ReportSummary,
  type ResolvedLocation,
} from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import { NotFoundError } from '../../../core/http/errors';
import { nearestDistrict } from '../domain/geo';
import type { ReportRepository } from '../repositories/report.repository';
import { loadOwnedReport } from './report-access';
import type { ReportAssembler } from './report.assembler';

const KM_DECIMALS = 10;

/** Read side: hazard types, My Reports, one report, location → district. */
export class ReportQueryService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly assembler: ReportAssembler,
    private readonly districts: DistrictRepository,
  ) {}

  hazardTypes(): HazardTypeOption[] {
    return HAZARD_TYPES.map((value) => ({
      value,
      label: HAZARD_TYPE_LABELS[value],
      descriptionRequired: value === HazardType.Other,
    }));
  }

  listMine(
    user: AuthUser,
    query: { status?: ReportStatus; page: number; pageSize: number },
  ): { items: ReportSummary[]; total: number } {
    const { items, total } = this.reports.listByReporter(
      user.id,
      query.status,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    );
    return { items: this.assembler.summaries(items), total };
  }

  getOwned(user: AuthUser, reportId: number): ReportDetail {
    return this.assembler.detail(loadOwnedReport(this.reports, user, reportId));
  }

  resolveLocation(latitude: number, longitude: number): ResolvedLocation {
    const match = nearestDistrict({ latitude, longitude }, this.districts.findAll());
    if (!match) throw new NotFoundError('District');
    const { district, distanceKm } = match;
    return {
      districtId: district.id,
      code: district.code,
      name: district.name,
      province: district.province,
      distanceKm: Math.round(distanceKm * KM_DECIMALS) / KM_DECIMALS,
    };
  }
}
