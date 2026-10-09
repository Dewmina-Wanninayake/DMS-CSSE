import type {
  FieldUpdateInput,
  HazardTypeOption,
  PhotoInfo,
  ReportDetail,
  ReportStatus,
  ReportSummary,
  ReportSyncResultItem,
  ReportUpdateItem,
  ResolvedLocation,
  SubmitReportInput,
  UpdateReportInput,
} from '@dms/shared';
import { api, toQuery, type Page } from '../../../shared/api/api-client';

export interface MyReportsParams {
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

/** Typed client for the UC-CV-003 endpoints (docs/uc-cv-003-ground-reporting.md). */
export const groundReportingApi = {
  hazardTypes: () => api.get<HazardTypeOption[]>('/reports/hazard-types'),
  submit: (input: SubmitReportInput) => api.post<ReportSummary>('/reports', input),
  /** Offline reports, in the order they were captured (`clientId` makes a retry safe). */
  sync: (reports: (SubmitReportInput & { clientId: string })[]) =>
    api.post<ReportSyncResultItem[]>('/reports/sync', { reports }),
  mine: (params: MyReportsParams = {}): Promise<Page<ReportSummary>> =>
    api.getPage<ReportSummary>(`/reports/mine${toQuery({ ...params })}`),
  get: (id: number) => api.get<ReportDetail>(`/reports/${id}`),
  update: (id: number, input: UpdateReportInput) =>
    api.patch<ReportDetail>(`/reports/${id}`, input),
  /** The photo is optional and sent after the report, already compressed to at most 2 MB. */
  uploadPhoto: (id: number, photo: Blob) => api.putFile<PhotoInfo>(`/reports/${id}/photo`, photo),
  addFieldUpdate: (id: number, input: FieldUpdateInput) =>
    api.post<ReportUpdateItem>(`/reports/${id}/field-updates`, input),
  resolveLocation: (latitude: number, longitude: number) =>
    api.get<ResolvedLocation>(`/locations/resolve${toQuery({ lat: latitude, lng: longitude })}`),
};
