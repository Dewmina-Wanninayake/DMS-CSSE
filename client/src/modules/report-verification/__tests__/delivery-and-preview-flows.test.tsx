import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type WarningPreview } from '@dms/shared';
import { renderWithApp } from '../../../test/render';
import { reportVerificationApi as api } from '../api/report-verification.api';
import { reportVerificationModule } from '../module';
import { DeliveryStatusPage } from '../pages/DeliveryStatusPage';
import { ReportReviewPage } from '../pages/ReportReviewPage';
import { WarningPreviewPage } from '../pages/WarningPreviewPage';

vi.mock('../api/report-verification.api');
vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

const warning = {
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
};

const delivery = (rows: object[] = []) => ({ warning, deliveries: rows as never[] });

const review = {
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
  evidence: { sufficient: true, hasGps: true, hasPhoto: false, corroborationCount: 1, reasons: [] },
  decision: 'Verified' as const,
  notes: null,
};

const preview = (overrides: Partial<WarningPreview> = {}): WarningPreview => ({
  estimatedAudience: 5000,
  requiresAudienceConfirm: false,
  requiresApproval: false,
  districts: [{ id: 1, name: 'Colombo', population: 5000 }],
  warningCriteria: {
    hazardType: 'Flood',
    riskThreshold: 8,
    mediumRatio: 0.5,
    minDataPoints: 3,
    sourcePolicyKey: null,
  },
  language: 'Sinhala',
  channels: ['Push'],
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe('DeliveryStatusPage', () => {
  const open = (role: Role = Role.DutyOfficer) =>
    renderWithApp(<DeliveryStatusPage />, {
      role,
      route: '/warnings/10/delivery',
      path: '/warnings/:id/delivery',
    });

  it('14a: should send the correction to the server, refresh and confirm', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(delivery());
    vi.mocked(api.correctWarning).mockResolvedValue({ ...warning, status: 'Corrected' });
    open(Role.SecondApprover);

    await userEvent.click(
      await screen.findByRole('button', { name: /Correct or withdraw warning/ }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.selectOptions(dialog.getByLabelText(/New warning level/), 'AllClear');
    await userEvent.type(dialog.getByLabelText('Reason for the correction'), 'Hazard has passed');
    await userEvent.click(dialog.getByRole('button', { name: 'Apply correction' }));

    expect(await screen.findByText('Warning corrected successfully.')).toBeInTheDocument();
    expect(api.correctWarning).toHaveBeenCalledWith(10, {
      action: 'Correct',
      level: 'AllClear',
      reason: 'Hazard has passed',
    });
    expect(api.getWarningDelivery).toHaveBeenCalledTimes(2);
  });

  it('should send a withdrawal and say so', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(delivery());
    vi.mocked(api.correctWarning).mockResolvedValue({ ...warning, status: 'Withdrawn' });
    open(Role.SecondApprover);
    await userEvent.click(
      await screen.findByRole('button', { name: /Correct or withdraw warning/ }),
    );
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.click(dialog.getByRole('radio', { name: 'Withdraw warning' }));
    await userEvent.click(dialog.getByRole('button', { name: 'Withdraw warning' }));
    expect(await screen.findByText('Warning has been withdrawn.')).toBeInTheDocument();
  });

  it('14a: should show the refusal in the dialog and send no refresh when the officer may not correct', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(delivery());
    vi.mocked(api.correctWarning).mockRejectedValue(
      new Error(
        'A Second Approver must confirm a correction or withdrawal of a Warning or Emergency.',
      ),
    );
    open();
    await userEvent.click(
      await screen.findByRole('button', { name: /Correct or withdraw warning/ }),
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Apply correction' }),
    );
    expect(await screen.findByText(/Second Approver must confirm/)).toBeInTheDocument();
    expect(api.getWarningDelivery).toHaveBeenCalledTimes(1);
  });

  it('should list failed deliveries with their retry count and refresh on request', async () => {
    vi.mocked(api.getWarningDelivery).mockResolvedValue(
      delivery([
        {
          id: 1,
          channel: 'SMS',
          recipient: 'RescueTeamLeader',
          deliveryStatus: 'Failed',
          retryCount: 2,
          lastError: 'gateway down',
          sentAt: null,
        },
        {
          id: 2,
          channel: 'Push',
          recipient: 'RescueTeamLeader',
          deliveryStatus: 'Pending',
          retryCount: 0,
          lastError: null,
          sentAt: null,
        },
      ]),
    );
    open();
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText(/gateway down/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh delivery status' }));
    await waitFor(() => expect(api.getWarningDelivery).toHaveBeenCalledTimes(2));
  });

  it('should show the error state with retry', async () => {
    vi.mocked(api.getWarningDelivery).mockRejectedValueOnce(new Error('down'));
    vi.mocked(api.getWarningDelivery).mockResolvedValueOnce(delivery());
    open();
    expect(await screen.findByText('down')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Warning #10 delivery')).toBeInTheDocument();
  });
});

describe('WarningPreviewPage', () => {
  const open = () =>
    renderWithApp(<WarningPreviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1/warn',
      path: '/verification/reports/:id/warn',
    });

  it('should block a short reason and an empty channel list', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(review);
    vi.mocked(api.previewWarning).mockResolvedValue(preview());
    open();

    const reason = await screen.findByLabelText(/Reason and advice for the public/i);
    await userEvent.click(screen.getByRole('button', { name: 'Issue warning' }));
    expect(await screen.findByText(/Warning reason is required/)).toBeInTheDocument();

    await userEvent.type(reason, 'Water is over the road');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Push' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
    await userEvent.click(screen.getByRole('button', { name: 'Issue warning' }));
    expect(
      await screen.findByText(/At least one notification broadcast channel/),
    ).toBeInTheDocument();
    expect(api.createWarning).not.toHaveBeenCalled();
    expect(screen.getByText(/Active Policy Thresholds/).parentElement).toHaveTextContent(
      'threshold 8',
    );
  });

  it('should issue a small-audience warning and open its delivery page', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(review);
    vi.mocked(api.previewWarning).mockResolvedValue(preview());
    vi.mocked(api.createWarning).mockResolvedValue({ ...warning, id: 77 });
    open();

    await userEvent.type(
      await screen.findByLabelText(/Reason and advice for the public/i),
      'Water is over the road',
    );
    await userEvent.selectOptions(screen.getByLabelText('Message language'), 'Tamil');
    await userEvent.click(screen.getByRole('checkbox', { name: 'AudibleAlert' }));
    await userEvent.click(screen.getByRole('button', { name: 'Issue warning' }));

    expect(await screen.findByText('other page')).toBeInTheDocument();
    expect(api.createWarning).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 1,
        areaIds: [1],
        language: 'Tamil',
        channels: ['Push', 'SMS', 'AudibleAlert'],
        confirmedAudience: true,
        pendingSync: false,
      }),
    );
  });

  it('should confirm a large audience before sending, and show a failed send', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(review);
    vi.mocked(api.previewWarning).mockResolvedValue(
      preview({
        estimatedAudience: 2326000,
        requiresAudienceConfirm: true,
        requiresApproval: true,
      }),
    );
    vi.mocked(api.createWarning).mockRejectedValue(new Error('Gateway unavailable'));
    open();

    await userEvent.type(
      await screen.findByLabelText(/Reason and advice for the public/i),
      'Severe flooding expected',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send for second approval' }));
    expect(await screen.findByText('Confirm large audience')).toBeInTheDocument();
    expect(screen.getByText(/Second approver required/)).toBeInTheDocument();
    expect(api.createWarning).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Yes, send the warning' }));
    expect(await screen.findByText('Gateway unavailable')).toBeInTheDocument();
  });

  it('should let the officer cancel the audience confirmation', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(review);
    vi.mocked(api.previewWarning).mockResolvedValue(
      preview({ estimatedAudience: 2326000, requiresAudienceConfirm: true }),
    );
    open();
    await userEvent.type(
      await screen.findByLabelText(/Reason and advice for the public/i),
      'Severe flooding expected',
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Issue warning|Send for second approval/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Confirm large audience')).not.toBeInTheDocument(),
    );
  });

  it('should recalculate the audience when the level changes and survive a failed preview', async () => {
    vi.mocked(api.getReportReview).mockResolvedValue(review);
    vi.mocked(api.previewWarning).mockResolvedValueOnce(preview());
    vi.mocked(api.previewWarning).mockRejectedValue(new Error('preview failed'));
    open();
    await userEvent.selectOptions(await screen.findByLabelText('Warning level'), 'Advisory');
    expect(await screen.findByText(/Select target parameters to preview/)).toBeInTheDocument();
    expect(api.previewWarning).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'Advisory' }),
    );
  });
});

describe('ReportReviewPage', () => {
  it('should show the error state when the report cannot be loaded', async () => {
    vi.mocked(api.getReportReview).mockRejectedValue(new Error('Report 1 was not found.'));
    renderWithApp(<ReportReviewPage />, {
      role: Role.DutyOfficer,
      route: '/verification/reports/1',
      path: '/verification/reports/:id',
    });
    expect(await screen.findByText('Report 1 was not found.')).toBeInTheDocument();
  });
});

describe('module registration', () => {
  it('should give officers the queue and both roles the approvals, and guard every route', () => {
    const labels = (role: string) =>
      reportVerificationModule.nav
        .filter((item) => item.roles.includes(role as never))
        .map((item) => item.label);
    expect(labels('DutyOfficer')).toEqual(['Verification Queue', 'Warning Approvals']);
    expect(labels('SecondApprover')).toEqual(['Verification Queue', 'Warning Approvals']);
    expect(labels('Citizen')).toEqual([]);
    expect(reportVerificationModule.routes.map((route) => route.path)).toEqual([
      '/verification',
      '/verification/reports/:id',
      '/verification/reports/:id/warn',
      '/verification/approvals',
      '/warnings/:id/delivery',
    ]);
  });
});
