import type { Database } from 'better-sqlite3';
import { Role } from '@dms/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { DestinationType, type Actor } from '../domain/types';
import { AllocationRepository } from '../repositories/allocation.repository';
import { DispatchRepository } from '../repositories/dispatch.repository';
import { ResourceRepository } from '../repositories/resource.repository';
import { ShelterRepository } from '../repositories/shelter.repository';
import { AllocationService } from '../services/allocation.service';
import { ReversalService } from '../services/reversal.service';
import { createTestDb } from './test-db';
import { AppError } from '../../../core/http/errors';

const OPS: Actor = { id: 1, role: Role.JointOpsLead };

describe('AllocationService / ReversalService', () => {
  let db: Database;
  let resources: ResourceRepository;
  let allocations: AllocationRepository;
  let shelters: ShelterRepository;
  let service: AllocationService;
  let reversals: ReversalService;
  let water: number;
  let rice: number;
  let openShelter: number;
  let fullShelter: number;

  const stock = (id: number): number => resources.findById(id)?.quantity ?? -1;
  const ledgerCount = (): number =>
    (db.prepare('SELECT COUNT(*) c FROM resource_allocations').get() as { c: number }).c;
  const request = (quantity: number, resourceId = water, destinationId = openShelter) => ({
    resourceId,
    quantity,
    destinationType: DestinationType.Shelter,
    destinationId,
  });
  const caught = (fn: () => unknown): AppError => {
    try {
      fn();
    } catch (e) {
      return e as AppError;
    }
    throw new Error('expected the call to throw');
  };

  beforeEach(() => {
    db = createTestDb();
    resources = new ResourceRepository(db);
    allocations = new AllocationRepository(db);
    shelters = new ShelterRepository(db);
    const dispatches = new DispatchRepository(db);
    service = new AllocationService(db, resources, allocations, shelters, dispatches);
    reversals = new ReversalService(db, resources, allocations);
    water = (db.prepare("SELECT id FROM resources WHERE name='Drinking water'").get() as { id: number }).id;
    rice = (db.prepare("SELECT id FROM resources WHERE name='Rice'").get() as { id: number }).id;
    openShelter = shelters.list().find((s) => s.name.startsWith('Colombo'))!.id;
    fullShelter = shelters.list().find((s) => s.name.startsWith('Gampaha'))!.id;
  });

  describe('preview (B3 summary)', () => {
    it('returns a summary with formatted quantities and writes nothing', () => {
      const summary = service.preview({ ...request(1200), instructions: 'Deliver by noon' });
      expect(summary).toMatchObject({
        quantityLabel: '1,200 litres',
        availableLabel: '5,000 litres',
        remainingLabel: '3,800 litres',
        destination: { type: 'Shelter', name: 'Colombo Central Relief Centre' },
        instructions: 'Deliver by noon',
      });
      expect(stock(water)).toBe(5000);
      expect(ledgerCount()).toBe(0);
    });

    it('B3a: INSUFFICIENT_STOCK (422) offers a resupply request', () => {
      const err = caught(() => service.preview(request(5001)));
      expect(err.code).toBe('INSUFFICIENT_STOCK');
      expect(err.status).toBe(422);
      expect(err.details).toMatchObject({ requested: 5001, available: 5000, canRequestResupply: true });
    });

    it('accepts exactly the available stock (boundary)', () => {
      expect(service.preview(request(5000)).remainingLabel).toBe('0 litres');
    });

    it('rejects a non-positive quantity', () => {
      expect(caught(() => service.preview(request(0))).code).toBe('VALIDATION_ERROR');
    });

    it('404 for an unknown resource or destination', () => {
      expect(caught(() => service.preview(request(1, 999))).status).toBe(404);
      expect(caught(() => service.preview(request(1, water, 999))).status).toBe(404);
    });

    it('3a: full shelter → SHELTER_FULL listing other shelters with room', () => {
      const err = caught(() => service.preview(request(10, water, fullShelter)));
      expect(err.code).toBe('SHELTER_FULL');
      const alternatives = (err.details as { alternatives: { name: string; available: number }[] }).alternatives;
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.every((s) => s.available > 0)).toBe(true);
      expect(alternatives.map((s) => s.name)).not.toContain('Gampaha Community Hall Shelter');
    });

    it('can target a dispatch as the destination', () => {
      db.prepare(
        `INSERT INTO dispatches (location, priority, team_id, status, created_by, created_at, updated_at)
         SELECT 'Flood zone', 'High', id, 'Dispatched', 1, 'x', 'x' FROM rescue_teams LIMIT 1`,
      ).run();
      const summary = service.preview({ resourceId: water, quantity: 5, destinationType: DestinationType.Dispatch, destinationId: 1 });
      expect(summary.destination).toMatchObject({ type: 'Dispatch', name: 'Flood zone' });
    });
  });

  describe('create (JOINT #5 transactional confirm)', () => {
    it('deducts stock and records one ledger entry', () => {
      const entry = service.create(request(1200), OPS);
      expect(entry).toMatchObject({ entryType: 'Allocation', quantity: 1200, unit: 'litre', createdBy: 1 });
      expect(stock(water)).toBe(3800);
      expect(ledgerCount()).toBe(1);
    });

    it('B4a: two confirms race for the same stock — the second gets 409 with the current quantity', () => {
      service.create(request(3000), OPS); // first confirm wins
      const err = caught(() => service.create(request(3000), OPS)); // second was previewed against 5,000
      expect(err.code).toBe('STALE_STOCK');
      expect(err.status).toBe(409);
      expect(err.details).toEqual({ resourceId: water, requested: 3000, currentQuantity: 2000 });
      expect(stock(water)).toBe(2000); // never negative, never double-deducted
      expect(ledgerCount()).toBe(1);
    });

    it('rolls back the deduction when the ledger insert fails', () => {
      const failing = {
        insert: () => {
          throw new Error('disk full');
        },
        findById: allocations.findById.bind(allocations),
      } as unknown as AllocationRepository;
      const broken = new AllocationService(db, resources, failing, shelters, new DispatchRepository(db));
      expect(() => broken.create(request(500), OPS)).toThrowError('disk full');
      expect(stock(water)).toBe(5000);
    });

    it('rejects a zero or fractional quantity without touching stock', () => {
      expect(caught(() => service.create(request(0), OPS)).code).toBe('VALIDATION_ERROR');
      expect(caught(() => service.create(request(2.5), OPS)).code).toBe('VALIDATION_ERROR');
      expect(stock(water)).toBe(5000);
    });

    it('refuses a full shelter and changes nothing', () => {
      expect(caught(() => service.create(request(10, water, fullShelter), OPS)).code).toBe('SHELTER_FULL');
      expect(stock(water)).toBe(5000);
    });

    it('defends against a lost race at the SQL level (guarded decrement)', () => {
      const racing = new ResourceRepository(db);
      const original = racing.findById.bind(racing);
      let first = true;
      // Stale read: pretend 100 are available while the table really holds 5,000 → set real to 10.
      db.prepare('UPDATE resources SET quantity = 10 WHERE id = ?').run(rice);
      racing.findById = (id: number) => {
        const r = original(id);
        if (first && r) {
          first = false;
          return { ...r, quantity: 100 };
        }
        return r;
      };
      const svc = new AllocationService(db, racing, allocations, shelters, new DispatchRepository(db));
      const err = caught(() => svc.create(request(50, rice), OPS));
      expect(err.code).toBe('STALE_STOCK');
      expect((err.details as { currentQuantity: number }).currentQuantity).toBe(10);
      expect(stock(rice)).toBe(10);
    });
  });

  describe('reverse (B5a reversing entry)', () => {
    it('restores stock and appends a Reversal row without editing the original', () => {
      const original = service.create(request(1200), OPS);
      const reversal = reversals.reverse(original.id, 'Sent to wrong shelter', OPS);
      expect(reversal).toMatchObject({
        entryType: 'Reversal',
        reversesAllocationId: original.id,
        reason: 'Sent to wrong shelter',
        quantity: 1200,
      });
      expect(stock(water)).toBe(5000);
      expect(allocations.findById(original.id)).toEqual(original); // unchanged
      expect(ledgerCount()).toBe(2);
    });

    it('refuses a second reversal of the same allocation (409)', () => {
      const original = service.create(request(10), OPS);
      reversals.reverse(original.id, 'Mistake', OPS);
      expect(caught(() => reversals.reverse(original.id, 'Again', OPS)).code).toBe('ALREADY_REVERSED');
      expect(stock(water)).toBe(5000);
    });

    it('refuses to reverse a reversal (422)', () => {
      const original = service.create(request(10), OPS);
      const reversal = reversals.reverse(original.id, 'Mistake', OPS);
      expect(caught(() => reversals.reverse(reversal.id, 'Undo undo', OPS)).code).toBe('NOT_REVERSIBLE');
    });

    it('404 for an unknown allocation', () => {
      expect(caught(() => reversals.reverse(999, 'Mistake', OPS)).status).toBe(404);
    });
  });
});
