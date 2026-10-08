import {
  PolicyStatus,
  Role,
  type AuthUser,
  type PolicyDto,
  type RegulatoryConflict,
} from '@dms/shared';
import { PolicyErrorCode } from '@dms/shared';
import { ForbiddenError, UnprocessableError } from '../../../core/http/errors';
import type { NotificationService } from '../../../core/notifications/notification.service';
import { assertTransition } from '../domain/policy-state-machine';
import { findRegulatoryConflicts } from '../domain/regulatory-conflict-checker';
import { assertSubmittable } from '../domain/submission-rules';
import type { PolicyRepository } from '../repositories/policy.repository';
import type { ReferenceRepository } from '../repositories/reference.repository';
import { POLICY_NOTIFICATION_TYPE, submittedMessage } from './policy-messages';
import type { PolicyAssembler } from './policy.assembler';
import type { PolicyQueryService } from './policy-query.service';

/** Steps 8–9: validate, check regulations, tag the version, mark PendingApproval, notify the Director. */
export class PolicySubmissionService {
  constructor(
    private readonly policies: PolicyRepository,
    private readonly reference: ReferenceRepository,
    private readonly queries: PolicyQueryService,
    private readonly assembler: PolicyAssembler,
    private readonly notifications: NotificationService,
    private readonly clock: () => Date,
    private readonly today: () => string,
  ) {}

  /** Read-only check used by the review step so conflicts can be shown before submitting. */
  checkConflicts(author: AuthUser, id: number): RegulatoryConflict[] {
    const record = this.queries.requireVisible(author, id);
    return findRegulatoryConflicts(record, this.reference.listRegulatoryRules());
  }

  async submit(author: AuthUser, id: number): Promise<PolicyDto> {
    const record = this.queries.requireVisible(author, id);
    if (record.authorId !== author.id)
      throw new ForbiddenError('Only the author can submit a draft.');
    assertTransition(record.status, PolicyStatus.PendingApproval);
    assertSubmittable(record, this.today());

    const conflicts = findRegulatoryConflicts(record, this.reference.listRegulatoryRules());
    if (conflicts.length > 0) {
      throw new UnprocessableError(
        PolicyErrorCode.RegulatoryConflict,
        'The policy conflicts with national regulatory standards. Resolve the flagged clauses before submitting.',
        conflicts,
      );
    }

    this.policies.markSubmitted(record.id, this.clock().toISOString());
    const submitted = this.queries.requireVisible(author, id);
    await this.notifications.notifyRoles({
      roles: [Role.PolicyDirector],
      ...submittedMessage(submitted, author.fullName),
      relatedType: POLICY_NOTIFICATION_TYPE,
      relatedId: submitted.id,
    });
    return this.assembler.toDto(submitted);
  }
}
