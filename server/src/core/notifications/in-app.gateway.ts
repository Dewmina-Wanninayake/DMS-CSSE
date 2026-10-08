import type { Logger } from '../logger';
import type { NotificationGateway } from './notification.types';

/**
 * Default gateway: the notification row itself is the in-app message the recipient sees, so
 * "delivery" is recording it. Real SMS / push providers implement `NotificationGateway` the same
 * way (UC-DIST-02 adds Push/SMS/AudibleAlert strategies on top of this port).
 */
export class InAppNotificationGateway implements NotificationGateway {
  constructor(private readonly logger: Logger) {}

  async deliver(notification: {
    channel: string;
    recipient: string;
    subject: string;
  }): Promise<void> {
    this.logger.info(
      `[${notification.channel}] -> ${notification.recipient}: ${notification.subject}`,
    );
  }
}
