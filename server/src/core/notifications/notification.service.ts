import type { AuthUser, Role } from '@dms/shared';
import { Channel } from '@dms/shared';
import type { UserRepository } from '../db/user.repository';
import type { Logger } from '../logger';
import type { NotificationRepository } from './notification.repository';
import type {
  NewNotification,
  NotificationGateway,
  NotificationRecord,
} from './notification.types';

export interface UserMessage {
  subject: string;
  body: string;
  relatedType: string;
  relatedId: number;
  channel?: Channel;
}

export interface RoleBroadcast extends UserMessage {
  roles: Role[];
}

/**
 * Persists every notification, hands it to the gateway, and records the outcome.
 * A delivery failure never throws to the caller: it is stored as Failed and retried later
 * (UC-DA-001 12a, UC-DIST-02 12a).
 */
export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly gateway: NotificationGateway,
    private readonly users: UserRepository,
    private readonly maxRetries: number,
    private readonly logger: Logger,
  ) {}

  async notify(input: NewNotification): Promise<NotificationRecord> {
    const record = this.repository.insert(input);
    await this.attempt(record);
    return this.repository.getById(record.id);
  }

  /** Sends a notification to one user; returns null when the user no longer exists. */
  async notifyUser(userId: number, message: UserMessage): Promise<NotificationRecord | null> {
    const user = this.users.findById(userId);
    return user ? this.notify(this.toNotification(user, message)) : null;
  }

  /** Sends one notification to every user holding one of the roles. */
  async notifyRoles(broadcast: RoleBroadcast): Promise<NotificationRecord[]> {
    const recipients = this.users.findByRoles(broadcast.roles);
    return Promise.all(recipients.map((user) => this.notify(this.toNotification(user, broadcast))));
  }

  /** Retries Failed notifications that have not exhausted `maxRetries`; returns how many were sent. */
  async retryFailed(): Promise<number> {
    let sent = 0;
    for (const record of this.repository.findRetryable(this.maxRetries)) {
      if (await this.attempt(record)) sent += 1;
    }
    return sent;
  }

  listFor(relatedType: string, relatedId: number): NotificationRecord[] {
    return this.repository.findByRelated(relatedType, relatedId);
  }

  private async attempt(record: NotificationRecord): Promise<boolean> {
    try {
      await this.gateway.deliver(record);
      this.repository.markSent(record.id);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delivery failed';
      this.repository.markFailed(record.id, message);
      this.logger.warn(`Notification ${record.id} failed: ${message}`);
      return false;
    }
  }

  private toNotification(user: AuthUser, b: UserMessage): NewNotification {
    return {
      recipientUserId: user.id,
      recipient: user.email,
      channel: b.channel ?? Channel.Push,
      subject: b.subject,
      body: b.body,
      relatedType: b.relatedType,
      relatedId: b.relatedId,
    };
  }
}
