import type { Database } from 'better-sqlite3';
import type { Router } from 'express';
import { EmergencyResponseController } from './controllers/emergency-response.controller';
import { AllocationRepository } from './repositories/allocation.repository';
import { DispatchRepository } from './repositories/dispatch.repository';
import { ResourceRepository } from './repositories/resource.repository';
import { ResupplyRepository } from './repositories/resupply.repository';
import { ShelterRepository } from './repositories/shelter.repository';
import { TeamRepository } from './repositories/team.repository';
import { createEmergencyResponseRouter, type HttpToolkit } from './routes';
import { AllocationService } from './services/allocation.service';
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

  const controller = new EmergencyResponseController(
    new DashboardService(shelters, teams, dispatches, resources),
    new ShelterQueryService(shelters),
    new DispatchService(db, teams, dispatches, notifier),
    new AllocationService(db, resources, allocations, shelters, dispatches),
    new ReversalService(db, resources, allocations),
    new ResupplyService(resources, new ResupplyRepository(db)),
  );
  return createEmergencyResponseRouter(controller, http);
}

export { ErrorCode } from './errors';
export type { ResponseNotifier } from './services/response-notifier';
