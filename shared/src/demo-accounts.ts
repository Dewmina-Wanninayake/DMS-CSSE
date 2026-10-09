import { Role } from './enums';

/** A seeded sign-in for the markers and for demos. Every account uses `SEED_DEFAULT_PASSWORD`. */
export interface DemoAccount {
  email: string;
  fullName: string;
  role: Role;
  /** The use case this account exercises, shown on the sign-in screen. */
  useCase: 'UC-DIST-02' | 'UC-DA-001' | 'UC-CV-003' | 'UC-JOINT-001';
  /** What the account can do, in one line. */
  purpose: string;
}

/**
 * Single source of truth for the seeded users: the server seeds them from this list and the sign-in
 * screen shows it, so the two can never drift apart. Order is the order shown to the marker, grouped
 * by use case. The second account of a role exists where the scenario needs two people (a roster of
 * Second Approvers for extension 10b; one leader per rescue team).
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    email: 'citizen@dms.lk',
    fullName: 'Tharindu Rajapaksa',
    role: Role.Citizen,
    useCase: 'UC-CV-003',
    purpose: 'Report a hazard (5-step wizard), see every report state in My reports',
  },
  {
    email: 'citizen2@dms.lk',
    fullName: 'Kamala Perera',
    role: Role.Citizen,
    useCase: 'UC-CV-003',
    purpose: 'Second reporter: her report is linked as a duplicate of the first',
  },
  {
    email: 'volunteer@dms.lk',
    fullName: 'Madhavi Dissanayake',
    role: Role.Volunteer,
    useCase: 'UC-CV-003',
    purpose: 'Certified for Kegalle, Ratnapura and Colombo: adds field updates',
  },
  {
    email: 'officer@dms.lk',
    fullName: 'Kasun Fernando',
    role: Role.DutyOfficer,
    useCase: 'UC-DIST-02',
    purpose: 'Verification queue, decisions, warnings, delivery status',
  },
  {
    email: 'approver@dms.lk',
    fullName: 'Ishara Jayasuriya',
    role: Role.SecondApprover,
    useCase: 'UC-DIST-02',
    purpose: 'Approves or rejects Warning and Emergency level warnings (first on the roster)',
  },
  {
    email: 'approver2@dms.lk',
    fullName: 'Lakmal Gunawardena',
    role: Role.SecondApprover,
    useCase: 'UC-DIST-02',
    purpose: 'Next approver on the roster when the first does not respond (10b)',
  },
  {
    email: 'analyst@dms.lk',
    fullName: 'Dulaj Serasinghe',
    role: Role.DisasterAnalyst,
    useCase: 'UC-DA-001',
    purpose: 'Trend analysis, risk map, policy wizard with simulation',
  },
  {
    email: 'director@dms.lk',
    fullName: 'Nimali Perera',
    role: Role.PolicyDirector,
    useCase: 'UC-DA-001',
    purpose: 'Approves or rejects submitted policies',
  },
  {
    email: 'joint@dms.lk',
    fullName: 'Ruwan Silva',
    role: Role.JointOpsLead,
    useCase: 'UC-JOINT-001',
    purpose: 'Dashboard, dispatch teams, allocate resources, reverse, request resupply',
  },
  {
    email: 'teamlead@dms.lk',
    fullName: 'Chamara Bandara',
    role: Role.RescueTeamLeader,
    useCase: 'UC-JOINT-001',
    purpose: 'Leader of Alpha Rescue Team: moves a dispatch through its statuses',
  },
  {
    email: 'teamlead2@dms.lk',
    fullName: 'Nuwan Herath',
    role: Role.RescueTeamLeader,
    useCase: 'UC-JOINT-001',
    purpose: 'Leader of Bravo Rescue Team',
  },
  {
    email: 'teamlead3@dms.lk',
    fullName: 'Dilini Ratnayake',
    role: Role.RescueTeamLeader,
    useCase: 'UC-JOINT-001',
    purpose: 'Leader of Charlie Medical Team',
  },
  {
    email: 'shelter@dms.lk',
    fullName: 'Anusha Wickramasinghe',
    role: Role.ShelterCoordinator,
    useCase: 'UC-JOINT-001',
    purpose: 'Receives shelter redirect requests (UC-SHL-001 itself is out of scope)',
  },
  {
    email: 'regional@dms.lk',
    fullName: 'Sampath Kumara',
    role: Role.RegionalAdmin,
    useCase: 'UC-DA-001',
    purpose: 'Notified when a policy is published; has no screens of its own',
  },
];

/** Password given to every seeded account when `SEED_DEFAULT_PASSWORD` is not changed. */
export const DEFAULT_DEMO_PASSWORD = 'ChangeMe-Dev-2026';
