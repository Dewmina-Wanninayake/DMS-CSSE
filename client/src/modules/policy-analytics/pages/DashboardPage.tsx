import { ClipboardCheck, FilePenLine, FileText, Map, TrendingUp } from 'lucide-react';
import { PolicyStatus, Role } from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { formatRelativeTime } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { ListItem, TileLink } from '../../../shared/ui/Card';
import { EmptyState, ErrorState, LoadingState, OfflineBanner } from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { policyAnalyticsApi } from '../api/policy-analytics.api';
import { LatestReportsList } from '../components/PolicyParts';
import { PolicyStatusBadge } from '../components/badges';
import { usePendingDrafts } from '../hooks/usePendingDrafts';

/** Analyst dashboard (hi-fi `analyst-dashboard`) and the Director's approvals dashboard. */
export function DashboardPage() {
  const { user } = useAuth();
  return user?.role === Role.PolicyDirector ? (
    <DirectorDashboard />
  ) : (
    <AnalystDashboard ownerId={user?.id ?? 0} />
  );
}

function AnalystDashboard({ ownerId }: { ownerId: number }) {
  const reports = useAsync(() => policyAnalyticsApi.latestVerified(), []);
  const pending = usePendingDrafts({ ownerId });

  return (
    <>
      <PageHeader title="DMC Admin" subtitle="Analyst dashboard" />
      <div className="shell__content stack">
        {pending.drafts.length > 0 && (
          <OfflineBanner>
            {pending.drafts.length} draft{pending.drafts.length === 1 ? ' is' : 's are'} saved on
            this device and waiting to sync.
            {pending.online ? ' Synchronising now…' : ' They will upload when you are back online.'}
          </OfflineBanner>
        )}
        <nav className="grid grid--tiles" aria-label="Analyst tools">
          <TileLink to="/analytics/map" icon={Map} label="Map view and overlays" />
          <TileLink to="/analytics/trends" icon={TrendingUp} label="Data trend analysis" />
          <TileLink to="/policies/new" icon={FilePenLine} label="Submit policy updates" />
          <TileLink to="/policies" icon={ClipboardCheck} label="Policy status" />
        </nav>

        <section className="stack" aria-labelledby="latest-reports">
          <h2 id="latest-reports">Latest verified ground reports</h2>
          {reports.loading && <LoadingState label="Loading verified reports…" />}
          {reports.error && (
            <ErrorState message={errorMessage(reports.error)} onRetry={reports.reload} />
          )}
          {reports.data && <LatestReportsList reports={reports.data} />}
        </section>
      </div>
    </>
  );
}

function DirectorDashboard() {
  const pending = useAsync(
    () => policyAnalyticsApi.listPolicies({ status: PolicyStatus.PendingApproval }),
    [],
  );
  const count = pending.data?.meta.total;

  return (
    <>
      <PageHeader title="DMC Admin" subtitle="Policy director dashboard" />
      <div className="shell__content stack">
        <nav className="grid grid--tiles" aria-label="Director tools">
          <TileLink
            to="/policies?status=PendingApproval"
            icon={ClipboardCheck}
            label="Awaiting your approval"
            value={count ?? '–'}
          />
          <TileLink to="/policies" icon={FileText} label="All policies" />
          <TileLink to="/analytics/map" icon={Map} label="High-risk zones" />
        </nav>

        <section className="stack" aria-labelledby="awaiting">
          <h2 id="awaiting">Awaiting your approval</h2>
          {pending.loading && <LoadingState label="Loading policies…" />}
          {pending.error && (
            <ErrorState message={errorMessage(pending.error)} onRetry={pending.reload} />
          )}
          {pending.data && pending.data.items.length === 0 && (
            <EmptyState
              title="Nothing to approve"
              description="Policies submitted by analysts will appear here."
            />
          )}
          {pending.data && pending.data.items.length > 0 && (
            <ul className="list" aria-label="Policies awaiting approval">
              {pending.data.items.map((policy) => (
                <li key={policy.id}>
                  <ListItem
                    icon={FileText}
                    to={`/policies/${policy.id}/review`}
                    title={policy.title}
                    subtitle={`${policy.policyKey} v${policy.version} · ${policy.authorName}`}
                    trailing={
                      <>
                        <PolicyStatusBadge status={policy.status} />{' '}
                        {policy.submittedAt && formatRelativeTime(policy.submittedAt)}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
