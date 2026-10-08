import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Shows the back arrow of the hi-fi header and links to this path. */
  backTo?: string;
  actions?: ReactNode;
}

/** The navy header band shared by every screen (hi-fi: white title, light subtitle, back arrow). */
export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      {backTo && (
        <Link to={backTo} className="page-header__back" aria-label="Go back">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
      )}
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
