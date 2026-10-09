import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/reportVerificationApi';
import { DeliveryStatusPage } from '../pages/DeliveryStatusPage';

vi.mock('../api/reportVerificationApi');

const sampleDelivery = {
  warning: {
    id: 10,
    reportId: 1,
    hazardType: 'Flood' as const,
    level: 'Warning' as const,
    reason: 'Critical water level',
    language: 'English' as const,
    status: 'Issued' as const,
    syncStatus: 'Synced' as const,
    areaIds: [1],
    areaNames: ['Colombo'],
    channels: ['Push' as const, 'SMS' as const],
    estimatedAudience: 2326000,
    createdBy: 1,
    issuedAt: '2026-10-09T11:05:00.000Z',
    createdAt: '2026-10-09T11:00:00.000Z',
  },
  deliveries: [
    {
      id: 101,
      channel: 'Push' as const,
      recipient: 'RescueTeamLeader',
      deliveryStatus: 'Sent' as const,
      retryCount: 0,
      lastError: null,
      sentAt: '2026-10-09T11:05:00.000Z',
    },
  ],
};

beforeEach(() => vi.resetAllMocks());

describe('DeliveryStatusPage', () => {
  it('8a: should render warning summary and per-channel delivery table', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(sampleDelivery);

    renderWithApp(<DeliveryStatusPage />, {
      role: Role.DutyOfficer,
      route: '/warnings/10/delivery',
      path: '/warnings/:id/delivery',
    });

    expect(await screen.findByText('Warning #10 Broadcast & Delivery Tracking')).toBeInTheDocument();
    expect(screen.getByText('RescueTeamLeader')).toBeInTheDocument();
    expect(screen.getByText('Per-Channel Broadcast Log (1)')).toBeInTheDocument();
  });

  it('10a: should open correction modal when button is clicked', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(sampleDelivery);

    renderWithApp(<DeliveryStatusPage />, {
      role: Role.DutyOfficer,
      route: '/warnings/10/delivery',
      path: '/warnings/:id/delivery',
    });

    const correctBtn = await screen.findByRole('button', { name: /Correct \/ Withdraw Warning/i });
    await userEvent.click(correctBtn);

    expect(screen.getByText('Correct or Withdraw Warning #10')).toBeInTheDocument();
  });
});
