import type { Database } from 'better-sqlite3';
import { Role } from '@dms/shared';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { DispatchStatus } from '../domain/team-status';
import { type Actor, Priority, TeamAvailability } from '../domain/types';
import { DispatchRepository } from '../repositories/dispatch.repository';
import { TeamRepository } from '../repositories/team.repository';
import { DispatchService } from '../services/dispatch.service';
import type { ResponseNotifier } from '../services/response-notifier';
import { createTestDb } from './test-db';

const OPS: Actor = { id: 1, role: Role.JointOpsLead };
const leader = (id: number): Actor => ({ id, role: Role.RescueTeamLeader });
const input = { location: 'Kelani river bank, Kaduwela', priority: Priority.High, teamId: 1 };

describe('DispatchService', () => {
  let db: Database;
  let teams: TeamRepository;
  let notifier: { notifyTeamDispatched: Mock<ResponseNotifier['notifyTeamDispatched']> };
  let service: DispatchService;

  beforeEach(() => {
    db = createTestDb();
    teams = new TeamRepository(db);
    notifier = { notifyTeamDispatched: vi.fn<ResponseNotifier['notifyTeamDispatched']>() };
    service = new DispatchService(db, teams, new DispatchRepository(db), notifier);
  });

  describe('preview (A1 summary)', () => {
    it('returns the summary without writing anything', () => {
      const summary = service.preview({ ...input, instructions: 'Bring boats' });
      expect(summary.team).toMatchObject({ id: 1, name: 'Alpha Rescue Team' });
      expect(summary.instructions).toBe('Bring boats');
      expect(db.prepare('SELECT COUNT(*) c FROM dispatches').get()).toEqual({ c: 0 });
    });

    it('fails with TEAM_UNAVAILABLE when the team is busy (error state: no team)', () => {
      teams.setAvailability(1, TeamAvailability.Busy);
      expect(() => service.preview(input)).toThrowError(/already on another dispatch/);
    });

    it('fails with 404 for an unknown team', () => {
      expect(() => service.preview({ ...input, teamId: 999 })).toThrowError(/not found/);
    });
  });

  describe('create', () => {
    it('creates a Dispatched dispatch, marks the team busy and notifies the leader', async () => {
      const dispatch = await service.create(input, OPS);
      expect(dispatch.status).toBe(DispatchStatus.Dispatched);
      expect(teams.findById(1)?.availability).toBe(TeamAvailability.Busy);
      expect(notifier.notifyTeamDispatched).toHaveBeenCalledWith({
        leaderUserId: 2,
        dispatchId: dispatch.id,
        location: input.location,
        priority: Priority.High,
      });
    });

    it('does not double-book a team (second confirm fails, nothing extra written)', async () => {
      await service.create(input, OPS);
      await expect(service.create(input, OPS)).rejects.toThrowError(/already on another dispatch/);
      expect(db.prepare('SELECT COUNT(*) c FROM dispatches').get()).toEqual({ c: 1 });
    });

    it('skips the notification when the team has no linked leader user', async () => {
      db.prepare('UPDATE rescue_teams SET leader_user_id = NULL WHERE id = 1').run();
      await service.create(input, OPS);
      expect(notifier.notifyTeamDispatched).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus (A5 / A5a)', () => {
    it('walks Dispatched → EnRoute → OnSite → Completed and frees the team', async () => {
      const { id } = await service.create(input, OPS);
      for (const status of [DispatchStatus.EnRoute, DispatchStatus.OnSite, DispatchStatus.Completed]) {
        expect(service.updateStatus(id, status, leader(2)).status).toBe(status);
      }
      expect(teams.findById(1)?.availability).toBe(TeamAvailability.Available);
    });

    it('A5a: rejects skipping a step with 409 and keeps the old status', async () => {
      const { id } = await service.create(input, OPS);
      expect(() => service.updateStatus(id, DispatchStatus.Completed, leader(2))).toThrowError(
        /cannot move to/,
      );
      const row = db.prepare('SELECT status FROM dispatches WHERE id = ?').get(id);
      expect(row).toEqual({ status: 'Dispatched' });
    });

    it('rejects a leader who does not own the assigned team (403)', async () => {
      const { id } = await service.create(input, OPS);
      expect(() => service.updateStatus(id, DispatchStatus.EnRoute, leader(3))).toThrowError(
        /Only the leader/,
      );
    });

    it('rejects everyone when the team has no leader user', async () => {
      const { id } = await service.create(input, OPS);
      db.prepare('UPDATE rescue_teams SET leader_user_id = NULL WHERE id = 1').run();
      expect(() => service.updateStatus(id, DispatchStatus.EnRoute, leader(2))).toThrowError(/Only the leader/);
    });

    it('404 for an unknown dispatch', () => {
      expect(() => service.updateStatus(999, DispatchStatus.EnRoute, leader(2))).toThrowError(/not found/);
    });
  });

  describe('cancel (A4a)', () => {
    it('cancels with a reason and frees the team', async () => {
      const { id } = await service.create(input, OPS);
      const { cancelled, replacement } = await service.cancel(id, 'Road flooded', OPS);
      expect(cancelled).toMatchObject({ status: 'Cancelled', cancelReason: 'Road flooded' });
      expect(replacement).toBeNull();
      expect(teams.findById(1)?.availability).toBe(TeamAvailability.Available);
    });

    it('replaces the team: new dispatch links back and its leader is notified', async () => {
      const { id } = await service.create(input, OPS);
      notifier.notifyTeamDispatched.mockClear();
      const { replacement } = await service.cancel(id, 'Team broke down', OPS, 2);
      expect(replacement).toMatchObject({ teamId: 2, replacesDispatchId: id, status: 'Dispatched' });
      expect(notifier.notifyTeamDispatched).toHaveBeenCalledWith(
        expect.objectContaining({ leaderUserId: 3, dispatchId: replacement?.id }),
      );
    });

    it('rolls back the cancel when the replacement team is busy', async () => {
      const { id } = await service.create(input, OPS);
      teams.setAvailability(2, TeamAvailability.Busy);
      await expect(service.cancel(id, 'Swap', OPS, 2)).rejects.toThrowError(/already on another/);
      expect(db.prepare('SELECT status FROM dispatches WHERE id = ?').get(id)).toEqual({ status: 'Dispatched' });
      expect(teams.findById(1)?.availability).toBe(TeamAvailability.Busy);
    });

    it('cannot cancel once the team is on site (409)', async () => {
      const { id } = await service.create(input, OPS);
      service.updateStatus(id, DispatchStatus.EnRoute, leader(2));
      service.updateStatus(id, DispatchStatus.OnSite, leader(2));
      await expect(service.cancel(id, 'Too late', OPS)).rejects.toThrowError(/cannot move to/);
    });
  });
});
