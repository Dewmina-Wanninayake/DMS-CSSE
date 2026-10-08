import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface CardProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, actions, children, className }: CardProps) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`} aria-label={title}>
      {(title || actions) && (
        <div className="card__header">
          {title && <h2 className="h3">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

interface IconChipProps {
  icon: LucideIcon;
  tone?: 'default' | 'warning';
}

export function IconChip({ icon: Icon, tone = 'default' }: IconChipProps) {
  return (
    <span
      className={`icon-chip${tone === 'warning' ? ' icon-chip--warning' : ''}`}
      aria-hidden="true"
    >
      <Icon size={20} strokeWidth={1.75} />
    </span>
  );
}

interface TileLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Optional big number shown under the label (e.g. pending approvals). */
  value?: number | string;
}

/** Dashboard tile from the hi-fi: icon chip + label. */
export function TileLink({ to, icon, label, value }: TileLinkProps) {
  return (
    <Link to={to} className="tile">
      <IconChip icon={icon} />
      {value !== undefined && <span className="tile__value">{value}</span>}
      <span>{label}</span>
    </Link>
  );
}

interface ListItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  to?: string;
  tone?: 'default' | 'warning';
}

/** Row used by "Latest verified ground reports" and policy/queue lists. */
export function ListItem({ icon, title, subtitle, trailing, to, tone }: ListItemProps) {
  const content = (
    <>
      <IconChip icon={icon} tone={tone} />
      <div className="list-item__body">
        <div className="list-item__title">{title}</div>
        {subtitle && <div className="muted">{subtitle}</div>}
      </div>
      {trailing !== undefined && <div className="list-item__trailing">{trailing}</div>}
    </>
  );
  return to ? (
    <Link to={to} className="list-item">
      {content}
    </Link>
  ) : (
    <div className="list-item">{content}</div>
  );
}
