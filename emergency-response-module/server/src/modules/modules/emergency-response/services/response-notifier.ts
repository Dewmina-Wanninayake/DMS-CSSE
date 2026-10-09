import type { Priority } from '../domain/types';

/**
 * Port (Adapter pattern): the module depends on this, not on the foundation's
 * NotificationService. Implementations MUST NOT throw — a failed delivery is
 * queued for retry (NOTIFICATION_MAX_RETRIES) by the foundation, and must never
 * undo a committed dispatch.
 */
export interface ResponseNotifier {
  notifyTeamDispatched(event: {
    leaderUserId: number;
    dispatchId: number;
    location: string;
    priority: Priority;
  }): Promise<void> | void;
}
