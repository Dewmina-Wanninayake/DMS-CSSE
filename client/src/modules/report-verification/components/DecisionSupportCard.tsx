import { AlertCircle, CheckCircle2, CloudRain, ShieldCheck } from 'lucide-react';
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
    <Card title="Decision Support & Evidence Check" icon={ShieldCheck}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-label)' }}>Minimum Evidence Rule (DIST-02 #3):</span>
            <StatusBadge tone={evidence.sufficient ? 'success' : 'danger'}>
              {evidence.sufficient ? 'Sufficient Evidence' : 'Insufficient Evidence'}
            </StatusBadge>
          </div>
          <ul className="list">
            {evidence.reasons.map((r, i) => (
              <li key={i} className="list-item" style={{ padding: 'var(--space-2) var(--space-3)' }}>
                {evidence.sufficient ? (
                  <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 'var(--text-body)' }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {sensor ? (
            <div className="alert alert--info" style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                <CloudRain size={16} />
                <span>Hydromet Sensor ({sensor.stationName})</span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--text-caption)' }}>
                Rainfall: <strong>{sensor.rainfallMm} mm</strong> | River level:{' '}
                <strong>{sensor.riverLevelM} m</strong>
              </p>
              <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
                Observed: {new Date(sensor.observedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="alert alert--neutral" style={{ fontSize: 'var(--text-caption)' }}>
              No recent hydromet station sensor readings within 30 days for this district.
            </div>
          )}

          {criteria && (
            <div style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)' }}>
              <strong>Active M2 Warning Criteria:</strong> Risk Threshold: {criteria.riskThreshold} reports |
              Policy Ref: {criteria.sourcePolicyKey ?? 'Default Standard'}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
