import { Role } from '@dms/shared';
import { describe, expect, it } from 'vitest';
import { DestinationRepository } from '../repositories/destination.repository';
import { DispatchRepository } from '../repositories/dispatch.repository';
import { ResourceRepository } from '../repositories/resource.repository';
import { ResupplyRepository } from '../repositories/resupply.repository';
import { ShelterRepository } from '../repositories/shelter.repository';
import { TeamRepository } from '../repositories/team.repository';
import { DashboardService } from '../services/dashboard.service';
import { ResupplyService } from '../services/resupply.service';
import { ShelterQueryService } from '../services/shelter-query.service';
import { seedEmergencyResponse } from '../../../db/seeds/modules/emergency-response.seed';
import { createTestDb } from './test-db';

describe('ShelterQueryService (read-only)', () => {
  const db = createTestDb();
  const service = new ShelterQueryService(new ShelterRepository(db));

  it('lists all seeded shelters with occupancy', () => {
    const list = service.list();
    expect(list).toHaveLength(4);
    expect(list.find((s) => s.name.startsWith('Gampaha'))).toMatchObject({
      capacity: 250,
      occupied: 250,
      available: 0,
    });
  });

  it('filters by district', () => {
    const colombo = db.prepare("SELECT id FROM districts WHERE name='Colombo'").get() as {
      id: number;
    };
    expect(service.list(colombo.id).map((s) => s.name)).toEqual(['Colombo Central Relief Centre']);
  });

  it('gets one shelter, or 404', () => {
    expect(service.getById(1).name).toBeTruthy();
    expect(() => service.getById(999)).toThrowError(/not found/);
  });

  it('treats a shelter with no occupancy row as empty', () => {
    db.prepare(
      "INSERT INTO shelters (name, district_id, address, capacity) VALUES ('New', 1, 'x', 10)",
    ).run();
    const created = service.list().find((s) => s.name === 'New');
    expect(created).toMatchObject({ occupied: 0, available: 10, occupancyUpdatedAt: null });
  });

  it('exposes no write methods (JOINT #2)', () => {
    const methods = Object.getOwnPropertyNames(ShelterRepository.prototype);
    expect(methods.filter((m) => /insert|update|delete|set|save/i.test(m))).toEqual([]);
  });
});

describe('seedEmergencyResponse', () => {
  it('is idempotent', () => {
    const db = createTestDb();
    seedEmergencyResponse(db);
    seedEmergencyResponse(db);
    expect(db.prepare('SELECT COUNT(*) c FROM shelters').get()).toEqual({ c: 4 });
    expect(db.prepare('SELECT COUNT(*) c FROM rescue_teams').get()).toEqual({ c: 3 });
  });

  it('skips shelters whose district is missing instead of inventing one', () => {
    const db = createTestDb();
    db.exec(
      "DELETE FROM shelter_occupancy; DELETE FROM shelters; DELETE FROM districts WHERE name = 'Colombo'",
    );
    seedEmergencyResponse(db);
    expect(db.prepare('SELECT COUNT(*) c FROM shelters').get()).toEqual({ c: 3 });
  });
});

describe('DashboardService', () => {
  it('summarises KPIs, flags low stock and formats quantities', () => {
    const db = createTestDb();
    db.prepare("UPDATE resources SET quantity = 10 WHERE name = 'First-aid kits'").run();
    const dashboard = new DashboardService(
      new ShelterRepository(db),
      new TeamRepository(db),
      new DispatchRepository(db),
      new ResourceRepository(db),
      new DestinationRepository(db),
    ).get();
    expect(dashboard.kpis).toEqual({
      activeDispatches: 0,
      availableTeams: 3,
      shelterBedsFree: 280 + 0 + 210 + 40,
      lowStockResources: 1,
    });
    expect(dashboard.resources.find((r) => r.name === 'First-aid kits')).toMatchObject({
      quantityLabel: '10 units',
      lowStock: true,
    });
    expect(dashboard.teams).toHaveLength(3);
  });
});

describe('ResupplyService (B3a)', () => {
  const db = createTestDb();
  const service = new ResupplyService(new ResourceRepository(db), new ResupplyRepository(db));
  const actor = { id: 1, role: Role.JointOpsLead };

  it('records an Open request', () => {
    const r = service.create({ resourceId: 1, quantity: 500, note: 'Urgent' }, actor);
    expect(r).toMatchObject({
      resourceId: 1,
      quantity: 500,
      note: 'Urgent',
      status: 'Open',
      requestedBy: 1,
    });
  });

  it('stores a missing note as null', () => {
    expect(service.create({ resourceId: 1, quantity: 5 }, actor).note).toBeNull();
  });

  it('404 for an unknown resource', () => {
    expect(() => service.create({ resourceId: 999, quantity: 5 }, actor)).toThrowError(/not found/);
  });
});
