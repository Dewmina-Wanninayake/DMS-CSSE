import type {
  ApprovalRequest,
  CorrectionRequest,
  CreateWarningRequest,
  DecisionRequest,
  HazardTeamRule,
  ReportReview,
  VerificationQueue,
  WarningDelivery,
  WarningDto,
  WarningPreview,
  WarningPreviewRequest,
} from '@dms/shared';
import { api } from '../../../shared/api/api-client';

export const reportVerificationApi = {
  getQueue: () => api.get<VerificationQueue>('/verification/queue'),
  getReportReview: (id: number) => api.get<ReportReview>(`/verification/reports/${id}`),
  submitDecision: (id: number, input: DecisionRequest) =>
    api.post<ReportReview>(`/verification/reports/${id}/decision`, input),
  previewWarning: (input: WarningPreviewRequest) =>
    api.post<WarningPreview>('/warnings/preview', input),
  createWarning: (input: CreateWarningRequest) =>
    api.post<WarningDto>('/warnings', input),
  approveWarning: (id: number, input: ApprovalRequest) =>
    api.post<WarningDto>(`/warnings/${id}/approval`, input),
  correctWarning: (id: number, input: CorrectionRequest) =>
    api.post<WarningDto>(`/warnings/${id}/correction`, input),
  getWarningDelivery: (id: number) =>
    api.get<WarningDelivery>(`/warnings/${id}/delivery`),
  getHazardTeamRules: () => api.get<HazardTeamRule[]>('/hazard-team-rules'),
};
