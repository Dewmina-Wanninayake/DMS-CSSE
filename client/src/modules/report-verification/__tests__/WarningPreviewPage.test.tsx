import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/reportVerificationApi';
import { WarningPreviewPage } from '../pages/WarningPreviewPage';

vi.mock('../api/reportVerificationApi');

const sampleReport = {
  id: 1,
  hazardType: 'Flood' as const,
  description: 'Water rising',
  severity: 'High' as const,
  status: 'Verified',
  latitude: 6.9271,
  longitude: 79.8612,
  locationSource: 'Gps' as const,
  photoPath: null,
  districtId: 1,
  districtName: 'Colombo',
  reporterId: 5,
  reporterName: 'Kamal',
  reportedAt: '2026-10-09T10:00:00.000Z',
  duplicateOf: null,
  nearby: [],
  latestSensor: null,
  warningCriteria: null,
  evidence: {
    sufficient: true,
    hasGps: true,
    hasPhoto: false,
    corroborationCount: 1,
    reasons: [],
  },
  decision: 'Verified' as const,
  notes: null,
};

const samplePreview = {
  estimatedAudience: 2326000,
  requiresAudienceConfirm: true,
  requiresApproval: true,
  districts: [{ id: 1, name: 'Colombo', population: 2326000 }],
  warningCriteria: null,
  language: 'Sinhala' as const,
  channels: ['Push' as const, 'SMS' as const],
};

beforeEach(() => vi.resetAllMocks());

describe('WarningPreviewPage', () => {
  it('6a: should render warning preview form and estimated audience', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(sampleReport);
    vi.mocked(api.previewWarning).mockResolvedValue(samplePreview);

    renderWithApp(<WarningPreviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1/warn',
      path: '/verification/reports/:id/warn',
    });

    expect(await screen.findByText('Escalate Warning & Audience Preview')).toBeInTheDocument();
    expect(await screen.findByText(/2,326,000 citizens/)).toBeInTheDocument();
  });

  it('6b: should trigger audience confirmation dialog when audience is large', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(sampleReport);
    vi.mocked(api.previewWarning).mockResolvedValue(samplePreview);

    renderWithApp(<WarningPreviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1/warn',
      path: '/verification/reports/:id/warn',
    });

    const textarea = await screen.findByLabelText(/Public Warning Reason/i);
    await userEvent.type(textarea, 'Severe flooding expected in low areas.');

    const submitBtn = screen.getByRole('button', { name: /Submit for Second Approval/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText('Confirm Large Broadcast Audience')).toBeInTheDocument();
  });
});
