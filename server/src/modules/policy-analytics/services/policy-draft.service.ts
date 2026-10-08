import {
  PolicyStatus,
  type AuthUser,
  type PolicyContentInput,
  type PolicyDraftInput,
  type PolicyDto,
  type SyncDraftResult,
} from '@dms/shared';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  InvalidStateError,
} from '../../../core/http/errors';
import { formatPolicyKey } from '../domain/identifiers';
import { isEditable } from '../domain/policy-state-machine';
import type { PolicyRecord, PolicyRepository } from '../repositories/policy.repository';
import type { TrendReportRepository } from '../repositories/trend-report.repository';
import type { PolicyAssembler } from './policy.assembler';
import type { PolicyQueryService } from './policy-query.service';

export interface DraftResult {
  policy: PolicyDto;
  /** False when an offline-created draft with the same `clientId` already existed. */
  created: boolean;
}

/** Write side of drafting: create (step 6), edit, revise after rejection (10a), offline sync (9a). */
export class PolicyDraftService {
  constructor(
    private readonly policies: PolicyRepository,
    private readonly trendReports: TrendReportRepository,
    private readonly assembler: PolicyAssembler,
    private readonly queries: PolicyQueryService,
    private readonly today: () => string,
  ) {}

  /** Creates version 1 of a new policy, pre-filled from the trend report (step 6). */
  createDraft(author: AuthUser, input: PolicyDraftInput): DraftResult {
    if (input.clientId) {
      const existing = this.policies.findByClientId(input.clientId);
      if (existing) return this.existingDraft(author, existing);
    }
    const trend = this.trendReports.getById(input.trendReportId);
    const districtIds = this.trendReports.getDistrictIds(input.trendReportId);
    const year = Number(this.today().slice(0, 4));
    const record = this.policies.insert({
      policyKey: formatPolicyKey(year, this.policies.nextSequence(year)),
      version: 1,
      hazardType: trend.hazardType,
      trendReportId: trend.id,
      districtIds,
      authorId: author.id,
      clientId: input.clientId ?? null,
      title: input.title,
      description: input.description,
      mitigationStrategies: input.mitigationStrategies,
      landUseGuidelines: input.landUseGuidelines,
      resourceRules: input.resourceRules,
      warningRiskThreshold: input.warningRiskThreshold,
      proposedEffectiveDate: input.proposedEffectiveDate,
    });
    return { policy: this.assembler.toDto(record), created: true };
  }

  /** Edits a draft; only its author may, and only while it is still a Draft. */
  updateDraft(author: AuthUser, id: number, content: PolicyContentInput): PolicyDto {
    const record = this.requireOwnDraft(author, id);
    this.policies.updateContent(record.id, content);
    return this.queries.get(author, id);
  }

  /**
   * Extension 10a: after a rejection the analyst revises it as a new version, never in place.
   * An Approved policy can be revised the same way to update it ("edit existing policy"); approving
   * the new version supersedes the old one (assumption A6).
   */
  revise(author: AuthUser, id: number): PolicyDto {
    const source = this.queries.requireVisible(author, id);
    if (source.authorId !== author.id)
      throw new ForbiddenError('Only the author can revise a policy.');
    if (source.status !== PolicyStatus.Rejected && source.status !== PolicyStatus.Approved) {
      throw new InvalidStateError('Only a rejected or approved policy can be revised.');
    }
    const versions = this.policies.findVersions(source.policyKey);
    const latest = versions[versions.length - 1] as PolicyRecord;
    if (latest.id !== source.id) {
      throw new ConflictError('This policy has already been revised.', {
        latestVersionId: latest.id,
      });
    }
    const revision = this.policies.insert({
      policyKey: source.policyKey,
      version: source.version + 1,
      hazardType: source.hazardType,
      trendReportId: source.trendReportId,
      districtIds: source.districtIds,
      authorId: author.id,
      clientId: null,
      title: source.title,
      description: source.description,
      mitigationStrategies: source.mitigationStrategies,
      landUseGuidelines: source.landUseGuidelines,
      resourceRules: source.resourceRules,
      warningRiskThreshold: source.warningRiskThreshold,
      proposedEffectiveDate: null,
    });
    return this.assembler.toDto(revision);
  }

  /**
   * Extension 9a: uploads drafts that were saved on the device as "Pending Sync". Idempotent by
   * `clientId`, so replaying a batch after a flaky connection never duplicates a policy.
   */
  syncDrafts(author: AuthUser, drafts: PolicyDraftInput[]): SyncDraftResult[] {
    return drafts.map((draft) => {
      const clientId = draft.clientId as string;
      try {
        const result = this.createDraft(author, draft);
        return {
          clientId,
          outcome: result.created ? 'Created' : 'Existing',
          policyId: result.policy.id,
        } as const;
      } catch (error) {
        if (error instanceof AppError) {
          return { clientId, outcome: 'Conflict', policyId: null, message: error.message } as const;
        }
        throw error;
      }
    });
  }

  private existingDraft(author: AuthUser, existing: PolicyRecord): DraftResult {
    if (existing.authorId !== author.id) {
      throw new ConflictError('This client id belongs to another analyst.');
    }
    return { policy: this.assembler.toDto(existing), created: false };
  }

  private requireOwnDraft(author: AuthUser, id: number): PolicyRecord {
    const record = this.queries.requireVisible(author, id);
    if (record.authorId !== author.id)
      throw new ForbiddenError('Only the author can edit a draft.');
    if (!isEditable(record.status)) {
      throw new InvalidStateError(`A ${record.status} policy can no longer be edited.`);
    }
    return record;
  }
}
