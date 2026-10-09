import type { NearbyReport } from '@dms/shared';
import { Card } from '../../../shared/ui/Card';
import { StatusBadge } from '../../../shared/ui/feedback';

interface Props {
  reports: NearbyReport[];
}

export function NearbyReportsList({ reports }: Props) {
  if (reports.length === 0) {
    return (
      <Card title="Nearby reports (2 km / 2 h)">
        <p className="muted flush">
          No other ground hazard reports detected within 2 km radius in the 2-hour window.
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Nearby reports (${reports.length})`}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Hazard</th>
              <th>Distance</th>
              <th>Reported at</th>
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
