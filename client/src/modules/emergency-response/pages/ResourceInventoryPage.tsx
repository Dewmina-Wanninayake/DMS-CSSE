import { errorMessage } from '../../../shared/api/api-client';
import { useAsync } from '../../../shared/hooks/useAsync';
import { ButtonLink } from '../../../shared/ui/Button';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { emergencyResponseApi } from '../api/emergency-response.api';

/** Resource Inventory (B1): quantity with its one unit, owner and location. */
export function ResourceInventoryPage() {
  const resources = useAsync(() => emergencyResponseApi.resources(), []);
  const low = resources.data?.filter((resource) => resource.lowStock) ?? [];

  return (
    <>
      <PageHeader title="Resources" subtitle="Inventory" backTo="/response" />
      <div className="shell__content stack">
        {resources.loading && <LoadingState label="Loading the inventory…" />}
        {resources.error && (
          <ErrorState message={errorMessage(resources.error)} onRetry={resources.reload} />
        )}
        {resources.data && resources.data.length === 0 && (
          <EmptyState
            title="No resources recorded"
            description="Stock appears here once a resource owner registers it."
          />
        )}
        {low.length > 0 && (
          <Alert tone="warning" title="Low stock">
            {low.map((resource) => resource.name).join(', ')} {low.length === 1 ? 'is' : 'are'}{' '}
            running low. Request resupply when you allocate.
          </Alert>
        )}
        {resources.data && resources.data.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Resource</th>
                  <th scope="col" className="num">
                    Quantity
                  </th>
                  <th scope="col">Owner</th>
                  <th scope="col">Location</th>
                  <th scope="col">Stock</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resources.data.map((resource) => (
                  <tr key={resource.id}>
                    <td>{resource.name}</td>
                    <td className="num">{resource.quantityLabel}</td>
                    <td>{resource.owner}</td>
                    <td>{resource.location}</td>
                    <td>
                      <StatusBadge tone={resource.lowStock ? 'warning' : 'success'}>
                        {resource.lowStock ? 'Low stock' : 'In stock'}
                      </StatusBadge>
                    </td>
                    <td>
                      <ButtonLink
                        variant="secondary"
                        to={`/response/allocate?resourceId=${resource.id}`}
                      >
                        Allocate {resource.name}
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
