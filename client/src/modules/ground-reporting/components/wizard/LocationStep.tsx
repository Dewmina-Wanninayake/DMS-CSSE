import { useEffect, useState } from 'react';
import { type ResolvedLocation } from '@dms/shared';
import { errorMessage } from '../../../../shared/api/api-client';
import { Button } from '../../../../shared/ui/Button';
import { DistrictMap } from '../../../../shared/ui/DistrictMap';
import { Alert, LoadingState } from '../../../../shared/ui/feedback';
import { RISK_COLORS } from '../../../../shared/ui/risk-colors';
import { groundReportingApi } from '../../api/ground-reporting.api';
import { captureLocation } from '../../lib/location';
import type { StepProps } from './wizard-types';

/**
 * Step 4: the system captures the GPS location and the reporter confirms it on the map (step 6).
 * When GPS fails the reporter drops a pin and the source is recorded as Manual (6a).
 */
export function LocationStep({ draft, onChange, errors }: StepProps) {
  const [status, setStatus] = useState<'locating' | 'found' | 'failed'>(
    draft.position ? 'found' : 'locating',
  );
  const [problem, setProblem] = useState<string>();
  const [district, setDistrict] = useState<ResolvedLocation>();
  const manual = status === 'failed' || draft.locationSource === 'Manual';

  async function locate() {
    setStatus('locating');
    setProblem(undefined);
    try {
      const position = await captureLocation();
      onChange({ position, locationSource: 'Gps' });
      setStatus('found');
    } catch (error) {
      setProblem(errorMessage(error));
      setStatus('failed');
    }
  }

  useEffect(() => {
    if (!draft.position) void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture once when the step opens
  }, []);

  const { position } = draft;
  useEffect(() => {
    setDistrict(undefined);
    if (!position) return;
    let current = true;
    groundReportingApi
      .resolveLocation(position.latitude, position.longitude)
      .then((resolved) => current && setDistrict(resolved))
      .catch(() => undefined); // the district is a convenience; the server resolves it on submit
    return () => {
      current = false;
    };
  }, [position]);

  return (
    <div className="stack">
      {status === 'locating' && <LoadingState label="Finding your location…" />}
      {status === 'failed' && (
        <Alert tone="warning" title="We could not get your location">
          {problem} Tap the map to drop a pin where the hazard is.
        </Alert>
      )}
      {errors.location && <Alert tone="danger">{errors.location}</Alert>}
      <DistrictMap
        label="Hazard location"
        height="18rem"
        markers={
          position
            ? [
                {
                  id: 'pin',
                  latitude: position.latitude,
                  longitude: position.longitude,
                  color: RISK_COLORS.High,
                  label: 'Hazard location',
                },
              ]
            : []
        }
        onPick={
          manual
            ? (latitude, longitude) =>
                onChange({ position: { latitude, longitude }, locationSource: 'Manual' })
            : undefined
        }
      />
      {position && (
        <p>
          {district ? `Nearest district: ${district.name}. ` : ''}
          {draft.locationSource === 'Manual'
            ? 'Location set by pin.'
            : 'Location found by GPS. Confirm that the pin is in the right place.'}
        </p>
      )}
      <div className="row">
        <Button variant="secondary" onClick={() => void locate()}>
          Use my location again
        </Button>
        {!manual && (
          <Button variant="secondary" onClick={() => onChange({ locationSource: 'Manual' })}>
            Choose on the map instead
          </Button>
        )}
      </div>
    </div>
  );
}
