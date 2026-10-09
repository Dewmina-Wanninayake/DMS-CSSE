import { FileText } from 'lucide-react';
import {
  HAZARD_TYPE_LABELS,
  type ReportStatus,
  type ReportSummary,
  type SyncStatus,
} from '@dms/shared';
import { errorMessage } from '../../../shared/api/api-client';
import { useAuth } from '../../../shared/auth/AuthContext';
import { formatRelativeTime } from '../../../shared/format/format';
import { useAsync } from '../../../shared/hooks/useAsync';
import { ButtonLink } from '../../../shared/ui/Button';
import { ListItem } from '../../../shared/ui/Card';
import {
  Alert,
  EmptyState,
  ErrorState,
  LoadingState,
  OfflineBanner,
  StatusBadge,
  type Tone,
} from '../../../shared/ui/feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { groundReportingApi } from '../api/ground-reporting.api';
import { usePendingReports } from '../hooks/usePendingReports';

/** The five states a report can show (critique CV-003 #5). */
type DisplayStatus = ReportStatus | Extract<SyncStatus, 'PendingSync'>;

const STATUS_LABEL: Record<DisplayStatus, string> = {
  Pending: 'Pending',
  PendingSync: 'Pending Sync',
  Verified: 'Verified',
  Rejected: 'Rejected',
  NeedsInformation: 'More information needed',
};

const STATUS_TONE: Record<DisplayStatus, Tone> = {
  Pending: 'info',
  PendingSync: 'warning',
  Verified: 'success',
  Rejected: 'danger',
  NeedsInformation: 'warning',
};

/** `PendingSync` never comes from the server; it exists only for reports still waiting in the device queue. */
export function ReportStatusBadge({ status }: { status: DisplayStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusBadge>;
}

/**
 * My Reports: reports waiting on this device (Pending Sync) above the ones the server holds, each
 * with its outcome. A report that needs more information links to the update screen (13a).
 */
export function MyReportsPage() {
  const { user } = useAuth();
  const reports = useAsync(() => groundReportingApi.mine({ pageSize: 50 }), []);
  const pending = usePendingReports({ ownerId: user?.id ?? 0, onSynced: () => reports.reload() });
  const items = reports.data?.items ?? [];
  const empty =
    !reports.loading && !reports.error && items.length === 0 && pending.reports.length === 0;

  return (
    <>
      <PageHeader title="My reports" subtitle="Hazards you have reported" />
      <div className="shell__content stack">
        {!pending.online && (
          <OfflineBanner>
            You are offline. Reports saved on this device will upload when you reconnect.
          </OfflineBanner>
        )}
        {pending.syncError && <Alert tone="danger">{pending.syncError}</Alert>}
        {pending.summary && pending.summary.uploaded > 0 && (
          <Alert tone="success">
            {pending.summary.uploaded} saved report
            {pending.summary.uploaded === 1 ? ' was' : 's were'} sent.
            {pending.summary.photosFailed > 0 &&
              ` ${pending.summary.photosFailed} photo could not be uploaded.`}
          </Alert>
        )}

        {pending.reports.length > 0 && (
          <section className="stack" aria-labelledby="on-device">
            <h2 id="on-device">Saved on this device</h2>
            <ul className="list" aria-label="Reports saved on this device">
              {pending.reports.map((report) => (
                <li key={report.clientId}>
                  <ListItem
                    icon={FileText}
                    title={HAZARD_TYPE_LABELS[report.hazardType]}
                    subtitle={
                      report.conflictMessage
                        ? `Could not be sent: ${report.conflictMessage}`
                        : `Saved ${formatRelativeTime(report.savedAt)} · will upload when you are online`
                    }
                    trailing={<ReportStatusBadge status="PendingSync" />}
                    tone={report.conflictMessage ? 'warning' : 'default'}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {reports.loading && <LoadingState label="Loading your reports…" />}
        {reports.error && (
          <ErrorState message={errorMessage(reports.error)} onRetry={reports.reload} />
        )}
        {empty && (
          <EmptyState
            title="You have not reported anything yet"
            description="Reports you send appear here with their outcome."
            action={<ButtonLink to="/report">Report a hazard</ButtonLink>}
          />
        )}
        {items.length > 0 && (
          <section className="stack" aria-labelledby="sent">
            <h2 id="sent">Sent reports</h2>
            <ul className="list" aria-label="Sent reports">
              {items.map((report) => (
                <li key={report.id}>
                  <ReportRow report={report} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function ReportRow({ report }: { report: ReportSummary }) {
  const outcome =
    report.outcome?.message ??
    (report.status === 'Pending' ? 'Waiting for a Duty Officer to check it.' : undefined);
  return (
    <>
      <ListItem
        icon={FileText}
        title={`${HAZARD_TYPE_LABELS[report.hazardType]} · ${report.districtName}`}
        subtitle={[outcome, formatRelativeTime(report.reportedAt)].filter(Boolean).join(' · ')}
        trailing={<ReportStatusBadge status={report.status} />}
        tone={report.status === 'NeedsInformation' ? 'warning' : 'default'}
      />
      {report.status === 'NeedsInformation' && (
        <div className="mt-2">
          <ButtonLink variant="secondary" to={`/report/${report.id}/update`}>
            Update report {report.id}
          </ButtonLink>
        </div>
      )}
    </>
  );
}
