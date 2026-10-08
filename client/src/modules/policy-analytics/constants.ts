import { PolicyStatus, RiskLevel, type DeliveryStatus } from '@dms/shared';
import type { Tone } from '../../shared/ui/feedback';

/** Text and tone for each policy status (shown as a badge — never colour alone). */
export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  [PolicyStatus.Draft]: 'Draft',
  [PolicyStatus.PendingApproval]: 'Pending approval',
  [PolicyStatus.Approved]: 'Approved',
  [PolicyStatus.Rejected]: 'Rejected',
};

export const POLICY_STATUS_TONE: Record<PolicyStatus, Tone> = {
  [PolicyStatus.Draft]: 'neutral',
  [PolicyStatus.PendingApproval]: 'warning',
  [PolicyStatus.Approved]: 'success',
  [PolicyStatus.Rejected]: 'danger',
};

/** Hi-fi map overlays are "Risk zone A/B/C"; the rule names them High/Medium/Low (critique DA #4). */
export const RISK_LABEL: Record<RiskLevel, string> = {
  [RiskLevel.High]: 'High risk',
  [RiskLevel.Medium]: 'Medium risk',
  [RiskLevel.Low]: 'Low risk',
};

export const RISK_ZONE: Record<RiskLevel, string> = {
  [RiskLevel.High]: 'Zone A',
  [RiskLevel.Medium]: 'Zone B',
  [RiskLevel.Low]: 'Zone C',
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  [RiskLevel.High]: 'danger',
  [RiskLevel.Medium]: 'warning',
  [RiskLevel.Low]: 'success',
};

/** Sort order for tables: highest risk first. */
export const RISK_ORDER: Record<RiskLevel, number> = {
  [RiskLevel.High]: 0,
  [RiskLevel.Medium]: 1,
  [RiskLevel.Low]: 2,
};

export const DELIVERY_TONE: Record<DeliveryStatus, Tone> = {
  Sent: 'success',
  Pending: 'info',
  Failed: 'danger',
};

/** Number of days the trend form looks back by default. */
export const DEFAULT_PERIOD_DAYS = 90;

export const POLICY_STEP_TITLES = [
  'Policy detail',
  'Measures',
  'Simulation',
  'Review and submit',
] as const;

export const SIMULATION_DEFAULTS = {
  intensity: 5,
  teamsDeployed: 10,
  sheltersActivated: 10,
} as const;
