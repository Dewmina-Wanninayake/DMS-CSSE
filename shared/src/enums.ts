/**
 * Domain enumerations. Names and values follow Table 13 of the Group 02 critique exactly.
 * Declared as const objects + union types so they work in zod, SQL columns and JSON alike.
 */

export const Role = {
  Citizen: 'Citizen',
  Volunteer: 'Volunteer',
  DutyOfficer: 'DutyOfficer',
  SecondApprover: 'SecondApprover',
  DisasterAnalyst: 'DisasterAnalyst',
  PolicyDirector: 'PolicyDirector',
  JointOpsLead: 'JointOpsLead',
  RescueTeamLeader: 'RescueTeamLeader',
  ShelterCoordinator: 'ShelterCoordinator',
  RegionalAdmin: 'RegionalAdmin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const ROLES = Object.values(Role);

/** Roles that belong to DMC staff (policies are internal-only, critique §11.4). */
export const DMC_STAFF_ROLES: readonly Role[] = [
  Role.DutyOfficer,
  Role.SecondApprover,
  Role.DisasterAnalyst,
  Role.PolicyDirector,
  Role.JointOpsLead,
  Role.RescueTeamLeader,
  Role.ShelterCoordinator,
  Role.RegionalAdmin,
];

export const HazardType = {
  Flood: 'Flood',
  Landslide: 'Landslide',
  BlockedRoad: 'BlockedRoad',
  Other: 'Other',
} as const;
export type HazardType = (typeof HazardType)[keyof typeof HazardType];
export const HAZARD_TYPES = Object.values(HazardType);

export const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  Flood: 'Rising river / flood',
  Landslide: 'Landslide',
  BlockedRoad: 'Blocked road',
  Other: 'Other hazard',
};

export const ReportStatus = {
  Pending: 'Pending',
  Verified: 'Verified',
  Rejected: 'Rejected',
  NeedsInformation: 'NeedsInformation',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const Severity = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Critical: 'Critical',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SyncStatus = { Synced: 'Synced', PendingSync: 'PendingSync' } as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const WarningLevel = {
  Advisory: 'Advisory',
  Watch: 'Watch',
  Warning: 'Warning',
  Emergency: 'Emergency',
  AllClear: 'AllClear',
} as const;
export type WarningLevel = (typeof WarningLevel)[keyof typeof WarningLevel];

export const Channel = { Push: 'Push', SMS: 'SMS', AudibleAlert: 'AudibleAlert' } as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const DeliveryStatus = { Pending: 'Pending', Sent: 'Sent', Failed: 'Failed' } as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const TeamStatus = {
  Available: 'Available',
  Dispatched: 'Dispatched',
  EnRoute: 'EnRoute',
  OnSite: 'OnSite',
  Completed: 'Completed',
} as const;
export type TeamStatus = (typeof TeamStatus)[keyof typeof TeamStatus];

export const ShelterStatus = {
  Available: 'Available',
  PartiallyOccupied: 'PartiallyOccupied',
  NearCapacity: 'NearCapacity',
  Full: 'Full',
  Closed: 'Closed',
} as const;
export type ShelterStatus = (typeof ShelterStatus)[keyof typeof ShelterStatus];

export const Priority = { Low: 'Low', Normal: 'Normal', High: 'High', Urgent: 'Urgent' } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const Unit = {
  Kilogram: 'Kilogram',
  Litre: 'Litre',
  Unit: 'Unit',
  Pallet: 'Pallet',
} as const;
export type Unit = (typeof Unit)[keyof typeof Unit];

export const DestinationType = { Shelter: 'Shelter', Area: 'Area', Team: 'Team' } as const;
export type DestinationType = (typeof DestinationType)[keyof typeof DestinationType];

export const PolicyStatus = {
  Draft: 'Draft',
  PendingApproval: 'PendingApproval',
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const;
export type PolicyStatus = (typeof PolicyStatus)[keyof typeof PolicyStatus];

export const Language = { Sinhala: 'Sinhala', Tamil: 'Tamil', English: 'English' } as const;
export type Language = (typeof Language)[keyof typeof Language];
