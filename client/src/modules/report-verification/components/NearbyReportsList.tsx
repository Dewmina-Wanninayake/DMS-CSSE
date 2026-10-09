import { MapPin } from 'lucide-react';
import type { NearbyReport } from '@dms/shared';
import { Card } from '../../../shared/ui/Card';
import { StatusBadge } from '../../../shared/ui/feedback';

interface Props {
  reports: NearbyReport[];
}

export function NearbyReportsList({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <Card title="Nearby Corroborating Reports (2 km / 2 h)" icon={MapPin}>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-body)' }}>
          No other ground hazard reports detected within 2 km radius in the 2-hour window.
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Nearby Corroborating Reports (${reports.length})`} icon={MapPin}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Hazard</th>
              <th>Distance</th>
              <th>Reported At</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>#{r.id}</td>
                <td>{r.hazardType}</td>
                <td>
                  <strong>{r.distanceKm} km</strong>
                </td>
                <td>{new Date(r.reportedAt).toLocaleTimeString()}</td>
                <td>
                  <StatusBadge
                    tone={
                      r.status === 'Verified'
                        ? 'success'
                        : r.status === 'Rejected'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {r.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
