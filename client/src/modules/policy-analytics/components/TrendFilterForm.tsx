import { useState, type FormEvent } from 'react';
import {
  HAZARD_TYPE_LABELS,
  POLICY_LIMITS,
  type AnalyticsFilters,
  type HazardType,
  type TrendReportRequest,
} from '@dms/shared';
import { addDays, toDayString } from '../../../shared/format/format';
import { Button } from '../../../shared/ui/Button';
import { Checkbox, Select, TextInput } from '../../../shared/ui/fields';
import { DEFAULT_PERIOD_DAYS } from '../constants';

interface TrendFilterFormProps {
  filters: AnalyticsFilters;
  busy: boolean;
  /** Field errors returned by the server, keyed by field name. */
  errors: Record<string, string>;
  onSubmit: (request: TrendReportRequest) => void;
}

/** Step 2: region, hazard type and period for the risk trend report. */
export function TrendFilterForm({ filters, busy, errors, onSubmit }: TrendFilterFormProps) {
  const today = new Date();
  const [hazardType, setHazardType] = useState<HazardType>(filters.hazardTypes[0] ?? 'Flood');
  const [allDistricts, setAllDistricts] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [periodStart, setPeriodStart] = useState(toDayString(addDays(today, -DEFAULT_PERIOD_DAYS)));
  const [periodEnd, setPeriodEnd] = useState(toDayString(today));
  const [localError, setLocalError] = useState<string>();

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((d) => d !== id) : [...current, id],
    );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!allDistricts && selected.length === 0) {
      setLocalError('Select at least one district, or choose all districts.');
      return;
    }
    setLocalError(undefined);
    onSubmit({ hazardType, districtIds: allDistricts ? 'all' : selected, periodStart, periodEnd });
  };

  const threshold = filters.thresholds.find((t) => t.hazardType === hazardType);
  const districtError = localError ?? errors.districtIds;

  return (
    <form className="card stack" onSubmit={submit} aria-label="Risk trend parameters">
      <div className="grid grid--two">
        <Select
          label="Hazard type"
          value={hazardType}
          onChange={(e) => setHazardType(e.target.value as HazardType)}
        >
          {filters.hazardTypes.map((type) => (
            <option key={type} value={type}>
              {HAZARD_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        {threshold && (
          <div className="field">
            <span className="field__label">Risk rule in force</span>
            <span className="muted">
              A district is high risk above {threshold.riskThreshold} verified reports in the period
              {threshold.sourcePolicyKey ? ` (set by policy ${threshold.sourcePolicyKey})` : ''}.
            </span>
          </div>
        )}
      </div>

      <fieldset className="fieldset stack" style={{ gap: 'var(--space-2)' }}>
        <legend>Region</legend>
        <Checkbox
          label="All districts"
          checked={allDistricts}
          onChange={(e) => setAllDistricts(e.target.checked)}
        />
        {!allDistricts && (
          <div className="district-grid" role="group" aria-label="Districts">
            {filters.districts.map((district) => (
              <Checkbox
                key={district.id}
                label={district.name}
                checked={selected.includes(district.id)}
                onChange={() => toggle(district.id)}
              />
            ))}
          </div>
        )}
        {districtError && (
          <span className="field__error" role="alert">
            {districtError}
          </span>
        )}
      </fieldset>

      <div className="grid grid--two">
        <TextInput
          label="Period start"
          type="date"
          value={periodStart}
          max={periodEnd}
          required
          onChange={(e) => setPeriodStart(e.target.value)}
          error={errors.periodStart}
        />
        <TextInput
          label="Period end"
          type="date"
          value={periodEnd}
          max={toDayString(today)}
          required
          onChange={(e) => setPeriodEnd(e.target.value)}
          error={errors.periodEnd}
          hint={`Up to ${POLICY_LIMITS.maxPeriodYears} years, ending no later than today.`}
        />
      </div>

      <div className="row row--end">
        <Button type="submit" loading={busy}>
          Generate risk report
        </Button>
      </div>
    </form>
  );
}
