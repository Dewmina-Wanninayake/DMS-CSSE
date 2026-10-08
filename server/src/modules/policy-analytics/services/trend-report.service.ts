import type { TrendDistrictResult, TrendReport, TrendReportRequest } from '@dms/shared';
import type { District, DistrictRepository } from '../../../core/db/district.repository';
import { ValidationError } from '../../../core/http/errors';
import type {
  HydrometObservation,
  HydrometProvider,
} from '../../../core/hydromet/hydromet-provider';
import type { Logger } from '../../../core/logger';
import { monthKeys, previousPeriod, toBounds, validatePeriod } from '../domain/period';
import type { RiskClassifier } from '../domain/risk-classifier';
import { isSparse, percentChange, sum, trendDirection } from '../domain/trend-calculator';
import type { HazardDataRepository, DataScope } from '../repositories/hazard-data.repository';
import type { SettingsRepository } from '../repositories/settings.repository';
import type {
  NewTrendReport,
  TrendReportRepository,
} from '../repositories/trend-report.repository';

interface HydrometSummary {
  rainfallMm: number | null;
  maxRiverLevelM: number | null;
}

/**
 * Steps 2–4 of UC-DA-001: retrieve verified reports, historical records and hydromet data for the
 * requested scope, classify each district against the stored threshold, and save the report.
 */
export class TrendReportService {
  constructor(
    private readonly districts: DistrictRepository,
    private readonly settings: SettingsRepository,
    private readonly data: HazardDataRepository,
    private readonly reports: TrendReportRepository,
    private readonly hydromet: HydrometProvider,
    private readonly classifier: RiskClassifier,
    private readonly today: () => string,
    private readonly logger: Logger,
  ) {}

  generate(analystId: number, request: TrendReportRequest): TrendReport {
    const problem = validatePeriod(request.periodStart, request.periodEnd, this.today());
    if (problem) throw new ValidationError(problem, [{ field: 'periodStart', message: problem }]);

    const selected = this.resolveDistricts(request.districtIds);
    const districtIds = selected.map((d) => d.id);
    const thresholds = this.settings.get(request.hazardType);
    const { from, to } = toBounds(request.periodStart, request.periodEnd);
    const scope: DataScope = { hazardType: request.hazardType, districtIds, from, to };

    const verified = this.data.countVerifiedByDistrict(scope);
    const historical = this.data.countHistoricalByDistrict(scope);
    const totalVerified = sum(verified.values());
    const totalHistorical = sum(historical.values());
    const sparse = isSparse(totalVerified + totalHistorical, thresholds.minDataPoints);

    const previous = this.previousTotal(request, districtIds);
    const hydrometByDistrict = this.loadHydromet(districtIds, from, to);

    const districtResults: TrendDistrictResult[] = selected.map((d) => {
      const count = verified.get(d.id) ?? 0;
      return {
        districtId: d.id,
        name: d.name,
        province: d.province,
        latitude: d.latitude,
        longitude: d.longitude,
        verifiedCount: count,
        historicalCount: historical.get(d.id) ?? 0,
        riskLevel: this.classifier.classify(count, thresholds),
        rainfallMm: hydrometByDistrict.data?.get(d.id)?.rainfallMm ?? null,
        maxRiverLevelM: hydrometByDistrict.data?.get(d.id)?.maxRiverLevelM ?? null,
      };
    });

    const current = totalVerified + totalHistorical;
    const monthly = this.monthlySeries(request, scope);
    const report: NewTrendReport = {
      hazardType: request.hazardType,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      thresholds: {
        riskThreshold: thresholds.riskThreshold,
        mediumRatio: thresholds.mediumRatio,
        minDataPoints: thresholds.minDataPoints,
      },
      sparse,
      hydrometAvailable: hydrometByDistrict.available,
      summary: {
        totalVerified,
        totalHistorical,
        highRiskCount: districtResults.filter((d) => d.riskLevel === 'High').length,
        trendDirection: trendDirection(current, previous),
        percentChange: percentChange(current, previous),
      },
      districts: districtResults,
      monthly,
    };
    return this.reports.insert(analystId, districtIds, report);
  }

  get(id: number): TrendReport {
    return this.reports.getById(id);
  }

  listRecent(limit: number): TrendReport[] {
    return this.reports.listRecent(limit);
  }

  private resolveDistricts(requested: number[] | 'all'): District[] {
    if (requested === 'all') return this.districts.findAll();
    const found = this.districts.findByIds([...new Set(requested)]);
    const foundIds = new Set(found.map((d) => d.id));
    const unknown = requested.filter((id) => !foundIds.has(id));
    if (unknown.length > 0) {
      throw new ValidationError('Some selected districts do not exist.', [
        { field: 'districtIds', message: `Unknown district ids: ${unknown.join(', ')}.` },
      ]);
    }
    return found;
  }

  /** Records (verified + historical) in the period of equal length before the requested one. */
  private previousTotal(request: TrendReportRequest, districtIds: number[]): number {
    const prev = previousPeriod(request.periodStart, request.periodEnd);
    const { from, to } = toBounds(prev.start, prev.end);
    const scope: DataScope = { hazardType: request.hazardType, districtIds, from, to };
    return (
      sum(this.data.countVerifiedByDistrict(scope).values()) +
      sum(this.data.countHistoricalByDistrict(scope).values())
    );
  }

  private monthlySeries(request: TrendReportRequest, scope: DataScope): TrendReport['monthly'] {
    const counts = this.data.monthlyCounts(scope);
    return monthKeys(request.periodStart, request.periodEnd).map((month) => ({
      month,
      verified: counts.verified.get(month) ?? 0,
      historical: counts.historical.get(month) ?? 0,
    }));
  }

  /** The hydromet source may be unreachable; the report is still produced without it. */
  private loadHydromet(
    districtIds: number[],
    from: string,
    to: string,
  ): { available: boolean; data: Map<number, HydrometSummary> | null } {
    try {
      const observations = this.hydromet.getObservations({ districtIds, from, to });
      return { available: true, data: summarise(observations) };
    } catch (error) {
      this.logger.warn('Hydromet data unavailable; continuing without it', error);
      return { available: false, data: null };
    }
  }
}

function summarise(observations: HydrometObservation[]): Map<number, HydrometSummary> {
  const byDistrict = new Map<number, HydrometSummary>();
  for (const o of observations) {
    const existing = byDistrict.get(o.districtId);
    byDistrict.set(o.districtId, {
      rainfallMm: Math.round(((existing?.rainfallMm ?? 0) + o.rainfallMm) * 10) / 10,
      maxRiverLevelM: Math.max(existing?.maxRiverLevelM ?? -Infinity, o.riverLevelM),
    });
  }
  return byDistrict;
}
