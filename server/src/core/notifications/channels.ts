import { Channel } from '@dms/shared';
import type { Logger } from '../logger';
import type { NewNotification, NotificationGateway } from './notification.types';

/** Strategy for one delivery channel (critique DIST-02 #4, #9). */
export interface ChannelStrategy {
  readonly channel: Channel;
  deliver(notification: Pick<NewNotification, 'recipient' | 'subject' | 'body'>): Promise<void>;
}

class LoggingChannelStrategy implements ChannelStrategy {
  constructor(
    readonly channel: Channel,
    private readonly logger: Logger,
  ) {}

  async deliver(
    notification: Pick<NewNotification, 'recipient' | 'subject' | 'body'>,
  ): Promise<void> {
    this.logger.info(`[${this.channel}] -> ${notification.recipient}: ${notification.subject}`);
  }
}

/**
 * Routes each notification to the Push / SMS / AudibleAlert strategy (UC-DIST-02).
 * Strategies throw when the recipient is unreachable so the core service can retry.
 */
export class ChannelRouterGateway implements NotificationGateway {
  private readonly strategies: Map<Channel, ChannelStrategy>;

  constructor(logger: Logger, strategies?: ChannelStrategy[]) {
    const defaults: ChannelStrategy[] = [
      new LoggingChannelStrategy(Channel.Push, logger),
      new LoggingChannelStrategy(Channel.SMS, logger),
      new LoggingChannelStrategy(Channel.AudibleAlert, logger),
    ];
    this.strategies = new Map((strategies ?? defaults).map((s) => [s.channel, s]));
  }

  async deliver(
    notification: Pick<NewNotification, 'channel' | 'recipient' | 'subject' | 'body'>,
  ): Promise<void> {
    const strategy = this.strategies.get(notification.channel as Channel);
    if (!strategy) {
      throw new Error(`No channel strategy registered for ${notification.channel}`);
    }
    await strategy.deliver(notification);
  }
}
