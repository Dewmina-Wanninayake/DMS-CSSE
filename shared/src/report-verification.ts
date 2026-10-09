/**
 * Contract of UC-DIST-02 (Verify Ground Hazard Report and Escalate Warning).
 * Shared by server and client so both validate against the same limits.
 */
import type {
  Channel,
  DeliveryStatus,
  HazardType,
  Language,
  Role,
  Severity,
  SyncStatus,
  WarningLevel,
} from './enums';
import type { WarningCriterion } from './policy-analytics';

/** Officer decision (critique DIST-02 #6: one information-needed state). */
export const VerificationDecision = {
  Verified: 'Verified',
  Rejected: 'Rejected',
  RequiresInformation: 'RequiresInformation',
} as const;
export type VerificationDecision = (typeof VerificationDecision)[keyof typeof VerificationDecision];

export const WarningStatus = {
  Draft: 'Draft',
  PendingApproval: 'PendingApproval',
  Issued: 'Issued',
  Corrected: 'Corrected',
  Withdrawn: 'Withdrawn',
} as const;
export type WarningStatus = (typeof WarningStatus)[keyof typeof WarningStatus];

export const ApprovalDecision = {
  Approved: 'Approved',
  Rejected: 'Rejected',
} as const;
export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const CorrectionAction = {
  Correct: 'Correct',
  Withdraw: 'Withdraw',
} as const;
export type CorrectionAction = (typeof CorrectionAction)[keyof typeof CorrectionAction];

export const VERIFICATION_LIMITS = {
  notesMin: 5,
  notesMax: 2000,
  reasonMin: 8,
  reasonMax: 2000,
  nearbyRadiusKm: 2,
  nearbyWindowHours: 2,
  audienceConfirmAt: 10_000,
} as const;

/** Warning and Emergency need a second approver (critique DIST-02 #7). */
export const LEVELS_REQUIRING_APPROVAL: readonly WarningLevel[] = ['Warning', 'Emergency'];

export const VerificationErrorCode = {
  InsufficientEvidence: 'INSUFFICIENT_EVIDENCE',
} as const;

export interface QueueReport {
  id: number;
  hazardType: HazardType;
  description: string;
  districtName: string;
  reportedAt: string;
  hasPhoto: boolean;
  locationSource: 'Gps' | 'Manual';
}

export interface QueueWarning {
  id: number;
  level: WarningLevel;
  hazardType: HazardType;
  reason: string;
  status: WarningStatus;
  estimatedAudience: number;
  createdAt: string;
}

export interface VerificationQueue {
  reports: QueueReport[];
  pendingApprovals: QueueWarning[];
}

export interface NearbyReport {
  id: number;
  hazardType: HazardType;
  districtName: string;
  reportedAt: string;
  distanceKm: number;
  status: string;
}

export interface SensorReading {
  stationName: string;
  observedAt: string;
  rainfallMm: number;
  riverLevelM: number;
}

export interface EvidenceAssessment {
  sufficient: boolean;
  hasGps: boolean;
  hasPhoto: boolean;
  corroborationCount: number;
  reasons: string[];
}

export interface ReportReview {
  id: number;
  hazardType: HazardType;
  description: string;
  severity: Severity | null;
  status: string;
  latitude: number;
  longitude: number;
  locationSource: 'Gps' | 'Manual';
  photoPath: string | null;
  districtId: number;
  districtName: string;
  reporterId: number;
  reporterName: string;
  reportedAt: string;
  duplicateOf: number | null;
  nearby: NearbyReport[];
  latestSensor: SensorReading | null;
  warningCriteria: WarningCriterion | null;
  evidence: EvidenceAssessment;
  decision: VerificationDecision | null;
  notes: string | null;
}

export interface DecisionRequest {
  decision: VerificationDecision;
  notes?: string;
  severity?: Severity;
  duplicateOf?: number | null;
}

export interface WarningPreviewRequest {
  reportId: number;
  level: WarningLevel;
  areaIds: number[];
  language: Language;
  channels: Channel[];
}

export interface WarningPreview {
  estimatedAudience: number;
  requiresAudienceConfirm: boolean;
  requiresApproval: boolean;
  districts: { id: number; name: string; population: number }[];
  warningCriteria: WarningCriterion | null;
  language: Language;
  channels: Channel[];
}

export interface CreateWarningRequest {
  reportId: number;
  level: WarningLevel;
  areaIds: number[];
  reason: string;
  language: Language;
  channels: Channel[];
  confirmedAudience?: boolean;
  clientId?: string;
  pendingSync?: boolean;
}

export interface WarningDto {
  id: number;
  reportId: number;
  hazardType: HazardType;
  level: WarningLevel;
  reason: string;
  language: Language;
  status: WarningStatus;
  syncStatus: SyncStatus;
  areaIds: number[];
  areaNames: string[];
  channels: Channel[];
  estimatedAudience: number;
  createdBy: number;
  issuedAt: string | null;
  createdAt: string;
}

export interface ApprovalRequest {
  decision: ApprovalDecision;
  notes?: string;
}

export interface CorrectionRequest {
  action: CorrectionAction;
  level?: WarningLevel;
  reason?: string;
  areaIds?: number[];
}

export interface DeliveryRow {
  id: number;
  channel: Channel;
  recipient: string;
  deliveryStatus: DeliveryStatus;
  retryCount: number;
  lastError: string | null;
  sentAt: string | null;
}

export interface WarningDelivery {
  warning: WarningDto;
  deliveries: DeliveryRow[];
}

export interface HazardTeamRule {
  hazardType: HazardType;
  role: Role;
}
