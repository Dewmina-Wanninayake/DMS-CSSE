import { useState, type FormEvent } from 'react';
import { POLICY_LIMITS, type SimulationRequest, type SimulationResult } from '@dms/shared';
import { formatNumber } from '../../../shared/format/format';
import { BarChart } from '../../../shared/ui/BarChart';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { DistrictMap } from '../../../shared/ui/DistrictMap';
import { Alert } from '../../../shared/ui/feedback';
import { TextInput } from '../../../shared/ui/fields';
import { RISK_COLORS } from '../../../shared/ui/risk-colors';
import { SIMULATION_DEFAULTS } from '../lib/constants';

interface SimulationFormProps {
  busy: boolean;
  errors: Record<string, string>;
  onRun: (request: SimulationRequest) => void;
}

/** "Simulation parameters" low-fi screen: model inputs for the proposed measures (step 7). */
export function SimulationForm({ busy, errors, onRun }: SimulationFormProps) {
  const [intensity, setIntensity] = useState<number>(SIMULATION_DEFAULTS.intensity);
  const [teams, setTeams] = useState<number>(SIMULATION_DEFAULTS.teamsDeployed);
  const [shelters, setShelters] = useState<number>(SIMULATION_DEFAULTS.sheltersActivated);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onRun({ intensity, teamsDeployed: teams, sheltersActivated: shelters });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Simulation parameters">
      <div className="field">
        <label className="field__label" htmlFor="sim-intensity">
          Event intensity: <strong>{intensity}</strong> of {POLICY_LIMITS.intensityMax}
        </label>
        <input
          id="sim-intensity"
          type="range"
          min={POLICY_LIMITS.intensityMin}
          max={POLICY_LIMITS.intensityMax}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
        />
        <span className="field__hint">1 is a minor event, 10 the worst case the model covers.</span>
      </div>
      <div className="grid grid--two">
        <TextInput
          label="Rescue teams deployed"
          type="number"
          min={1}
          value={teams}
          onChange={(e) => setTeams(Number(e.target.value))}
          error={errors.teamsDeployed}
        />
        <TextInput
          label="Shelters activated"
          type="number"
          min={0}
          value={shelters}
          onChange={(e) => setShelters(Number(e.target.value))}
          error={errors.sheltersActivated}
        />
      </div>
      <div className="row row--end">
        <Button type="submit" loading={busy}>
          Run simulation
        </Button>
      </div>
    </form>
  );
}

/** The four tiles of the hi-fi "Simulation summary" screen. */
export function SimulationSummary({ result }: { result: SimulationResult }) {
  const top = [...result.districts]
    .sort((a, b) => b.exposedPopulation - a.exposedPopulation)
    .slice(0, 6);
  const { totals } = result;
  return (
    <div className="stack" aria-label="Simulation summary">
      <div className="grid grid--two">
        <Card>
          <BarChart
            title="Evacuation times (hours)"
            unit="hours"
            data={top.map((d) => ({ label: d.name, value: d.evacuationHours }))}
          />
        </Card>
        <Card>
          <BarChart
            title="Affected area (km²)"
            unit="km²"
            data={top.map((d) => ({ label: d.name, value: d.affectedAreaKm2 }))}
          />
        </Card>
        <Card title="Resource allocation">
          <dl className="summary">
            <div className="summary__row">
              <dt>Drinking water</dt>
              <dd>{formatNumber(totals.waterLitres, 0)} litres</dd>
            </div>
            <div className="summary__row">
              <dt>Food</dt>
              <dd>{formatNumber(totals.foodKg, 0)} kg</dd>
            </div>
            <div className="summary__row">
              <dt>Medicine</dt>
              <dd>{formatNumber(totals.medicineKits, 0)} kits</dd>
            </div>
          </dl>
        </Card>
        <Card title="Predicted zone">
          <DistrictMap
            label="Predicted affected zone"
            height="11rem"
            markers={result.districts.map((d) => ({
              id: d.districtId,
              latitude: d.latitude,
              longitude: d.longitude,
              color: RISK_COLORS[d.riskLevel],
              radiusKm: Math.max(d.radiusKm, 1),
              label: `${d.name}: about ${formatNumber(d.exposedPopulation, 0)} people exposed`,
            }))}
          />
        </Card>
      </div>
      <div className="row row--between">
        <span>
          Simulation ID: <strong>{result.reference}</strong>
        </span>
        <span className="text-success strong">Status: Success</span>
      </div>
      <p className="muted">
        About {formatNumber(totals.exposedPopulation, 0)} people exposed · evacuation in roughly{' '}
        {formatNumber(totals.evacuationHours)} hours · shelters cover{' '}
        {formatNumber(totals.shelterCoverage * 100, 0)}% of them.
      </p>
      <Alert tone="info">
        This is a planning estimate from a simple rule-based model, not a forecast. It scales
        district population and area by event intensity and risk level.
      </Alert>
    </div>
  );
}
