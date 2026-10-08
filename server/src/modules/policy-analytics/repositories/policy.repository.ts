import type { HazardType, PolicyContentInput, PolicyReviewDto, PolicyStatus } from '@dms/shared';
import type { Db } from '../../../core/db/connection';

export interface PolicyRecord extends PolicyContentInput {
  id: number;
  policyKey: string;
  version: number;
  status: PolicyStatus;
  hazardType: HazardType;
  trendReportId: number;
  districtIds: number[];
  effectiveDate: string | null;
  supersededBy: number | null;
  authorId: number;
  clientId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewPolicy extends PolicyContentInput {
  policyKey: string;
  version: number;
  hazardType: HazardType;
  trendReportId: number;
  districtIds: number[];
  authorId: number;
  clientId: string | null;
}

export interface PolicyFilter {
  /** Drafts are visible only to their author, so every listing needs the viewer. */
  viewerId: number;
  status?: PolicyStatus;
  mineOnly?: boolean;
  page: number;
  pageSize: number;
}

interface Row {
  id: number;
  policy_key: string;
  version: number;
  status: PolicyStatus;
  title: string;
  description: string;
  hazard_type: HazardType;
  trend_report_id: number;
  district_ids: string;
  mitigation_strategies: string;
  land_use_guidelines: string;
  resource_rules: string;
  warning_risk_threshold: number | null;
  proposed_effective_date: string | null;
  effective_date: string | null;
  superseded_by: number | null;
  author_id: number;
  client_id: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

const toRecord = (r: Row): PolicyRecord => ({
  id: r.id,
  policyKey: r.policy_key,
  version: r.version,
  status: r.status,
  title: r.title,
  description: r.description,
  hazardType: r.hazard_type,
  trendReportId: r.trend_report_id,
  districtIds: JSON.parse(r.district_ids) as number[],
  mitigationStrategies: r.mitigation_strategies,
  landUseGuidelines: r.land_use_guidelines,
  resourceRules: r.resource_rules,
  warningRiskThreshold: r.warning_risk_threshold,
  proposedEffectiveDate: r.proposed_effective_date,
  effectiveDate: r.effective_date,
  supersededBy: r.superseded_by,
  authorId: r.author_id,
  clientId: r.client_id,
  submittedAt: r.submitted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export class PolicyRepository {
  constructor(private readonly db: Db) {}

  insert(policy: NewPolicy): PolicyRecord {
    const result = this.db
      .prepare(
        `INSERT INTO policies
           (policy_key, version, title, description, hazard_type, trend_report_id, district_ids,
            mitigation_strategies, land_use_guidelines, resource_rules, warning_risk_threshold,
            proposed_effective_date, author_id, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        policy.policyKey,
        policy.version,
        policy.title,
        policy.description,
        policy.hazardType,
        policy.trendReportId,
        JSON.stringify(policy.districtIds),
        policy.mitigationStrategies,
        policy.landUseGuidelines,
        policy.resourceRules,
        policy.warningRiskThreshold,
        policy.proposedEffectiveDate,
        policy.authorId,
        policy.clientId,
      );
    return this.findById(Number(result.lastInsertRowid)) as PolicyRecord;
  }

  findById(id: number): PolicyRecord | undefined {
    const row = this.db.prepare('SELECT * FROM policies WHERE id = ?').get(id) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  findByClientId(clientId: string): PolicyRecord | undefined {
    const row = this.db.prepare('SELECT * FROM policies WHERE client_id = ?').get(clientId) as
      Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  findVersions(policyKey: string): PolicyRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM policies WHERE policy_key = ? ORDER BY version')
        .all(policyKey) as Row[]
    ).map(toRecord);
  }

  /** Next `P-<year>-NNN` sequence number (keys are never deleted, so counting is safe). */
  nextSequence(year: number): number {
    const row = this.db
      .prepare('SELECT COUNT(DISTINCT policy_key) AS n FROM policies WHERE policy_key LIKE ?')
      .get(`P-${year}-%`) as { n: number };
    return row.n + 1;
  }

  list(filter: PolicyFilter): { items: PolicyRecord[]; total: number } {
    const conditions = ["(status <> 'Draft' OR author_id = @viewerId)"];
    const params: Record<string, string | number> = { viewerId: filter.viewerId };
    if (filter.status) {
      conditions.push('status = @status');
      params.status = filter.status;
    }
    if (filter.mineOnly) conditions.push('author_id = @viewerId');
    const where = conditions.join(' AND ');
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM policies WHERE ${where}`).get(params) as {
        n: number;
      }
    ).n;
    const rows = this.db
      .prepare(
        `SELECT * FROM policies WHERE ${where} ORDER BY updated_at DESC, id DESC LIMIT @limit OFFSET @offset`,
      )
      .all({
        ...params,
        limit: filter.pageSize,
        offset: (filter.page - 1) * filter.pageSize,
      }) as Row[];
    return { items: rows.map(toRecord), total };
  }

  updateContent(id: number, content: PolicyContentInput): void {
    this.db
      .prepare(
        `UPDATE policies SET title = ?, description = ?, mitigation_strategies = ?,
           land_use_guidelines = ?, resource_rules = ?, warning_risk_threshold = ?,
           proposed_effective_date = ?, updated_at = ${NOW} WHERE id = ?`,
      )
      .run(
        content.title,
        content.description,
        content.mitigationStrategies,
        content.landUseGuidelines,
        content.resourceRules,
        content.warningRiskThreshold,
        content.proposedEffectiveDate,
        id,
      );
  }

  markSubmitted(id: number, submittedAt: string): void {
    this.db
      .prepare(
        `UPDATE policies SET status = 'PendingApproval', submitted_at = ?, updated_at = ${NOW} WHERE id = ?`,
      )
      .run(submittedAt, id);
  }

  markReviewed(id: number, status: 'Approved' | 'Rejected', effectiveDate: string | null): void {
    this.db
      .prepare(
        `UPDATE policies SET status = ?, effective_date = ?, updated_at = ${NOW} WHERE id = ?`,
      )
      .run(status, effectiveDate, id);
  }

  /** Marks earlier approved versions of the same policy as replaced (assumption A6). */
  supersedeEarlierApprovals(policyKey: string, version: number, newId: number): void {
    this.db
      .prepare(
        `UPDATE policies SET superseded_by = ?, updated_at = ${NOW}
         WHERE policy_key = ? AND version < ? AND status = 'Approved' AND superseded_by IS NULL`,
      )
      .run(newId, policyKey, version);
  }

  insertReview(
    policyId: number,
    reviewerId: number,
    decision: 'Approved' | 'Rejected',
    comments: string,
  ): void {
    this.db
      .prepare(
        'INSERT INTO policy_reviews (policy_id, reviewer_id, decision, comments) VALUES (?, ?, ?, ?)',
      )
      .run(policyId, reviewerId, decision, comments);
  }

  findReview(policyId: number): PolicyReviewDto | null {
    const row = this.db
      .prepare(
        `SELECT r.decision, r.comments, r.decided_at, u.full_name AS reviewer_name
         FROM policy_reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.policy_id = ?`,
      )
      .get(policyId) as
      | {
          decision: 'Approved' | 'Rejected';
          comments: string;
          decided_at: string;
          reviewer_name: string;
        }
      | undefined;
    return row
      ? {
          decision: row.decision,
          comments: row.comments,
          reviewerName: row.reviewer_name,
          decidedAt: row.decided_at,
        }
      : null;
  }
}
