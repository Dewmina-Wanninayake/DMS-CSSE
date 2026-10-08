import { LogOut } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui/Button';
import { navItemsFor } from './navigation';

/**
 * Role-aware shell: left sidebar from 1024px, bottom tab bar below (the hi-fi's phone layout).
 * Navigation entries come from the module registry, so no module edits this file.
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const items = user ? navItemsFor(user.role) : [];

  return (
    <div className="shell">
      <aside className="shell__sidebar" aria-label="Main navigation">
        <div className="sidebar__brand">
          <strong>DMC Admin</strong>
          <span>Disaster early-warning system</span>
        </div>
        <nav className="sidebar__nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="sidebar__link">
              <Icon size={20} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="sidebar__user">
            <strong>{user.fullName}</strong>
            <p>{user.role.replace(/([a-z])([A-Z])/g, '$1 $2')}</p>
            <Button variant="ghost" icon={<LogOut size={16} aria-hidden="true" />} onClick={logout}>
              Sign out
            </Button>
          </div>
        )}
      </aside>

      <main className="shell__main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__link">
            <Icon size={22} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
