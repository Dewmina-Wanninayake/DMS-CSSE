import type { MapMarker } from '../shared/ui/DistrictMap';

/** Text stand-in for the Leaflet map (jsdom cannot render tiles): one list item per marker. */
export function DistrictMap({ markers, label }: { markers: MapMarker[]; label: string }) {
  return (
    <ul aria-label={label}>
      {markers.map((marker) => (
        <li key={marker.id} data-color={marker.color} data-radius={marker.radiusKm}>
          {marker.label}
        </li>
      ))}
    </ul>
  );
}
