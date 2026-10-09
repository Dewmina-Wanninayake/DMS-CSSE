import type { Database } from 'better-sqlite3';
import { Role } from '@dms/shared';
import type { NextFunction, Request, Response, Router } from 'express';
import { requireRole } from '../../core/auth/middleware';
import type { AppContext } from '../../core/context';
import { validate } from '../../core/http/validate';
import { EmergencyResponseController } from './controllers/emergency-response.controller';
import { AllocationRepository } from './repositories/allocation.repository';
import { DestinationRepository } from './repositories/destination.repository';
import { DispatchRepository } from './repositories/dispatch.repository';
import { ResourceRepository } from './repositories/resource.repository';
import { ResupplyRepository } from './repositories/resupply.repository';
import { ShelterRepository } from './repositories/shelter.repository';
import { TeamRepository } from './repositories/team.repository';
import { buildEmergencyResponseRouter, type HttpToolkit } from './router';
import { AllocationService } from './services/allocation.service';
import { createDestinationResolvers } from './services/destination-resolvers';
import { DashboardService } from './services/dashboard.service';
import { DispatchService } from './services/dispatch.service';
import type { ResponseNotifier } from './services/response-notifier';
import { ResupplyService } from './services/resupply.service';
import { ReversalService } from './services/reversal.service';
import { ShelterQueryService } from './services/shelter-query.service';

/**
 * Composition root (constructor injection). The one line in
 * server/src/modules/registry.ts calls this with the foundation's db,
 * a ResponseNotifier adapter over NotificationService, and its auth/validate helpers.
 */
export function createEmergencyResponseModule(
  db: Database,
  notifier: ResponseNotifier,
  http: HttpToolkit,
): Router {
  const shelters = new ShelterRepository(db);
  const teams = new TeamRepository(db);
  const dispatches = new DispatchRepository(db);
  const resources = new ResourceRepository(db);
  const allocations = new AllocationRepository(db);
  const destinations = new DestinationRepository(db);

  const controller = new EmergencyResponseController(
    new DashboardService(shelters, teams, dispatches, resources, destinations),
    new ShelterQueryService(shelters, notifier),
    new DispatchService(db, teams, dispatches, notifier),
    new AllocationService(
      db,
      resources,
      allocations,
      createDestinationResolvers(shelters, destinations),
    ),
    new ReversalService(db, resources, allocations),
    new ResupplyService(resources, new ResupplyRepository(db)),
  );
  return buildEmergencyResponseRouter(controller, http);
}

export { ErrorCode } from './errors';
export type { ResponseNotifier } from './services/response-notifier';

/**
 * Adapts the foundation's helpers to the module's `HttpToolkit`. The core `validate()` exposes the
 * parsed values on `req.validated`; the controller reads `req.body`, so the parsed body (with
 * coerced numbers and trimmed text) is written back before the controller runs.
 */
function toolkitFor(ctx: AppContext): HttpToolkit {
  return {
    authenticate: ctx.requireAuth,
    requireRole,
    validate: (schemas) => {
      const parse = validate(schemas);
      return (req: Request, res: Response, next: NextFunction) =>
        parse(req, res, (error?: unknown) => {
          if (!error && req.validated?.body !== undefined) req.body = req.validated.body;
          next(error);
        });
    },
  };
}

/** Sends the dispatched-team notification through the core service; never throws (see the port). */
function notifierFor(ctx: AppContext): ResponseNotifier {
  return {
    async notifyTeamDispatched({ leaderUserId, dispatchId, location, priority }) {
      try {
        await ctx.notifications.notifyUser(leaderUserId, {
          subject: `Dispatched to ${location}`,
          body: `Your team has been dispatched to ${location} (priority ${priority}). Update your status as you move.`,
          relatedType: 'Dispatch',
          relatedId: dispatchId,
        });
      } catch (error) {
        ctx.logger.warn(`Dispatch ${dispatchId} notification failed: ${String(error)}`);
      }
    },
    async requestShelterRedirect({ shelterId, shelterName, note }) {
      try {
        await ctx.notifications.notifyRoles({
          roles: [Role.ShelterCoordinator],
          subject: `Redirect requested: ${shelterName} is full`,
          body: `Joint Operations asks you to redirect people from ${shelterName}.${note ? ` Note: ${note}` : ''}`,
          relatedType: 'Shelter',
          relatedId: shelterId,
        });
      } catch (error) {
        ctx.logger.warn(`Shelter ${shelterId} redirect request failed: ${String(error)}`);
      }
    },
  };
}

/** Registry entry point (`ModuleDefinition.createRouter`) for UC-JOINT-001. */
export function createEmergencyResponseRouter(ctx: AppContext): Router {
  return createEmergencyResponseModule(ctx.db, notifierFor(ctx), toolkitFor(ctx));
}
