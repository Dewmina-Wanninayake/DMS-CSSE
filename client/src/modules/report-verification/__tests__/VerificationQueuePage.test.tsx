import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/reportVerificationApi';
import { VerificationQueuePage } from '../pages/VerificationQueuePage';

vi.mock('../api/reportVerificationApi');

const sampleQueue = {
  reports: [
    {
      id: 1,
      hazardType: 'Flood' as const,
      description: 'River overflow near bridge',
      districtName: 'Colombo',
      reportedAt: '2026-10-09T10:00:00.000Z',
      hasPhoto: true,
      locationSource: 'Gps' as const,
    },
  ],
  pendingApprovals: [
    {
      id: 10,
      level: 'Warning' as const,
      hazardType: 'Flood' as const,
      reason: 'Water level critical',
      status: 'PendingApproval' as const,
      estimatedAudience: 2500000,
      createdAt: '2026-10-09T11:00:00.000Z',
    },
  ],
};

beforeEach(() => vi.resetAllMocks());

describe('VerificationQueuePage', () => {
  it('1a: should render pending reports and pending approvals', async () => {
    vi.mocked(api.getQueue).mockResolvedValue(sampleQueue);

    renderWithApp(<VerificationQueuePage />, { role: Role.DutyOfficer });

    expect(await screen.findByText('River overflow near bridge')).toBeInTheDocument();
    expect(screen.getByText('Pending Warning Approvals (1)')).toBeInTheDocument();
    expect(screen.getByText('Water level critical')).toBeInTheDocument();
  });

  it('1b: should render empty state when there are no pending reports', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({ reports: [], pendingApprovals: [] });

    renderWithApp(<VerificationQueuePage />, { role: Role.DutyOfficer });

    expect(await screen.findByText('No pending reports')).toBeInTheDocument();
  });

  it('1c: should show error state on API error', async () => {
    vi.mocked(api.getQueue).mockRejectedValue(new Error('Failed to fetch queue'));

    renderWithApp(<VerificationQueuePage />, { role: Role.DutyOfficer });

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch queue');
  });
});
