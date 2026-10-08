import { AlertCircle, AlertTriangle, CheckCircle2, Info, Inbox, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

const ALERT_ICONS = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  info: Info,
} as const;

interface AlertProps {
  tone: keyof typeof ALERT_ICONS;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** Errors use `role="alert"` (announced at once); everything else `role="status"`. */
export function Alert({ tone, title, children, action }: AlertProps) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={20} aria-hidden="true" />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Banner for offline / stale data / Pending Sync (critique Interaction #3). */
export function OfflineBanner({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert--warning" role="status">
      <WifiOff size={20} aria-hidden="true" />
      <div className="alert__body">{children}</div>
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-busy="true">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <span className="muted">{label}</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="state">
      <Inbox size={32} className="muted" aria-hidden="true" />
      <div className="state__title">{title}</div>
      {description && <p className="muted">{description}</p>}
      {action}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="state" role="alert">
      <AlertCircle size={32} color="var(--color-danger)" aria-hidden="true" />
      <div className="state__title">Something went wrong</div>
      <p className="muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
