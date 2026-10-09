import type { PolicyStatus, RiskLevel } from '@dms/shared';
import { RISK_COLORS } from '../../../shared/ui/risk-colors';
import { StatusBadge } from '../../../shared/ui/feedback';
import {
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  RISK_LABEL,
  RISK_TONE,
  RISK_ZONE,
} from '../lib/constants';

export function PolicyStatusBadge({ status }: { status: PolicyStatus }) {
  return <StatusBadge tone={POLICY_STATUS_TONE[status]}>{POLICY_STATUS_LABEL[status]}</StatusBadge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <StatusBadge tone={RISK_TONE[level]}>{RISK_LABEL[level]}</StatusBadge>;
}

const LEVELS: RiskLevel[] = ['High', 'Medium', 'Low'];

/** Colour key for the risk map; text labels are always shown next to the swatch. */
export function RiskLegend() {
  return (
    <ul className="legend list legend-row" aria-label="Map legend">
      {LEVELS.map((level) => (
        <li key={level} className="legend__item">
          <span
            className="legend__swatch"
            style={{ background: RISK_COLORS[level] }}
            aria-hidden="true"
          />
          {RISK_LABEL[level]} ({RISK_ZONE[level]})
        </li>
      ))}
    </ul>
  );
}
