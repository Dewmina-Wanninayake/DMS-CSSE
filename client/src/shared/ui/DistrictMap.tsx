import 'leaflet/dist/leaflet.css';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';

/** Geographic centre of Sri Lanka; the map always opens on the whole island (critique DA #7). */
export const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];
const DEFAULT_ZOOM = 7;
const MARKER_RADIUS_PX = 11;

export interface MapMarker {
  id: number | string;
  latitude: number;
  longitude: number;
  color: string;
  label: string;
  /** When set the marker is drawn as a geographic circle of this radius (simulation footprint). */
  radiusKm?: number;
}

interface DistrictMapProps {
  markers: MapMarker[];
  /** Accessible name; the markers' text equivalents live in the data table next to the map. */
  label: string;
  height?: string;
}

/**
 * Leaflet map on OpenStreetMap tiles. Shared so UC-DIST-02 (affected areas) and UC-CV-003 (pin
 * picker) can reuse it instead of building their own.
 */
export function DistrictMap({ markers, label, height = '22rem' }: DistrictMapProps) {
  return (
    <div role="region" aria-label={label}>
      <MapContainer
        center={SRI_LANKA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="map"
        style={{ height }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker) => {
          const position: [number, number] = [marker.latitude, marker.longitude];
          const pathOptions = { color: marker.color, fillColor: marker.color, fillOpacity: 0.55 };
          return marker.radiusKm ? (
            <Circle
              key={marker.id}
              center={position}
              radius={marker.radiusKm * 1000}
              pathOptions={pathOptions}
            >
              <Tooltip>{marker.label}</Tooltip>
            </Circle>
          ) : (
            <CircleMarker
              key={marker.id}
              center={position}
              radius={MARKER_RADIUS_PX}
              pathOptions={pathOptions}
            >
              <Tooltip>{marker.label}</Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
