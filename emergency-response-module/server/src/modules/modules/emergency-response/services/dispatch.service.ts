import type { Database } from 'better-sqlite3';
import { DispatchStatus, TeamStatusMachine } from '../domain/team-status';
import {
  type Actor,
  type Clock,
  type Dispatch,
  type Priority,
  type RescueTeam,
  TeamAvailability,
} from '../domain/types';
import {
  EntityNotFoundError,
  ForbiddenActionError,
  TeamUnavailableError,
} from '../errors';
import type { DispatchRepository } from '../repositories/dispatch.repository';
import type { TeamRepository } from '../repositories/team.repository';
import type { DispatchInput } from '../schemas/response.schemas';
import type { ResponseNotifier } from './response-notifier';

export interface DispatchSummary {
  location: string;
  priority: Priority;
  instructions: string | null;
  team: Pick<RescueTeam, 'id' | 'name' | 'agency' | 'leaderName'>;
}

/** Sub-flow A: dispatch (summary → confirm), team status updates, cancel/replace. */
export class DispatchService {
  constructor(
    private readonly db: Database,
    private readonly teams: TeamRepository,
    private readonly dispatches: DispatchRepository,
    private readonly notifier: ResponseNotifier,
    private readonly machine: TeamStatusMachine = new TeamStatusMachine(),
    private readonly clock: Clock = () => new Date(),
  ) {}

  /** JOINT #3 / A1: show the summary the Joint Ops Lead confirms. Writes nothing. */
  preview(input: DispatchInput): DispatchSummary {
    const team = this.requireAvailableTeam(input.teamId);
    return {
      location: input.location,
      priority: input.priority,
      instructions: input.instructions ?? null,
      team: { id: team.id, name: team.name, agency: team.agency, leaderName: team.leaderName },
    };
  }

  /** Confirm: create the dispatch as `Dispatched`, mark the team busy, notify the leader. */
  async create(input: DispatchInput, actor: Actor): Promise<Dispatch> {
    const { dispatch, team } = this.db
      .transaction(() => this.insertDispatch(input, actor.id, null))
      .immediate();
    await this.notifyLeader(dispatch, team);
    return dispatch;
  }

  /** A5: only the leader of the assigned team moves it forward; illegal moves → 409 (A5a). */
  updateStatus(dispatchId: number, to: DispatchStatus, actor: Actor): Dispatch {
    return this.db
      .transaction(() => {
        const dispatch = this.requireDispatch(dispatchId);
        const team = this.requireTeam(dispatch.teamId);
        if (team.leaderUserId === null || team.leaderUserId !== actor.id) {
          throw new ForbiddenActionError('Only the leader of the assigned team can update this status.');
        }
        this.machine.assertTransition(dispatch.status, to);
        this.dispatches.updateStatus(dispatchId, to, this.now(), null);
        if (to === DispatchStatus.Completed) {
          this.teams.setAvailability(team.id, TeamAvailability.Available);
        }
        return this.requireDispatch(dispatchId);
      })
      .immediate();
  }

  /**
   * A4a: cancel with a reason; optionally replace the team in the same transaction
   * (the new dispatch links back through `replacesDispatchId`).
   */
  async cancel(
    dispatchId: number,
    reason: string,
    actor: Actor,
    replacementTeamId?: number,
  ): Promise<{ cancelled: Dispatch; replacement: Dispatch | null }> {
    const result = this.db
      .transaction(() => {
        const current = this.requireDispatch(dispatchId);
        this.machine.assertTransition(current.status, DispatchStatus.Cancelled);
        this.dispatches.updateStatus(dispatchId, DispatchStatus.Cancelled, this.now(), reason);
        this.teams.setAvailability(current.teamId, TeamAvailability.Available);

        const replacement =
          replacementTeamId === undefined
            ? null
            : this.insertDispatch(
                {
                  location: current.location,
                  priority: current.priority,
                  teamId: replacementTeamId,
                  instructions: current.instructions ?? undefined,
                },
                actor.id,
                dispatchId,
              );
        return { cancelled: this.requireDispatch(dispatchId), replacement };
      })
      .immediate();

    if (result.replacement) {
      await this.notifyLeader(result.replacement.dispatch, result.replacement.team);
    }
    return { cancelled: result.cancelled, replacement: result.replacement?.dispatch ?? null };
  }

  private insertDispatch(input: DispatchInput, createdBy: number, replacesDispatchId: number | null) {
    const team = this.requireAvailableTeam(input.teamId);
    const id = this.dispatches.insert({
      location: input.location,
      priority: input.priority,
      teamId: team.id,
      instructions: input.instructions ?? null,
      replacesDispatchId,
      createdBy,
      createdAt: this.now(),
    });
    this.teams.setAvailability(team.id, TeamAvailability.Busy);
    return { dispatch: this.requireDispatch(id), team };
  }

  private async notifyLeader(dispatch: Dispatch, team: RescueTeam): Promise<void> {
    if (team.leaderUserId === null) return;
    await this.notifier.notifyTeamDispatched({
      leaderUserId: team.leaderUserId,
      dispatchId: dispatch.id,
      location: dispatch.location,
      priority: dispatch.priority,
    });
  }

  private requireAvailableTeam(teamId: number): RescueTeam {
    const team = this.requireTeam(teamId);
    if (team.availability !== TeamAvailability.Available) throw new TeamUnavailableError(team.name);
    return team;
  }

  private requireTeam(id: number): RescueTeam {
    const team = this.teams.findById(id);
    if (!team) throw new EntityNotFoundError('Rescue team', id);
    return team;
  }

  private requireDispatch(id: number): Dispatch {
    const dispatch = this.dispatches.findById(id);
    if (!dispatch) throw new EntityNotFoundError('Dispatch', id);
    return dispatch;
  }

  private now(): string {
    return this.clock().toISOString();
  }
}
