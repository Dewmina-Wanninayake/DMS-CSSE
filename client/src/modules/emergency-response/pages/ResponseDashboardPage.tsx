import { BedDouble, Boxes, Send, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { TileLink } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';
import { DispatchStatusBadge, PriorityBadge, ShelterStateBadge } from '../components/badges';
import { StaleDataBanner } from '../components/StaleDataBanner';

/** Emergency Response Dashboard (steps 1-2): incident, shelters (read-only), teams and resources. */
export function ResponseDashboardPage() {
  const dashboard = useAsync(() => emergencyResponseApi.dashboard(), []);
  const data = dashboard.data;

  return (
    <>
      <PageHeader title="Emergency response" subtitle="Dashboard" />
      <div className="shell__content stack">
        {dashboard.loading && !data && <LoadingState label="Loading the response dashboard…" />}
        {dashboard.error && (
          <ErrorState message={errorMessage(dashboard.error)} onRetry={dashboard.reload} />
        )}
        {data && (
          <>
            <StaleDataBanner updatedAt={data.generatedAt} />
            <nav className="grid grid--tiles" aria-label="Response tools">
              <TileLink
                to="/response/teams"
                icon={Send}
                label="Active dispatches"
                value={data.kpis.activeDispatches}
              />
              <TileLink
                to="/response/teams"
                icon={Users}
                label="Teams available"
                value={data.kpis.availableTeams}
              />
              <TileLink
                to="/response/allocate"
                icon={BedDouble}
                label="Shelter beds free"
                value={data.kpis.shelterBedsFree}
              />
              <TileLink
                to="/response/resources"
                icon={Boxes}
                label="Low-stock resources"
                value={data.kpis.lowStockResources}
              />
            </nav>

            <section className="stack" aria-labelledby="shelters">
              <h2 id="shelters">Shelters</h2>
              <p className="muted">
                Occupancy is recorded by the Shelter Coordinator. This view is read only.
              </p>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Shelter</th>
                      <th scope="col" className="num">
                        Occupied
                      </th>
                      <th scope="col" className="num">
                        Capacity
                      </th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shelters.map((shelter) => (
                      <tr key={shelter.id}>
                        <td>
                          <Link to={`/response/shelters/${shelter.id}`}>{shelter.name}</Link>
                        </td>
                        <td className="num">{shelter.occupied}</td>
                        <td className="num">{shelter.capacity}</td>
                        <td>
                          <ShelterStateBadge shelter={shelter} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="stack" aria-labelledby="dispatches">
              <h2 id="dispatches">Active dispatches</h2>
              {data.activeDispatches.length === 0 ? (
                <EmptyState
                  title="No active dispatches"
                  description="Dispatch a rescue team from Rescue team coordination."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Team</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.activeDispatches.map((dispatch) => (
                        <tr key={dispatch.id}>
                          <td>{dispatch.location}</td>
                          <td>
                            {data.teams.find((team) => team.id === dispatch.teamId)?.name ??
                              `Team ${dispatch.teamId}`}
                          </td>
                          <td>
                            <PriorityBadge priority={dispatch.priority} />
                          </td>
                          <td>
                            <DispatchStatusBadge status={dispatch.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="stack" aria-labelledby="stock">
              <h2 id="stock">Resource stock</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Resource</th>
                      <th scope="col" className="num">
                        Quantity
                      </th>
                      <th scope="col">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.resources.map((resource) => (
                      <tr key={resource.id}>
                        <td>{resource.name}</td>
                        <td className="num">{resource.quantityLabel}</td>
                        <td>
                          <StatusBadge tone={resource.lowStock ? 'warning' : 'success'}>
                            {resource.lowStock ? 'Low stock' : 'In stock'}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
