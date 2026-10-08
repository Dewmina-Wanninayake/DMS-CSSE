import type { Router } from 'express';
import type { AppContext } from '../core/context';
import { createPolicyAnalyticsRouter } from './policy-analytics/routes';

export interface ModuleDefinition {
  /** Kebab-case module name, equal to its folder name. */
  name: string;
  /** Returns the module's router, mounted under `/api/v1`. */
  createRouter(ctx: AppContext): Router;
}

/**
 * Add exactly one entry per module (the team plan §6.3). On a merge conflict keep **both** lines.
 */
export const modules: ModuleDefinition[] = [
  { name: 'policy-analytics', createRouter: createPolicyAnalyticsRouter }, // UC-DA-001 (Member 2)
];
