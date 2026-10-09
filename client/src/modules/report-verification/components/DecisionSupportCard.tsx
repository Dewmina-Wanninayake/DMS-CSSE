import { AlertCircle, CheckCircle2, CloudRain } from 'lucide-react';
import type { EvidenceAssessment, SensorReading, WarningCriterion } from '@dms/shared';
import { Card } from '../../../shared/ui/Card';
import { StatusBadge } from '../../../shared/ui/feedback';

interface Props {
  evidence: EvidenceAssessment;
  sensor: SensorReading | null;
  criteria: WarningCriterion | null;
}

export function DecisionSupportCard({ evidence, sensor, criteria }: Props) {
  return (
    <Card title="Decision support and evidence">
      <div className="grid-auto">
        <div>
          <div className="row row--tight mb-2">
            <span className="text-label strong">Minimum evidence rule:</span>
            <StatusBadge tone={evidence.sufficient ? 'success' : 'danger'}>
              {evidence.sufficient ? 'Sufficient evidence' : 'Insufficient evidence'}
            </StatusBadge>
          </div>
          <ul className="list">
            {evidence.reasons.map((r, i) => (
              <li key={i} className="list-item compact">
                {evidence.sufficient ? (
                  <CheckCircle2 size={16} className="text-success no-shrink" />
                ) : (
                  <AlertCircle size={16} className="text-danger no-shrink" />
                )}
                <span className="text-body">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {sensor ? (
            <div className="alert alert--info alert--block">
              <div className="row row--tight strong mb-1">
                <CloudRain size={16} />
                <span>Hydromet Sensor ({sensor.stationName})</span>
              </div>
              <p className="caption flush">
                Rainfall: <strong>{sensor.rainfallMm} mm</strong> | River level:{' '}
                <strong>{sensor.riverLevelM} m</strong>
              </p>
              <p className="caption muted mt-1 flush-x">
                Observed: {new Date(sensor.observedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="alert alert--neutral caption">
              No recent hydromet station sensor readings within 30 days for this district.
            </div>
          )}

          {criteria && (
            <div className="caption muted mt-3">
              <strong>Active warning criteria:</strong> Risk Threshold: {criteria.riskThreshold}{' '}
              reports | Policy Ref: {criteria.sourcePolicyKey ?? 'Default standard'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
