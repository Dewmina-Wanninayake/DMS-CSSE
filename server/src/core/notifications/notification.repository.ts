import { DeliveryStatus, type Channel } from '@dms/shared';
import type { Db } from '../db/connection';
import type { NewNotification, NotificationRecord } from './notification.types';

interface Row {
  id: number;
  recipient_user_id: number;
  recipient: string;
  channel: Channel;
  subject: string;
  body: string;
  delivery_status: DeliveryStatus;
  retry_count: number;
  last_error: string | null;
  related_type: string;
  related_id: number;
  created_at: string;
  sent_at: string | null;
}

const toRecord = (r: Row): NotificationRecord => ({
  id: r.id,
  recipientUserId: r.recipient_user_id,
  recipient: r.recipient,
  channel: r.channel,
  subject: r.subject,
  body: r.body,
  deliveryStatus: r.delivery_status,
  retryCount: r.retry_count,
  lastError: r.last_error,
  relatedType: r.related_type,
  relatedId: r.related_id,
  createdAt: r.created_at,
  sentAt: r.sent_at,
});

export class NotificationRepository {
  constructor(private readonly db: Db) {}

  insert(n: NewNotification): NotificationRecord {
    const result = this.db
      .prepare(
        `INSERT INTO notifications
           (recipient_user_id, recipient, channel, subject, body, delivery_status, related_type, related_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        n.recipientUserId,
        n.recipient,
        n.channel,
        n.subject,
        n.body,
        DeliveryStatus.Pending,
        n.relatedType,
        n.relatedId,
      );
    return this.getById(Number(result.lastInsertRowid));
  }

  getById(id: number): NotificationRecord {
    return toRecord(this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Row);
  }

  markSent(id: number): void {
    this.db
      .prepare(
        `UPDATE notifications SET delivery_status = ?, last_error = NULL,
           sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
      )
      .run(DeliveryStatus.Sent, id);
  }

  markFailed(id: number, error: string): void {
    this.db
      .prepare(
        'UPDATE notifications SET delivery_status = ?, retry_count = retry_count + 1, last_error = ? WHERE id = ?',
      )
      .run(DeliveryStatus.Failed, error, id);
  }

  findRetryable(maxRetries: number): NotificationRecord[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM notifications WHERE delivery_status = ? AND retry_count < ? ORDER BY id',
        )
        .all(DeliveryStatus.Failed, maxRetries) as Row[]
    ).map(toRecord);
  }

  findByRelated(relatedType: string, relatedId: number): NotificationRecord[] {
    return (
      this.db
        .prepare(
          'SELECT * FROM notifications WHERE related_type = ? AND related_id = ? ORDER BY id',
        )
        .all(relatedType, relatedId) as Row[]
    ).map(toRecord);
  }
}
