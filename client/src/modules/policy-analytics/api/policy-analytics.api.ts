import type {
  AnalyticsFilters,
  LatestVerifiedReport,
  PolicyContentInput,
  PolicyDraftInput,
  PolicyDto,
  PolicyNotificationDto,
  PolicyStatus,
  RegulatoryConflict,
  ReviewRequest,
  SimulationRequest,
  SimulationResult,
  SyncDraftResult,
  TrendReport,
  TrendReportRequest,
} from '@dms/shared';
import { api, toQuery, type Page } from '../../../shared/api/api-client';

export interface PolicyListParams {
  status?: PolicyStatus;
  mine?: boolean;
  page?: number;
  pageSize?: number;
}

/** Typed client for the UC-DA-001 endpoints (docs/uc-da-001-policy-analytics.md). */
export const policyAnalyticsApi = {
  filters: () => api.get<AnalyticsFilters>('/analytics/filters'),
  latestVerified: (limit?: number) =>
    api.get<LatestVerifiedReport[]>(`/analytics/verified-reports/latest${toQuery({ limit })}`),
  createTrendReport: (request: TrendReportRequest) =>
    api.post<TrendReport>('/analytics/trend-reports', request),
  getTrendReport: (id: number) => api.get<TrendReport>(`/analytics/trend-reports/${id}`),
  listTrendReports: () => api.get<TrendReport[]>('/analytics/trend-reports'),

  listPolicies: (params: PolicyListParams = {}): Promise<Page<PolicyDto>> =>
    api.getPage<PolicyDto>(`/policies${toQuery({ ...params })}`),
  getPolicy: (id: number) => api.get<PolicyDto>(`/policies/${id}`),
  createDraft: (input: PolicyDraftInput) => api.post<PolicyDto>('/policies/drafts', input),
  updateDraft: (id: number, content: PolicyContentInput) =>
    api.patch<PolicyDto>(`/policies/${id}`, content),
  checkConflicts: (id: number) => api.get<RegulatoryConflict[]>(`/policies/${id}/conflicts`),
  submitPolicy: (id: number) => api.post<PolicyDto>(`/policies/${id}/submit`),
  reviewPolicy: (id: number, request: ReviewRequest) =>
    api.post<PolicyDto>(`/policies/${id}/review`, request),
  revisePolicy: (id: number) => api.post<PolicyDto>(`/policies/${id}/revise`),
  runSimulation: (id: number, request: SimulationRequest) =>
    api.post<SimulationResult>(`/policies/${id}/simulations`, request),
  policyNotifications: (id: number) =>
    api.get<PolicyNotificationDto[]>(`/policies/${id}/notifications`),
  syncDrafts: (drafts: PolicyDraftInput[]) =>
    api.post<SyncDraftResult[]>('/policies/sync', { drafts }),
};
