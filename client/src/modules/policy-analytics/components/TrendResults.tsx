import { FilePenLine } from 'lucide-react';
import { HAZARD_TYPE_LABELS, type TrendReport } from '@dms/shared';
import { formatDate, formatMonth, formatNumber } from '../../../shared/format/format';
import { BarChart } from '../../../shared/ui/BarChart';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { DistrictMap } from '../../../shared/ui/DistrictMap';
import { Alert } from '../../../shared/ui/feedback';
import { RISK_COLORS } from '../../../shared/ui/risk-colors';
import { RISK_LABEL, RISK_ORDER } from '../constants';
import { RiskBadge, RiskLegend } from './badges';

const DIRECTION_TEXT = { Rising: 'Rising', Falling: 'Falling', Stable: 'Stable' } as const;

interface TrendResultsProps {
  report: TrendReport;
  /** Analysts can start a policy from the report; the Director only reads it. */
  canFormulatePolicy: boolean;
}

/** Step 4 output: summary, sparsity warning (3a), charts, risk map and the per-district table. */
export function TrendResults({ report, canFormulatePolicy }: TrendResultsProps) {
  const { summary } = report;
  const ranked = [...report.districts].sort(
    (a, b) =>
      RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] ||
      b.verifiedCount - a.verifiedCount ||
      a.name.localeCompare(b.name),
  );
  const withActivity = ranked.filter(
    (d) => d.verifiedCount > 0 || d.historicalCount > 0 || d.riskLevel !== 'Low',
  );
  const change =
    summary.percentChange === null
      ? ''
      : ` (${summary.percentChange > 0 ? '+' : ''}${formatNumber(summary.percentChange)}%)`;

  return (
    <div className="stack" aria-label="Risk trend report">
      {report.sparse && (
        <Alert tone="warning" title="Limited analysis: not enough data">
          Only {summary.totalVerified + summary.totalHistorical} records match this region, hazard
          and period (at least {report.thresholds.minDataPoints} are needed). The figures below are
          indicative only; widen the period or region for a firmer result.
        </Alert>
      )}
      {!report.hydrometAvailable && (
        <Alert tone="info" title="Weather and river data unavailable">
          The meteorological and hydrology source could not be reached, so rainfall and river levels
          are not shown. Risk levels use verified reports only.
        </Alert>
      )}

      <div className="grid grid--tiles" role="group" aria-label="Summary">
        <div className="tile">
          <span className="tile__value">{summary.totalVerified}</span>
          <span>Verified reports</span>
        </div>
        <div className="tile">
          <span className="tile__value">{summary.highRiskCount}</span>
          <span>High-risk districts</span>
        </div>
        <div className="tile">
          <span className="tile__value">{DIRECTION_TEXT[summary.trendDirection]}</span>
          <span>Trend vs previous period{change}</span>
        </div>
        <div className="tile">
          <span className="tile__value">{summary.totalHistorical}</span>
          <span>Historical records</span>
        </div>
      </div>

      <p className="muted">
        {HAZARD_TYPE_LABELS[report.hazardType]} · {formatDate(report.periodStart)} to{' '}
        {formatDate(report.periodEnd)} · High risk means more than {report.thresholds.riskThreshold}{' '}
        verified reports; medium from{' '}
        {formatNumber(report.thresholds.riskThreshold * report.thresholds.mediumRatio)}.
      </p>

      <div className="grid grid--two">
        <Card title="Reports per month">
          <BarChart
            title="Verified and historical reports per month"
            data={report.monthly.map((m) => ({
              label: formatMonth(m.month),
              value: m.verified,
              secondary: m.historical,
            }))}
            primaryName="verified"
            secondaryName="historical"
          />
          <p className="caption muted">
            Dark bars: verified reports. Grey bars: historical records.
          </p>
        </Card>
        <Card title="Risk map">
          <DistrictMap
            label="Map of district risk levels"
            height="16rem"
            markers={withActivity.map((d) => ({
              id: d.districtId,
              latitude: d.latitude,
              longitude: d.longitude,
              color: RISK_COLORS[d.riskLevel],
              label: `${d.name}: ${d.verifiedCount} verified, ${RISK_LABEL[d.riskLevel].toLowerCase()}`,
            }))}
          />
          <RiskLegend />
        </Card>
      </div>

      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Risk by district</caption>
          <thead>
            <tr>
              <th scope="col">District</th>
              <th scope="col">Province</th>
              <th scope="col" className="num">
                Verified
              </th>
              <th scope="col" className="num">
                Historical
              </th>
              <th scope="col" className="num">
                Rainfall (mm)
              </th>
              <th scope="col" className="num">
                Max river level (m)
              </th>
              <th scope="col">Risk</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((d) => (
              <tr key={d.districtId}>
                <th scope="row">{d.name}</th>
                <td>{d.province}</td>
                <td className="num">{d.verifiedCount}</td>
                <td className="num">{d.historicalCount}</td>
                <td className="num">{d.rainfallMm === null ? '–' : formatNumber(d.rainfallMm)}</td>
                <td className="num">
                  {d.maxRiverLevelM === null ? '–' : formatNumber(d.maxRiverLevelM)}
                </td>
                <td>
                  <RiskBadge level={d.riskLevel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canFormulatePolicy && (
        <div className="row row--end">
          <ButtonLink to={`/policies/new?trendReportId=${report.id}`}>
            <FilePenLine size={18} aria-hidden="true" />
            Formulate policy
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
