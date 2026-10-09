import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/reportVerificationApi';
import { SecondApproverPage } from '../pages/SecondApproverPage';

vi.mock('../api/reportVerificationApi');

const sampleQueue = {
  reports: [],
  pendingApprovals: [
    {
      id: 10,
      level: 'Warning' as const,
      hazardType: 'Flood' as const,
      reason: 'Water level critical in Kelani river basin',
      status: 'PendingApproval' as const,
      estimatedAudience: 2326000,
      createdAt: '2026-10-09T11:00:00.000Z',
    },
  ],
};

beforeEach(() => vi.resetAllMocks());

describe('SecondApproverPage', () => {
  it('7a: should render pending approval list and allow approval', async () => {
    vi.mocked(api.getQueue).mockResolvedValue(sampleQueue);
    vi.mocked(api.approveWarning).mockResolvedValue({
      id: 10,
      reportId: 1,
      hazardType: 'Flood',
      level: 'Warning',
      reason: 'Water level critical in Kelani river basin',
      language: 'Sinhala',
      status: 'Issued',
      syncStatus: 'Synced',
      areaIds: [1],
      areaNames: ['Colombo'],
      channels: ['Push'],
      estimatedAudience: 2326000,
      createdBy: 1,
      issuedAt: '2026-10-09T12:00:00.000Z',
      createdAt: '2026-10-09T11:00:00.000Z',
    });

    renderWithApp(<SecondApproverPage />, { role: Role.SecondApprover });

    expect(await screen.findByText('Second Approver Authorization Queue')).toBeInTheDocument();
    expect(screen.getByText(/Water level critical/)).toBeInTheDocument();

    const card = screen.getByText('Warning #10');
    await userEvent.click(card);

    const approveBtn = screen.getByRole('button', { name: /Approve & Broadcast/i });
    await userEvent.click(approveBtn);

    expect(api.approveWarning).toHaveBeenCalledWith(10, expect.objectContaining({ decision: 'Approved' }));
  });
});
