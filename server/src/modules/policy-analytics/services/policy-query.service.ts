import type { AuthUser, PolicyDto, PolicyNotificationDto, PolicyStatus } from '@dms/shared';
import type { UserRepository } from '../../../core/db/user.repository';
import { NotFoundError } from '../../../core/http/errors';
import type { NotificationService } from '../../../core/notifications/notification.service';
import type { PolicyRecord, PolicyRepository } from '../repositories/policy.repository';
import type { PolicyAssembler } from './policy.assembler';
import { POLICY_NOTIFICATION_TYPE } from './policy-messages';

export interface PolicyListQuery {
  status?: PolicyStatus;
  mine?: boolean;
  page: number;
  pageSize: number;
}

/** Read side of the policy lifecycle: enforces who may see which policy. */
export class PolicyQueryService {
  constructor(
    private readonly policies: PolicyRepository,
    private readonly assembler: PolicyAssembler,
    private readonly notifications: NotificationService,
    private readonly users: UserRepository,
  ) {}

  list(viewer: AuthUser, query: PolicyListQuery): { items: PolicyDto[]; total: number } {
    const { items, total } = this.policies.list({
      viewerId: viewer.id,
      status: query.status,
      mineOnly: query.mine,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { items: items.map((p) => this.assembler.toDto(p)), total };
  }

  get(viewer: AuthUser, id: number): PolicyDto {
    return this.assembler.toDto(this.requireVisible(viewer, id));
  }

  /** Delivery status of the notifications raised for a policy (step 13 confirmation, 12a). */
  notificationsFor(viewer: AuthUser, id: number): PolicyNotificationDto[] {
    this.requireVisible(viewer, id);
    return this.notifications.listFor(POLICY_NOTIFICATION_TYPE, id).flatMap((n) => {
      const recipient = this.users.findById(n.recipientUserId);
      if (!recipient) return [];
      return [
        {
          id: n.id,
          recipientName: recipient.fullName,
          recipientRole: recipient.role,
          subject: n.subject,
          deliveryStatus: n.deliveryStatus,
          retryCount: n.retryCount,
        },
      ];
    });
  }

  /** Drafts are private to their author; anything else is visible to DMC staff. */
  requireVisible(viewer: AuthUser, id: number): PolicyRecord {
    const record = this.policies.findById(id);
    if (!record || (record.status === 'Draft' && record.authorId !== viewer.id)) {
      throw new NotFoundError('Policy');
    }
    return record;
  }
}
