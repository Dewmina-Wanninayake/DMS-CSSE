import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
  Cpu,
  FileText,
  MapPin,
  User,
} from 'lucide-react';
import {
  HAZARD_TYPE_LABELS,
  type LatestVerifiedReport,
  type PolicyDto,
  type PolicyNotificationDto,
  type RegulatoryConflict,
} from '@dms/shared';
import { formatDate, formatRelativeTime } from '../../../shared/format/format';
import { Alert, EmptyState, StatusBadge } from '../../../shared/ui/feedback';
import { IconChip, ListItem } from '../../../shared/ui/Card';
import { DELIVERY_TONE } from '../constants';

/** "Latest verified ground reports" from the analyst dashboard (read-only; verification is UC-DIST-02). */
export function LatestReportsList({
  reports,
  now,
}: {
  reports: LatestVerifiedReport[];
  now?: Date;
}) {
  if (reports.length === 0) {
    return (
      <EmptyState
        title="No verified reports yet"
        description="Reports appear here once a Duty Officer has verified them."
      />
    );
  }
  return (
    <ul className="list" aria-label="Latest verified ground reports">
      {reports.map((report) => (
        <li key={report.id}>
          <ListItem
            icon={AlertTriangle}
            tone="warning"
            title={`${HAZARD_TYPE_LABELS[report.hazardType]} confirmed`}
            subtitle={`${report.districtName} district · ${report.description}`}
            trailing={formatRelativeTime(report.verifiedAt, now)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Step 13 / extension 12a: who was told, and whether delivery worked. */
export function DeliveryStatusList({ notifications }: { notifications: PolicyNotificationDto[] }) {
  if (notifications.length === 0)
    return <p className="muted">No notifications were sent for this policy.</p>;
  const failed = notifications.filter((n) => n.deliveryStatus === 'Failed').length;
  return (
    <div className="stack">
      {failed > 0 && (
        <Alert
          tone="warning"
          title={`${failed} notification${failed === 1 ? '' : 's'} could not be delivered`}
        >
          Failed deliveries are logged and retried automatically.
        </Alert>
      )}
      <ul className="list" aria-label="Notification delivery">
        {notifications.map((n) => (
          <li key={n.id}>
            <ListItem
              icon={Bell}
              title={n.recipientName}
              subtitle={`${n.recipientRole.replace(/([a-z])([A-Z])/g, '$1 $2')} · ${n.subject}`}
              trailing={
                <StatusBadge tone={DELIVERY_TONE[n.deliveryStatus]}>
                  {n.deliveryStatus === 'Failed'
                    ? `Failed (retries: ${n.retryCount})`
                    : n.deliveryStatus}
                </StatusBadge>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

const FIELD_LABEL: Record<RegulatoryConflict['field'], string> = {
  description: 'Description',
  mitigationStrategies: 'Mitigation strategies',
  landUseGuidelines: 'Land-use guidelines',
  resourceRules: 'Resource allocation rules',
};

/** Extension 8a: clauses that contradict a national standard, to be fixed before submitting. */
export function ConflictList({ conflicts }: { conflicts: RegulatoryConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <Alert tone="danger" title="This policy conflicts with national regulatory standards">
      <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-6)' }}>
        {conflicts.map((c) => (
          <li key={`${c.ruleCode}-${c.field}`}>
            <strong>{FIELD_LABEL[c.field]}:</strong> “{c.clause}” — {c.message} ({c.ruleCode})
          </li>
        ))}
      </ul>
    </Alert>
  );
}

const SUMMARY_PREVIEW_LENGTH = 140;
const preview = (text: string): string =>
  text.length > SUMMARY_PREVIEW_LENGTH
    ? `${text.slice(0, SUMMARY_PREVIEW_LENGTH).trimEnd()}…`
    : text;

/** The summary cards of the hi-fi "Review draft policy" screen. */
export function PolicySummary({ policy }: { policy: PolicyDto }) {
  const actions =
    [policy.mitigationStrategies, policy.landUseGuidelines, policy.resourceRules].find((t) =>
      t.trim(),
    ) ?? '–';
  const rows = [
    { icon: FileText, term: 'Policy name', value: `${policy.title}` },
    {
      icon: MapPin,
      term: 'Affected region',
      value: `${policy.regionLabel} · ${HAZARD_TYPE_LABELS[policy.hazardType]}`,
    },
    { icon: ClipboardList, term: 'Actions required', value: preview(actions) },
    { icon: User, term: 'Authorised analyst', value: policy.authorName },
    {
      icon: Cpu,
      term: 'Simulation reference',
      value: policy.simulationReference ?? 'No simulation run',
    },
    {
      icon: CalendarDays,
      term: 'Proposed effective date',
      value: policy.proposedEffectiveDate ? formatDate(policy.proposedEffectiveDate) : 'Not set',
    },
  ];
  return (
    <dl className="summary" aria-label="Policy summary">
      {rows.map(({ icon, term, value }) => (
        <div key={term} className="summary__row">
          <IconChip icon={icon} />
          <div>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
