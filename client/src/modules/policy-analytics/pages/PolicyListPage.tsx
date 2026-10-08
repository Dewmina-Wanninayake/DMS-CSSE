import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PolicyStatus, Role, type PolicyStatus as PolicyStatusType } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { formatDate } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { Button, ButtonLink } from '../../../shared/ui/Button';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  StatusBadge,
} from '../../../shared/ui/feedback';
import { Select } from '../../../shared/ui/fields';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { PolicyStatusBadge } from '../components/badges';
import { POLICY_STATUS_LABEL } from '../constants';
import { usePendingDrafts } from '../hooks/usePendingDrafts';

const PAGE_SIZE = 10;
const STATUSES = Object.values(PolicyStatus);

/** Policy tab: every policy with its status badge, plus drafts still Pending Sync (extension 9a). */
export function PolicyListPage() {
  const { user } = useAuth();
  const isAnalyst = user?.role === Role.DisasterAnalyst;
  const [params, setParams] = useSearchParams();
  const status = STATUSES.find((s) => s === params.get('status'));
  const [page, setPage] = useState(1);

  const list = useAsync(
    () => policyAnalyticsApi.listPolicies({ status, page, pageSize: PAGE_SIZE }),
    [status, page],
  );
  const pending = usePendingDrafts({ ownerId: user?.id ?? 0, onSynced: () => list.reload() });

  const setStatus = (next: string) => {
    setPage(1);
    setParams(next ? { status: next } : {});
  };

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.meta.total / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader
        title="Policies"
        subtitle="Mitigation policies and their approval status"
        actions={
          isAnalyst && (
            <ButtonLink to="/policies/new" variant="secondary">
              <Plus size={18} aria-hidden="true" />
              New policy
            </ButtonLink>
          )
        }
      />
      <div className="shell__content stack">
        {pending.drafts.length > 0 && (
          <section className="stack" aria-label="Drafts pending synchronisation">
            <OfflineBanner>
              {pending.drafts.length} draft{pending.drafts.length === 1 ? '' : 's'} saved on this
              device. {pending.online ? 'Uploading…' : 'They will upload when you are back online.'}
            </OfflineBanner>
            <ul className="list">
              {pending.drafts.map((draft) => (
                <li key={draft.clientId} className="list-item">
                  <div className="list-item__body">
                    <div className="list-item__title">{draft.title}</div>
                    <div className="muted">
                      Saved {formatDate(draft.savedAt)}
                      {draft.conflictMessage ? ` · Could not sync: ${draft.conflictMessage}` : ''}
                    </div>
                  </div>
                  <StatusBadge tone={draft.conflictMessage ? 'danger' : 'warning'}>
                    {draft.conflictMessage ? 'Sync failed' : 'Pending sync'}
                  </StatusBadge>
                </li>
              ))}
            </ul>
            <div className="row">
              <Button
                variant="secondary"
                onClick={() => void pending.syncNow()}
                loading={pending.syncing}
                disabled={!pending.online}
              >
                Sync now
              </Button>
            </div>
          </section>
        )}
        {pending.syncError && <Alert tone="danger">{pending.syncError}</Alert>}
        {pending.summary && pending.summary.uploaded > 0 && (
          <Alert tone="success">
            {pending.summary.uploaded} offline draft{pending.summary.uploaded === 1 ? '' : 's'}{' '}
            uploaded.
          </Alert>
        )}

        <div style={{ maxWidth: '16rem' }}>
          <Select label="Status" value={status ?? ''} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s: PolicyStatusType) => (
              <option key={s} value={s}>
                {POLICY_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>

        {list.loading && <LoadingState label="Loading policies…" />}
        {list.error && <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />}
        {list.data && list.data.items.length === 0 && (
          <EmptyState
            title={
              status
                ? `No ${POLICY_STATUS_LABEL[status].toLowerCase()} policies`
                : 'No policies yet'
            }
            description={
              isAnalyst
                ? 'Start from a trend report to draft the first one.'
                : 'Policies submitted by analysts appear here.'
            }
            action={isAnalyst && <ButtonLink to="/analytics/trends">Analyse trends</ButtonLink>}
          />
        )}
        {list.data && list.data.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">Policies</caption>
                <thead>
                  <tr>
                    <th scope="col">Policy</th>
                    <th scope="col">Region</th>
                    <th scope="col">Author</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((policy) => (
                    <tr key={policy.id}>
                      <th scope="row">
                        <Link to={`/policies/${policy.id}`}>{policy.title}</Link>
                        <div className="muted caption">
                          {policy.policyKey} · version {policy.version}
                        </div>
                      </th>
                      <td>{policy.regionLabel}</td>
                      <td>{policy.authorName}</td>
                      <td>{formatDate(policy.updatedAt)}</td>
                      <td>
                        <PolicyStatusBadge status={policy.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">
                Page {page} of {totalPages} · {list.data.meta.total} policies
              </span>
              <div className="row">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
