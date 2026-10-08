import type { PolicyDto } from '@dms/shared';
import type { DistrictRepository } from '../../../core/db/district.repository';
import type { UserRepository } from '../../../core/db/user.repository';
import type { PolicyRecord, PolicyRepository } from '../repositories/policy.repository';
import type { SimulationRepository } from '../repositories/simulation.repository';

/** Districts shown by name in the region label; beyond this the provinces are listed instead. */
const MAX_NAMED_DISTRICTS = 3;

/** Builds the API representation of a policy (author, region label, review, simulation id). */
export class PolicyAssembler {
  constructor(
    private readonly users: UserRepository,
    private readonly districts: DistrictRepository,
    private readonly policies: PolicyRepository,
    private readonly simulations: SimulationRepository,
  ) {}

  toDto(record: PolicyRecord): PolicyDto {
    return {
      id: record.id,
      policyKey: record.policyKey,
      version: record.version,
      status: record.status,
      title: record.title,
      description: record.description,
      hazardType: record.hazardType,
      trendReportId: record.trendReportId,
      districtIds: record.districtIds,
      regionLabel: this.regionLabel(record.districtIds),
      mitigationStrategies: record.mitigationStrategies,
      landUseGuidelines: record.landUseGuidelines,
      resourceRules: record.resourceRules,
      warningRiskThreshold: record.warningRiskThreshold,
      proposedEffectiveDate: record.proposedEffectiveDate,
      authorId: record.authorId,
      authorName: this.users.findById(record.authorId)?.fullName ?? 'Unknown analyst',
      effectiveDate: record.effectiveDate,
      supersededBy: record.supersededBy,
      review: this.policies.findReview(record.id),
      simulationReference: this.simulations.latestReference(record.id),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submittedAt: record.submittedAt,
    };
  }

  private regionLabel(districtIds: number[]): string {
    const selected = this.districts.findByIds(districtIds);
    if (selected.length === this.districts.findAll().length) return 'All districts';
    if (selected.length <= MAX_NAMED_DISTRICTS) return selected.map((d) => d.name).join(', ');
    const provinces = [...new Set(selected.map((d) => d.province))];
    return `${provinces.join(' & ')} Province${provinces.length > 1 ? 's' : ''}`;
  }
}
