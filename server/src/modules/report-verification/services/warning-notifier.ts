import { Channel, Role, type WarningDelivery } from '@dms/shared';
import type { UserRepository } from '../../../core/db/user.repository';
import type { NotificationService } from '../../../core/notifications/notification.service';
import type { CriteriaRepository } from '../repositories/criteria.repository';
import type { WarningRecord, WarningRepository } from '../repositories/warning.repository';
import type { WarningAssembler } from './warning.assembler';

/** `notifications.related_type` used for everything about a warning, so the delivery log can find it. */
const WARNING_RELATED_TYPE = 'warning';

/**
 * Everything a warning tells people, kept apart from the rules that decide whether it may be issued
 * (`WarningService`). Delivery itself goes through the core `NotificationService` and its gateway;
 * a failed send is stored as Failed and retried there, so nothing here ever throws to the caller.
 */
export class WarningNotifier {
  constructor(
    private readonly warnings: WarningRepository,
    private readonly criteria: CriteriaRepository,
    private readonly assembler: WarningAssembler,
    private readonly notifications: NotificationService,
    private readonly users: UserRepository,
  ) {}

  /** Steps 12-13: one message per chosen channel to the team that handles this hazard type. */
  async issued(warningId: number): Promise<void> {
    const warning = this.warnings.getById(warningId);
    const dto = this.assembler.toDto(warning);
    const body = `${dto.level}: ${dto.reason} (${dto.areaNames.join(', ')})`;
    const teamRole = this.criteria.teamRole(warning.hazardType);
    for (const channel of dto.channels) {
      await this.notifications.notifyRoles({
        roles: [teamRole],
        subject: `${dto.level} warning`,
        body,
        relatedType: WARNING_RELATED_TYPE,
        relatedId: warningId,
        channel,
      });
    }
  }

  /** 14a: tell the response team that a warning was withdrawn; push is enough, there is nothing to act on. */
  async withdrawn(warning: WarningRecord): Promise<void> {
    await this.notifications.notifyRoles({
      roles: [this.criteria.teamRole(warning.hazardType)],
      subject: 'Warning withdrawn',
      body: warning.reason,
      relatedType: WARNING_RELATED_TYPE,
      relatedId: warning.id,
      channel: Channel.Push,
    });
  }

  /** 10a: the Second Approver said no, so the officer who raised it is told why. */
  async notApproved(warning: WarningRecord, notes: string | undefined): Promise<void> {
    await this.notifications.notifyUser(warning.createdBy, {
      subject: 'Warning not approved',
      body: `The Second Approver did not approve your ${warning.level} warning.${notes ? ` Reason: ${notes}` : ''}`,
      relatedType: WARNING_RELATED_TYPE,
      relatedId: warning.id,
    });
  }

  /**
   * 10 / 10b: alert one Second Approver. The roster is the Second Approvers in id order; `position`
   * walks along it and wraps round, so each hand-over reaches the next person.
   * @returns whether anyone was alerted (false when there is no Second Approver at all)
   */
  async alertApprover(warningId: number, position: number): Promise<boolean> {
    const roster = this.users.findByRoles([Role.SecondApprover]);
    if (roster.length === 0) return false;
    const warning = this.warnings.getById(warningId);
    const record = await this.notifications.notifyUser(roster[position % roster.length].id, {
      subject:
        position === 0 ? 'Warning awaiting your approval' : 'Warning still awaiting approval',
      body: `A ${warning.level} warning needs a Second Approver.`,
      relatedType: WARNING_RELATED_TYPE,
      relatedId: warningId,
    });
    return record !== null;
  }

  /** Step 14: what was sent on each channel and whether it arrived (with the retry count). */
  deliveries(warningId: number): WarningDelivery['deliveries'] {
    return this.notifications.listFor(WARNING_RELATED_TYPE, warningId).map((n) => ({
      id: n.id,
      channel: n.channel,
      recipient: n.recipient,
      deliveryStatus: n.deliveryStatus,
      retryCount: n.retryCount,
      lastError: n.lastError,
      sentAt: n.sentAt,
    }));
  }

  /** 12a: retry sends that failed; called on a timer by the server. */
  retryFailed(): Promise<number> {
    return this.notifications.retryFailed();
  }
}
