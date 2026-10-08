import {
  PolicyErrorCode,
  SIMULATION_HAZARD_TYPES,
  type AuthUser,
  type SimulationRequest,
  type SimulationResult,
} from '@dms/shared';
import { ForbiddenError, InvalidStateError, UnprocessableError } from '../../../core/http/errors';
import type { DistrictRepository } from '../../../core/db/district.repository';
import { isEditable } from '../domain/policy-state-machine';
import type { SimulationDistrictInput, SimulationModel } from '../domain/simulation-model';
import type { ReferenceRepository } from '../repositories/reference.repository';
import type { SimulationRepository } from '../repositories/simulation.repository';
import type { TrendReportRepository } from '../repositories/trend-report.repository';
import type { PolicyQueryService } from './policy-query.service';

/** Step 7 (optional): simulate the proposed measures for the districts in the policy's trend report. */
export class SimulationService {
  constructor(
    private readonly queries: PolicyQueryService,
    private readonly trendReports: TrendReportRepository,
    private readonly districts: DistrictRepository,
    private readonly reference: ReferenceRepository,
    private readonly simulations: SimulationRepository,
    private readonly model: SimulationModel,
    private readonly today: () => string,
  ) {}

  run(author: AuthUser, policyId: number, input: SimulationRequest): SimulationResult {
    const policy = this.queries.requireVisible(author, policyId);
    if (policy.authorId !== author.id)
      throw new ForbiddenError('Only the author can simulate a draft.');
    if (!isEditable(policy.status)) {
      throw new InvalidStateError('Simulations can only be run while the policy is a draft.');
    }

    const profile = this.reference.getHazardProfile(policy.hazardType);
    if (!SIMULATION_HAZARD_TYPES.includes(policy.hazardType) || !profile) {
      throw new UnprocessableError(
        PolicyErrorCode.UnsupportedHazard,
        `Simulation is not available for ${policy.hazardType} hazards.`,
      );
    }

    const districts = this.atRiskDistricts(policy.trendReportId, policy.districtIds);
    if (districts.length === 0) {
      throw new UnprocessableError(
        PolicyErrorCode.NoAtRiskDistricts,
        'No district in the trend report has verified reports, so there is nothing to simulate.',
      );
    }

    const output = this.model.run(districts, profile, input);
    return this.simulations.insert(policy.id, policy.hazardType, Number(this.today().slice(0, 4)), {
      status: 'Success',
      hazardType: policy.hazardType,
      input,
      totals: output.totals,
      districts: output.districts,
    });
  }

  /**
   * Only districts that are actually at risk are modelled: High, Medium, or Low with at least one
   * verified report. A district with no reports would otherwise add exposure out of nothing.
   */
  private atRiskDistricts(trendReportId: number, districtIds: number[]): SimulationDistrictInput[] {
    const trend = this.trendReports.getById(trendReportId);
    const findings = new Map(trend.districts.map((d) => [d.districtId, d]));
    return this.districts.findByIds(districtIds).flatMap((d) => {
      const finding = findings.get(d.id);
      if (!finding || (finding.riskLevel === 'Low' && finding.verifiedCount === 0)) return [];
      return [
        {
          districtId: d.id,
          name: d.name,
          riskLevel: finding.riskLevel,
          latitude: d.latitude,
          longitude: d.longitude,
          population: d.population,
          areaKm2: d.areaKm2,
        },
      ];
    });
  }

  list(viewer: AuthUser, policyId: number): SimulationResult[] {
    this.queries.requireVisible(viewer, policyId);
    return this.simulations.listByPolicy(policyId);
  }
}
