import { HazardType, Role, type Role as RoleType } from '@dms/shared';
import { hashPassword } from '../../core/auth/password';
import type { Db } from '../../core/db/connection';

/**
 * Development data only (`npm run db:seed`). It stands in for what the other modules will
 * produce at runtime: users per role, hazard reports already Verified by UC-DIST-02, hydromet
 * observations and archival incidents. It is idempotent: a database that already has users is left alone.
 */

const DAY_MS = 86_400_000;

const USERS: { email: string; fullName: string; role: RoleType }[] = [
  { email: 'analyst@dms.lk', fullName: 'Dulaj Serasinghe', role: Role.DisasterAnalyst },
  { email: 'director@dms.lk', fullName: 'Nimali Perera', role: Role.PolicyDirector },
  { email: 'officer@dms.lk', fullName: 'Kasun Fernando', role: Role.DutyOfficer },
  { email: 'approver@dms.lk', fullName: 'Ishara Jayasuriya', role: Role.SecondApprover },
  { email: 'joint@dms.lk', fullName: 'Ruwan Silva', role: Role.JointOpsLead },
  { email: 'teamlead@dms.lk', fullName: 'Chamara Bandara', role: Role.RescueTeamLeader },
  { email: 'shelter@dms.lk', fullName: 'Anusha Wickramasinghe', role: Role.ShelterCoordinator },
  { email: 'regional@dms.lk', fullName: 'Sampath Kumara', role: Role.RegionalAdmin },
  { email: 'citizen@dms.lk', fullName: 'Tharindu Rajapaksa', role: Role.Citizen },
  { email: 'volunteer@dms.lk', fullName: 'Madhavi Dissanayake', role: Role.Volunteer },
];

/** Verified reports per hazard, by district code, so the demo shows High, Medium and Low districts. */
const VERIFIED_COUNTS: Record<string, Record<string, number>> = {
  [HazardType.Flood]: { KEG: 8, RAT: 7, GPH: 6, KLT: 4, CMB: 3, KDY: 3, GAL: 2, MTR: 1 },
  [HazardType.Landslide]: { NWE: 6, BDL: 5, KEG: 4, RAT: 3, KDY: 2 },
};

/** Archival incidents per year, by district code (previous years). */
const HISTORICAL: Record<string, Record<string, number>> = {
  [HazardType.Flood]: { KEG: 3, RAT: 4, GPH: 2, KLT: 3, CMB: 2 },
  [HazardType.Landslide]: { NWE: 3, BDL: 2, KEG: 2 },
};

const DESCRIPTIONS: Record<string, string[]> = {
  [HazardType.Flood]: [
    'River level rising over the low bridge',
    'Road flooded near the paddy fields',
    'Water entering houses along the canal bank',
  ],
  [HazardType.Landslide]: [
    'Crack across the hillside road',
    'Soil slip blocking the estate road',
    'Tilting retaining wall above houses',
  ],
};

const SEED_MONTHS = 5;
const OBSERVATION_STEP_DAYS = 10;

export function seedDevData(db: Db, password: string, now: Date = new Date()): boolean {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (existing.n > 0) return false;

  const districtId = new Map(
    (db.prepare('SELECT id, code FROM districts').all() as { id: number; code: string }[]).map(
      (d) => [d.code, d.id],
    ),
  );
  const insertUser = db.prepare(
    'INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, ?, ?)',
  );
  const insertReport = db.prepare(
    `INSERT INTO hazard_reports
       (reporter_id, hazard_type, description, severity, status, latitude, longitude, district_id, reported_at, verified_at)
     VALUES (?, ?, ?, 'Medium', ?, ?, ?, ?, ?, ?)`,
  );
  const insertIncident = db.prepare(
    'INSERT INTO historical_incidents (district_id, hazard_type, occurred_at, summary) VALUES (?, ?, ?, ?)',
  );
  const insertObservation = db.prepare(
    `INSERT INTO hydromet_observations (district_id, station_name, observed_at, rainfall_mm, river_level_m)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const coordinates = db.prepare('SELECT id, latitude, longitude, name FROM districts').all() as {
    id: number;
    latitude: number;
    longitude: number;
    name: string;
  }[];
  const centre = new Map(coordinates.map((d) => [d.id, d]));

  db.transaction(() => {
    const hash = hashPassword(password);
    for (const u of USERS) insertUser.run(u.email, u.fullName, u.role, hash);
    const reporterId = (
      db.prepare('SELECT id FROM users WHERE email = ?').get('citizen@dms.lk') as { id: number }
    ).id;

    for (const [hazard, byDistrict] of Object.entries(VERIFIED_COUNTS)) {
      for (const [code, count] of Object.entries(byDistrict)) {
        const id = districtId.get(code) as number;
        const where = centre.get(id) as { latitude: number; longitude: number };
        for (let i = 0; i < count; i += 1) {
          // Spread reports over the last SEED_MONTHS months, newest first.
          const daysAgo = 2 + (Math.floor((i * SEED_MONTHS * 30) / count) % (SEED_MONTHS * 30 - 2));
          const reportedAt = new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
          const descriptions = DESCRIPTIONS[hazard] as string[];
          insertReport.run(
            reporterId,
            hazard,
            descriptions[i % descriptions.length],
            'Verified',
            where.latitude,
            where.longitude,
            id,
            reportedAt,
            new Date(Date.parse(reportedAt) + 3_600_000).toISOString(),
          );
        }
      }
    }
    // A pending and a rejected report: they must NOT be counted by the analytics.
    const kegalle = districtId.get('KEG') as number;
    const k = centre.get(kegalle) as { latitude: number; longitude: number };
    for (const status of ['Pending', 'Rejected']) {
      insertReport.run(
        reporterId,
        HazardType.Flood,
        `${status} example`,
        status,
        k.latitude,
        k.longitude,
        kegalle,
        new Date(now.getTime() - DAY_MS).toISOString(),
        null,
      );
    }

    for (const [hazard, byDistrict] of Object.entries(HISTORICAL)) {
      for (const [code, perYear] of Object.entries(byDistrict)) {
        for (const yearsAgo of [1, 2, 3]) {
          for (let i = 0; i < perYear; i += 1) {
            const date = new Date(now);
            date.setUTCFullYear(date.getUTCFullYear() - yearsAgo);
            date.setUTCMonth((i * 3 + yearsAgo) % 12);
            insertIncident.run(
              districtId.get(code),
              hazard,
              date.toISOString(),
              `Archived ${hazard.toLowerCase()} incident`,
            );
          }
        }
      }
    }

    for (const code of ['KEG', 'RAT', 'GPH', 'KLT', 'NWE', 'BDL']) {
      const id = districtId.get(code) as number;
      const name = (centre.get(id) as { name: string }).name;
      for (let days = 0; days < SEED_MONTHS * 30; days += OBSERVATION_STEP_DAYS) {
        const observedAt = new Date(now.getTime() - days * DAY_MS).toISOString();
        insertObservation.run(
          id,
          `${name} gauge`,
          observedAt,
          40 + ((days * 7) % 90),
          1.2 + ((days * 3) % 25) / 10,
        );
      }
    }
  })();
  return true;
}
