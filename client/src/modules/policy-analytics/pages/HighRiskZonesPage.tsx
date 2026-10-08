import { useMemo, useState } from 'react';
import { HAZARD_TYPE_LABELS, RiskLevel } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { formatDate } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { ButtonLink } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { DistrictMap } from '../../../shared/ui/DistrictMap';
import { EmptyState, ErrorState, LoadingState } from '../../../shared/ui/feedback';
import { Checkbox, Select } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { RISK_COLORS } from '../../../shared/ui/risk-colors';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { RISK_LABEL, RISK_ZONE } from '../constants';

const LEVELS: RiskLevel[] = [RiskLevel.High, RiskLevel.Medium, RiskLevel.Low];

/** Hi-fi `map-view-high-risk-zones`: Sri Lankan map with risk-zone overlay toggles. */
export function HighRiskZonesPage() {
  const reports = useAsync(() => policyAnalyticsApi.listTrendReports(), []);
  const [selectedId, setSelectedId] = useState<number>();
  const [visible, setVisible] = useState<Record<RiskLevel, boolean>>({
    High: true,
    Medium: false,
    Low: false,
  });

  const report = reports.data?.find((r) => r.id === selectedId) ?? reports.data?.[0];
  const markers = useMemo(
    () =>
      (report?.districts ?? [])
        .filter((d) => visible[d.riskLevel])
        .map((d) => ({
          id: d.districtId,
          latitude: d.latitude,
          longitude: d.longitude,
          color: RISK_COLORS[d.riskLevel],
          label: `${d.name}: ${d.verifiedCount} verified reports (${RISK_LABEL[d.riskLevel].toLowerCase()})`,
        })),
    [report, visible],
  );

  return (
    <>
      <PageHeader
        title="High-risk zones"
        subtitle="Risk by district from verified reports"
        backTo="/analytics"
      />
      <div className="shell__content stack">
        {reports.loading && <LoadingState label="Loading risk reports…" />}
        {reports.error && (
          <ErrorState message={errorMessage(reports.error)} onRetry={reports.reload} />
        )}
        {reports.data?.length === 0 && (
          <EmptyState
            title="No risk report yet"
            description="Generate a trend report to see which districts are above the risk threshold."
            action={<ButtonLink to="/analytics/trends">Analyse trends</ButtonLink>}
          />
        )}
        {report && reports.data && (
          <>
            <Card title="Map options">
              <div className="stack">
                <Select
                  label="Report"
                  value={report.id}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                >
                  {reports.data.map((r) => (
                    <option key={r.id} value={r.id}>
                      {HAZARD_TYPE_LABELS[r.hazardType]} · {formatDate(r.periodStart)} to{' '}
                      {formatDate(r.periodEnd)}
                    </option>
                  ))}
                </Select>
                <fieldset className="fieldset">
                  <legend>Overlays</legend>
                  {LEVELS.map((level) => (
                    <Checkbox
                      key={level}
                      label={`${RISK_ZONE[level]} – ${RISK_LABEL[level].toLowerCase()}`}
                      checked={visible[level]}
                      onChange={(e) =>
                        setVisible((current) => ({ ...current, [level]: e.target.checked }))
                      }
                    />
                  ))}
                </fieldset>
              </div>
            </Card>
            <DistrictMap label="Map of high-risk zones" markers={markers} height="28rem" />
            {markers.length === 0 && (
              <p className="muted">No districts match the selected overlays.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
