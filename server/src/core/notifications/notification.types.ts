import type { Channel, DeliveryStatus } from '@dms/shared';

export interface NotificationRecord {
  id: number;
  recipientUserId: number;
  recipient: string;
  channel: Channel;
  subject: string;
  body: string;
  deliveryStatus: DeliveryStatus;
  retryCount: number;
  lastError: string | null;
  relatedType: string;
  relatedId: number;
  createdAt: string;
  sentAt: string | null;
}

export interface NewNotification {
  recipientUserId: number;
  recipient: string;
  channel: Channel;
  subject: string;
  body: string;
  relatedType: string;
  relatedId: number;
}

/**
 * Adapter port to the delivery infrastructure (critique DIST-02 #4: delivery lives behind a
 * gateway). Implementations throw when the recipient is unreachable.
 */
export interface NotificationGateway {
  deliver(
    notification: Pick<NewNotification, 'channel' | 'recipient' | 'subject' | 'body'>,
  ): Promise<void>;
}
