import type { MapMarker } from '../shared/ui/DistrictMap';

/** Text stand-in for the Leaflet map (jsdom cannot render tiles): one list item per marker. */
export function DistrictMap({
  markers,
  label,
  onPick,
}: {
  markers: MapMarker[];
  label: string;
  onPick?: (latitude: number, longitude: number) => void;
}) {
  return (
    <>
      <ul aria-label={label}>
        {markers.map((marker) => (
          <li key={marker.id} data-color={marker.color} data-radius={marker.radiusKm}>
            {marker.label}
          </li>
        ))}
      </ul>
      {onPick && (
        <button type="button" onClick={() => onPick(7.25, 80.35)}>
          Drop test pin
        </button>
      )}
    </>
  );
}
