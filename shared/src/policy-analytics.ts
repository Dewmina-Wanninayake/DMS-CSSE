/**
 * Contract of the UC-DA-001 module (Analyze Disaster Trends and Formulate Mitigation Policies),
 * shared by server and client so both validate against the same limits.
 */
import type { DeliveryStatus, HazardType, PolicyStatus, Role } from './enums';

export const RiskLevel = { High: 'High', Medium: 'Medium', Low: 'Low' } as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export type TrendDirection = 'Rising' | 'Falling' | 'Stable';

/** Hazard types the simulation model has a profile for (extension: others return 422). */
export const SIMULATION_HAZARD_TYPES: readonly HazardType[] = ['Flood', 'Landslide'];

export const POLICY_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMax: 2000,
  sectionMax: 5000,
  commentsMin: 5,
  commentsMax: 1000,
  maxPeriodYears: 5,
  intensityMin: 1,
  intensityMax: 10,
  latestReportsMax: 20,
  latestReportsDefault: 5,
} as const;

/** Number of wizard steps in the policy flow (Detail, Measures, Simulation, Review). */
export const POLICY_WIZARD_STEPS = 4;

export const PolicyErrorCode = {
  InsufficientData: 'INSUFFICIENT_DATA',
  RegulatoryConflict: 'REGULATORY_CONFLICT',
  UnsupportedHazard: 'UNSUPPORTED_HAZARD',
  NoAtRiskDistricts: 'NO_AT_RISK_DISTRICTS',
} as const;

export interface DistrictRef {
  id: number;
  code: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
}

export interface TrendReportRequest {
  hazardType: HazardType;
  /** District ids, or `'all'` for every district. */
  districtIds: number[] | 'all';
  periodStart: string;
  periodEnd: string;
}

export interface RiskThresholds {
  riskThreshold: number;
  mediumRatio: number;
  minDataPoints: number;
}

export interface TrendDistrictResult {
  districtId: number;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  verifiedCount: number;
  historicalCount: number;
  riskLevel: RiskLevel;
  rainfallMm: number | null;
  maxRiverLevelM: number | null;
}

export interface TrendReport {
  id: number;
  hazardType: HazardType;
  periodStart: string;
  periodEnd: string;
  thresholds: RiskThresholds;
  sparse: boolean;
  hydrometAvailable: boolean;
  summary: {
    totalVerified: number;
    totalHistorical: number;
    highRiskCount: number;
    trendDirection: TrendDirection;
    percentChange: number | null;
  };
  districts: TrendDistrictResult[];
  monthly: { month: string; verified: number; historical: number }[];
  createdAt: string;
}

export interface PolicyContentInput {
  title: string;
  description: string;
  mitigationStrategies: string;
  landUseGuidelines: string;
  resourceRules: string;
  /** Optional warning criterion published with the policy (critique DA #8). */
  warningRiskThreshold: number | null;
  /** The "Date" field of the Policy Update screen; the Director's approval defaults to it. */
  proposedEffectiveDate: string | null;
}

export interface PolicyDraftInput extends PolicyContentInput {
  trendReportId: number;
  /** Generated on the device so offline drafts can be synced idempotently (extension 9a). */
  clientId?: string;
}

export interface PolicyDto extends PolicyContentInput {
  id: number;
  policyKey: string;
  version: number;
  status: PolicyStatus;
  hazardType: HazardType;
  trendReportId: number;
  districtIds: number[];
  regionLabel: string;
  authorId: number;
  authorName: string;
  effectiveDate: string | null;
  supersededBy: number | null;
  review: PolicyReviewDto | null;
  simulationReference: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface PolicyReviewDto {
  decision: 'Approved' | 'Rejected';
  comments: string;
  reviewerName: string;
  decidedAt: string;
}

export interface ReviewRequest {
  decision: 'Approved' | 'Rejected';
  comments: string;
  effectiveDate?: string;
}

export interface SimulationRequest {
  intensity: number;
  teamsDeployed: number;
  sheltersActivated: number;
}

export interface SimulationDistrictResult {
  districtId: number;
  name: string;
  riskLevel: RiskLevel;
  latitude: number;
  longitude: number;
  affectedAreaKm2: number;
  exposedPopulation: number;
  evacuationHours: number;
  radiusKm: number;
}

export interface SimulationResult {
  id: number;
  policyId: number;
  reference: string;
  status: 'Success';
  hazardType: HazardType;
  input: SimulationRequest;
  totals: {
    exposedPopulation: number;
    affectedAreaKm2: number;
    evacuationHours: number;
    shelterCoverage: number;
    waterLitres: number;
    foodKg: number;
    medicineKits: number;
  };
  districts: SimulationDistrictResult[];
  createdAt: string;
}

export interface RegulatoryConflict {
  ruleCode: string;
  field: 'description' | 'mitigationStrategies' | 'landUseGuidelines' | 'resourceRules';
  clause: string;
  message: string;
}

export interface PolicyNotificationDto {
  id: number;
  recipientName: string;
  recipientRole: Role;
  subject: string;
  deliveryStatus: DeliveryStatus;
  retryCount: number;
}

export interface WarningCriterion {
  hazardType: HazardType;
  riskThreshold: number;
  mediumRatio: number;
  minDataPoints: number;
  sourcePolicyKey: string | null;
}

export interface LatestVerifiedReport {
  id: number;
  hazardType: HazardType;
  description: string;
  districtName: string;
  verifiedAt: string;
}

export type SyncOutcome = 'Created' | 'Existing' | 'Conflict';

export interface SyncDraftResult {
  clientId: string;
  outcome: SyncOutcome;
  policyId: number | null;
  message?: string;
}

export interface PolicySettingDto extends RiskThresholds {
  hazardType: HazardType;
  sourcePolicyId: number | null;
  sourcePolicyKey: string | null;
}

/** Form options for the trend request (`GET /analytics/filters`). */
export interface AnalyticsFilters {
  districts: DistrictRef[];
  hazardTypes: HazardType[];
  thresholds: PolicySettingDto[];
}
