import type { LucideIcon } from 'lucide-react';
import type { RouteObject } from 'react-router-dom';
import type { Role } from '@dms/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this entry (and may open the route). */
  roles: readonly Role[];
  /** Match the path exactly (use for index-like entries such as a dashboard). */
  end?: boolean;
}

/** What a feature module contributes to the application shell. */
export interface ClientModule {
  /** Kebab-case id equal to the module folder name. */
  id: string;
  routes: RouteObject[];
  nav: NavItem[];
}

const registered: ClientModule[] = [];

/** Called once by `app/moduleRegistry.ts`; keeps the shell independent of the modules. */
export function registerModules(modules: ClientModule[]): void {
  registered.length = 0;
  registered.push(...modules);
}

export function registeredModules(): readonly ClientModule[] {
  return registered;
}

export function navItemsFor(role: Role): NavItem[] {
  return registered.flatMap((m) => m.nav).filter((item) => item.roles.includes(role));
}

/** The first page a role should land on after signing in. */
export function homePathFor(role: Role): string | undefined {
  return navItemsFor(role)[0]?.to;
}
