import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/report-verification.api';
import { ReportReviewPage } from '../pages/ReportReviewPage';

vi.mock('../api/report-verification.api');
vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

const sampleReview = {
  id: 1,
  hazardType: 'Flood' as const,
  description: 'Water rising',
  severity: null,
  status: 'Pending',
  latitude: 6.9271,
  longitude: 79.8612,
  locationSource: 'Gps' as const,
  photoPath: '/photo.png',
  districtId: 1,
  districtName: 'Colombo',
  reporterId: 5,
  reporterName: 'Kamal',
  reportedAt: '2026-10-09T10:00:00.000Z',
  duplicateOf: null,
  nearby: [],
  latestSensor: {
    stationName: 'Kelani River',
    observedAt: '2026-10-09T10:15:00.000Z',
    rainfallMm: 45,
    riverLevelM: 5.2,
  },
  warningCriteria: null,
  evidence: {
    sufficient: true,
    hasGps: true,
    hasPhoto: true,
    corroborationCount: 0,
    reasons: ['GPS location verified', 'Photo evidence present'],
  },
  decision: null,
  notes: null,
};

beforeEach(() => vi.resetAllMocks());

describe('ReportReviewPage', () => {
  it('2a: should display report details, decision support, and form', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(sampleReview);

    renderWithApp(<ReportReviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1',
      path: '/verification/reports/:id',
    });

    expect(await screen.findByText('Review report #1 (Flood)')).toBeInTheDocument();
    expect(screen.getByText('Sufficient evidence')).toBeInTheDocument();
    expect(screen.getByText('Your decision')).toBeInTheDocument();
  });

  it('5a: should submit verification decision', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(sampleReview);
    vi.mocked(api.submitDecision).mockResolvedValue({
      ...sampleReview,
      status: 'Verified',
      decision: 'Verified' as const,
    });

    renderWithApp(<ReportReviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1',
      path: '/verification/reports/:id',
    });

    await screen.findByText('Your decision');

    const submitBtn = screen.getByRole('button', { name: /Save decision/ });
    await userEvent.click(submitBtn);

    expect(api.submitDecision).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ decision: 'Verified' }),
    );
  });
});
