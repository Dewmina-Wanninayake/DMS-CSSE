import { RiskLevel } from '@dms/shared';

/**
 * Map layers (SVG attributes) cannot read CSS variables, so the hex values are repeated here.
 * They MUST equal `--color-risk-*` in `styles/tokens.css`; `risk-colors.test.ts` enforces it.
 */
export const RISK_COLORS: Record<RiskLevel, string> = {
  [RiskLevel.High]: '#dc2626',
  [RiskLevel.Medium]: '#d97706',
  [RiskLevel.Low]: '#16a34a',
};
