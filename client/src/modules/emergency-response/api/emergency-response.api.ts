import type {
  AllocationEntryDto,
  AllocationInput,
  AllocationSummary,
  CancelDispatchResult,
  DispatchDto,
  DispatchInput,
  DispatchStatus,
  DispatchSummary,
  RedirectRequestResult,
  RescueTeamDto,
  ResourceDto,
  ResponseDashboard,
  ResupplyRequestDto,
  ResupplyRequestInput,
  ShelterDto,
} from '@dms/shared';
import { api } from '../../../shared/api/api-client';

/** Typed client for the UC-JOINT-001 endpoints (docs/uc-joint-001-emergency-response.md). */
export const emergencyResponseApi = {
  dashboard: () => api.get<ResponseDashboard>('/response/dashboard'),
  shelter: (id: number) => api.get<ShelterDto>(`/shelters/${id}`),
  /** 3a: asks the Shelter Coordinator to redirect people away from a full shelter. */
  requestRedirect: (id: number, note?: string) =>
    api.post<RedirectRequestResult>(`/shelters/${id}/redirect-requests`, { note }),
  teams: () => api.get<RescueTeamDto[]>('/rescue-teams'),

  previewDispatch: (input: DispatchInput) =>
    api.post<DispatchSummary>('/dispatches/preview', input),
  createDispatch: (input: DispatchInput) => api.post<DispatchDto>('/dispatches', input),
  myDispatches: () => api.get<DispatchDto[]>('/dispatches/mine'),
  updateStatus: (id: number, status: DispatchStatus) =>
    api.patch<DispatchDto>(`/dispatches/${id}/status`, { status }),
  cancelDispatch: (id: number, reason: string, replacementTeamId?: number) =>
    api.post<CancelDispatchResult>(`/dispatches/${id}/cancel`, { reason, replacementTeamId }),

  resources: () => api.get<ResourceDto[]>('/resources'),
  previewAllocation: (input: AllocationInput) =>
    api.post<AllocationSummary>('/allocations/preview', input),
  createAllocation: (input: AllocationInput) => api.post<AllocationEntryDto>('/allocations', input),
  reverseAllocation: (id: number, reason: string) =>
    api.post<AllocationEntryDto>(`/allocations/${id}/reversal`, { reason }),
  requestResupply: (input: ResupplyRequestInput) =>
    api.post<ResupplyRequestDto>('/resupply-requests', input),
};
