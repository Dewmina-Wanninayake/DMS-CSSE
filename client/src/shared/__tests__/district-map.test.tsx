import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DistrictMap, SRI_LANKA_CENTER } from '../ui/DistrictMap';

// Leaflet needs a real browser layout; here we only verify what the map is asked to draw.
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    center,
    zoom,
  }: {
    children: ReactNode;
    center: number[];
    zoom: number;
  }) => (
    <div data-testid="map" data-center={center.join(',')} data-zoom={zoom}>
      {children}
    </div>
  ),
  TileLayer: ({ attribution, url }: { attribution: string; url: string }) => (
    <div data-testid="tiles" data-url={url}>
      {attribution}
    </div>
  ),
  CircleMarker: ({ children, radius }: { children: ReactNode; radius: number }) => (
    <div data-testid="marker" data-radius={radius}>
      {children}
    </div>
  ),
  Circle: ({ children, radius }: { children: ReactNode; radius: number }) => (
    <div data-testid="circle" data-radius={radius}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

describe('DistrictMap', () => {
  it('should open on Sri Lanka with OpenStreetMap tiles and attribution', () => {
    render(<DistrictMap label="Risk map" markers={[]} />);
    expect(screen.getByRole('region', { name: 'Risk map' })).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveAttribute('data-center', SRI_LANKA_CENTER.join(','));
    expect(screen.getByTestId('tiles').getAttribute('data-url')).toContain('openstreetmap.org');
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
  });

  it('should draw point markers, and geographic circles when a radius is given', () => {
    render(
      <DistrictMap
        label="Zones"
        markers={[
          {
            id: 1,
            latitude: 7.25,
            longitude: 80.35,
            color: '#dc2626',
            label: 'Kegalle: 8 verified',
          },
          {
            id: 2,
            latitude: 6.68,
            longitude: 80.4,
            color: '#d97706',
            label: 'Ratnapura footprint',
            radiusKm: 4.5,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('marker')).toHaveTextContent('Kegalle: 8 verified');
    expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '4500'); // km → metres
    expect(screen.getByTestId('circle')).toHaveTextContent('Ratnapura footprint');
  });
});
