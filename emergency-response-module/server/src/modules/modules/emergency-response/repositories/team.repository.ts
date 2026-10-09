import type { Database } from 'better-sqlite3';
import { type RescueTeam, TeamAvailability } from '../domain/types';

interface TeamRow {
  id: number;
  name: string;
  agency: string;
  leader_name: string;
  leader_user_id: number | null;
  location: string;
  availability: TeamAvailability;
}

const toTeam = (r: TeamRow): RescueTeam => ({
  id: r.id,
  name: r.name,
  agency: r.agency,
  leaderName: r.leader_name,
  leaderUserId: r.leader_user_id,
  location: r.location,
  availability: r.availability,
});

export class TeamRepository {
  constructor(private readonly db: Database) {}

  list(): RescueTeam[] {
    return this.db
      .prepare<[], TeamRow>('SELECT * FROM rescue_teams ORDER BY name')
      .all()
      .map(toTeam);
  }

  findById(id: number): RescueTeam | undefined {
    const row = this.db.prepare<[number], TeamRow>('SELECT * FROM rescue_teams WHERE id = ?').get(id);
    return row ? toTeam(row) : undefined;
  }

  setAvailability(id: number, availability: TeamAvailability): void {
    this.db.prepare('UPDATE rescue_teams SET availability = ? WHERE id = ?').run(availability, id);
  }
}
