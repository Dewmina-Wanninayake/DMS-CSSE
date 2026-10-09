import { useOnlineStatus } from '../../../shared/hooks/useOnlineStatus';
import { formatRelativeTime } from '../../../shared/format/format';
import { OfflineBanner } from '../../../shared/ui/feedback';
import { STALE_AFTER_MINUTES } from '../lib/constants';

interface StaleDataBannerProps {
  /** ISO time the data was loaded from the server. */
  updatedAt: string;
  now?: Date;
}

/**
 * Extension 2a: when the device is offline or the data is old, say so with the last-updated time.
 * Nothing is confirmed from stale data: the server re-checks stock on every confirm (B4).
 */
export function StaleDataBanner({ updatedAt, now = new Date() }: StaleDataBannerProps) {
  const online = useOnlineStatus();
  const ageMinutes = (now.getTime() - new Date(updatedAt).getTime()) / 60_000;
  if (online && ageMinutes < STALE_AFTER_MINUTES) return null;
  return (
    <OfflineBanner>
      {online ? 'This data may be out of date.' : 'You are offline. This data may be delayed.'} Last
      updated {formatRelativeTime(updatedAt, now)}. Stock is checked again when you confirm.
    </OfflineBanner>
  );
}
