import { PolicyStatus, Role, type AuthUser, type PolicyDto, type ReviewRequest } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import { ValidationError } from '../../../core/http/errors';
import type { NotificationService } from '../../../core/notifications/notification.service';
import { parseDay } from '../domain/period';
import { assertTransition } from '../domain/policy-state-machine';
import type { PolicyRecord, PolicyRepository } from '../repositories/policy.repository';
import type { SettingsRepository } from '../repositories/settings.repository';
import { POLICY_NOTIFICATION_TYPE, publishedMessage, rejectedMessage } from './policy-messages';
import type { PolicyAssembler } from './policy.assembler';
import type { PolicyQueryService } from './policy-query.service';

/** Roles told when a policy is published: Duty Officers, regional administrators, field teams (step 12). */
const STAKEHOLDER_ROLES: Role[] = [Role.DutyOfficer, Role.RegionalAdmin, Role.RescueTeamLeader];

/** Steps 10–12 and extension 10a: the Policy Director approves (and publishes) or rejects. */
export class PolicyReviewService {
  constructor(
    private readonly db: Db,
    private readonly policies: PolicyRepository,
    private readonly settings: SettingsRepository,
    private readonly queries: PolicyQueryService,
    private readonly assembler: PolicyAssembler,
    private readonly notifications: NotificationService,
    private readonly today: () => string,
  ) {}

  async review(director: AuthUser, id: number, request: ReviewRequest): Promise<PolicyDto> {
    const record = this.queries.requireVisible(director, id);
    const target = request.decision === 'Approved' ? PolicyStatus.Approved : PolicyStatus.Rejected;
    assertTransition(record.status, target);
    const effectiveDate =
      target === PolicyStatus.Approved ? this.effectiveDate(request, record) : null;

    // The decision, its audit record and the publication commit together or not at all.
    this.db.transaction(() => {
      this.policies.insertReview(record.id, director.id, request.decision, request.comments);
      this.policies.markReviewed(record.id, request.decision, effectiveDate);
      if (target === PolicyStatus.Approved) this.publish(record);
    })();

    const decided = this.queries.requireVisible(director, id);
    // Delivery problems are recorded and retried (12a); they never undo the decision.
    if (target === PolicyStatus.Approved) {
      await this.notifications.notifyRoles({
        roles: STAKEHOLDER_ROLES,
        ...publishedMessage(decided),
        relatedType: POLICY_NOTIFICATION_TYPE,
        relatedId: decided.id,
      });
    } else {
      await this.notifications.notifyUser(decided.authorId, {
        ...rejectedMessage(decided, request.comments),
        relatedType: POLICY_NOTIFICATION_TYPE,
        relatedId: decided.id,
      });
    }
    return this.assembler.toDto(decided);
  }

  /** Step 11: this version becomes the active one and its warning criterion is applied (DA #8). */
  private publish(record: PolicyRecord): void {
    this.policies.supersedeEarlierApprovals(record.policyKey, record.version, record.id);
    if (record.warningRiskThreshold !== null) {
      const current = this.settings.get(record.hazardType);
      this.settings.update(
        record.hazardType,
        {
          riskThreshold: record.warningRiskThreshold,
          mediumRatio: current.mediumRatio,
          minDataPoints: current.minDataPoints,
        },
        record.id,
      );
    }
  }

  /** The Director's date, else the analyst's proposed date if still valid, else today. */
  private effectiveDate(request: ReviewRequest, record: PolicyRecord): string {
    const today = this.today();
    const proposed =
      record.proposedEffectiveDate && record.proposedEffectiveDate >= today
        ? record.proposedEffectiveDate
        : null;
    const chosen = request.effectiveDate ?? proposed ?? today;
    if (!parseDay(chosen) || chosen < today) {
      throw new ValidationError('The effective date must be today or later.', [
        { field: 'effectiveDate', message: 'Choose today or a future date.' },
      ]);
    }
    return chosen;
  }
}
