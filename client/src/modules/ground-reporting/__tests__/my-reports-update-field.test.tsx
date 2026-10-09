import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type ReportDetail, type ReportSummary } from '@dms/shared';
import { ApiError, NetworkError } from '../../../shared/api/api-client';
import { renderWithApp } from '../../../test/render';
import { groundReportingApi as api } from '../api/ground-reporting.api';
import { loadPendingReports, savePendingReport } from '../lib/pending-reports';
import { FieldUpdatePage } from '../pages/FieldUpdatePage';
import { MyReportsPage } from '../pages/MyReportsPage';
import { UpdateReportPage } from '../pages/UpdateReportPage';
import { groundReportingModule } from '../module';

vi.mock('../api/ground-reporting.api');

const report = (overrides: Partial<ReportSummary> = {}): ReportSummary => ({
  id: 1,
  hazardType: 'Flood',
  description: 'Water rising',
  status: 'Pending',
  syncStatus: 'Synced',
  districtName: 'Kegalle',
  locationSource: 'Gps',
  reportedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  hasPhoto: false,
  duplicateOf: null,
  outcome: null,
  ...overrides,
});

const page = (items: ReportSummary[]) => ({
  items,
  meta: { page: 1, pageSize: 50, total: items.length },
});

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });

const queued = (clientId: string, overrides = {}) => ({
  clientId,
  ownerId: 7,
  savedAt: '2026-10-09T08:00:00.000Z',
  hazardType: 'Landslide' as const,
  description: 'Crack in the road',
  latitude: 7.25,
  longitude: 80.35,
  locationSource: 'Gps' as const,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  setOnline(true);
});

describe('My Reports (critique CV-003 #5: five states)', () => {
  const open = () => renderWithApp(<MyReportsPage />, { role: Role.Citizen, userId: 7 });

  it('should show Pending, Verified, Rejected and More information needed with their outcomes', async () => {
    vi.mocked(api.mine).mockResolvedValue(
      page([
        report({ id: 1 }),
        report({
          id: 2,
          status: 'Verified',
          outcome: { message: 'Your report was verified.', at: 'x' },
        }),
        report({
          id: 3,
          status: 'Rejected',
          outcome: { message: 'Rejected: duplicate of a known issue.', at: 'x' },
        }),
        report({
          id: 4,
          status: 'NeedsInformation',
          outcome: { message: 'Please add a photo.', at: 'x' },
        }),
      ]),
    );
    open();

    const list = within(await screen.findByRole('list', { name: 'Sent reports' }));
    expect(list.getByText('Pending')).toBeInTheDocument();
    expect(list.getByText('Verified')).toBeInTheDocument();
    expect(list.getByText('Rejected')).toBeInTheDocument();
    expect(list.getByText('More information needed')).toBeInTheDocument();
    expect(list.getByText(/Waiting for a Duty Officer/)).toBeInTheDocument();
    expect(list.getByText(/Your report was verified\./)).toBeInTheDocument();
    expect(list.getByText(/Rejected: duplicate of a known issue\./)).toBeInTheDocument();
    expect(list.getByRole('link', { name: 'Update report 4' })).toHaveAttribute(
      'href',
      '/report/4/update',
    );
    expect(list.getAllByRole('link')).toHaveLength(1); // only the NeedsInformation report offers an update
  });

  it('9b: should show reports waiting on this device as Pending Sync, with any refusal', async () => {
    savePendingReport(queued('a'));
    savePendingReport(queued('b', { conflictMessage: 'Latitude is outside Sri Lanka.' }));
    savePendingReport({ ...queued('c'), ownerId: 99 });
    setOnline(false);
    vi.mocked(api.mine).mockResolvedValue(page([]));
    open();

    const device = within(
      await screen.findByRole('list', { name: 'Reports saved on this device' }),
    );
    expect(device.getAllByText('Pending Sync')).toHaveLength(2);
    expect(device.getByText(/will upload when you are online/)).toBeInTheDocument();
    expect(
      device.getByText(/Could not be sent: Latitude is outside Sri Lanka\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    expect(screen.queryByText('You have not reported anything yet')).not.toBeInTheDocument();
  });

  it('should upload queued reports when online, then reload the list and say how many were sent', async () => {
    savePendingReport(queued('a'));
    vi.mocked(api.mine).mockResolvedValueOnce(page([]));
    vi.mocked(api.mine).mockResolvedValueOnce(page([report({ id: 9 })]));
    vi.mocked(api.sync).mockResolvedValue([
      { clientId: 'a', outcome: 'Created', report: report({ id: 9 }) },
    ]);
    open();

    expect(await screen.findByText(/1 saved report was sent\./)).toBeInTheDocument();
    expect(api.sync).toHaveBeenCalledWith([expect.objectContaining({ clientId: 'a' })]);
    expect(loadPendingReports(7)).toEqual([]);
    expect(await screen.findByRole('list', { name: 'Sent reports' })).toBeInTheDocument();
  });

  it('should upload the queued photo after the report is created, and count a failed photo', async () => {
    savePendingReport(
      queued('a', { photo: { dataUrl: 'data:image/png;base64,AAEC', mimeType: 'image/png' } }),
    );
    vi.mocked(api.mine).mockResolvedValue(page([]));
    vi.mocked(api.sync).mockResolvedValue([
      { clientId: 'a', outcome: 'Created', report: report({ id: 9 }) },
    ]);
    vi.mocked(api.uploadPhoto).mockRejectedValue(new Error('too large'));
    open();
    expect(await screen.findByText(/1 photo could not be uploaded/)).toBeInTheDocument();
    expect(api.uploadPhoto).toHaveBeenCalledWith(9, expect.any(Blob));
  });

  it('should treat an already stored report as sent and keep refused ones with the reason', async () => {
    savePendingReport(queued('existing'));
    savePendingReport(queued('bad', { savedAt: '2026-10-09T09:00:00.000Z' }));
    savePendingReport(queued('mine-by-someone-else', { savedAt: '2026-10-09T10:00:00.000Z' }));
    vi.mocked(api.mine).mockResolvedValue(page([]));
    vi.mocked(api.sync).mockResolvedValue([
      { clientId: 'existing', outcome: 'Existing', report: report() },
      {
        clientId: 'bad',
        outcome: 'Invalid',
        errors: [{ field: 'latitude', message: 'Outside Sri Lanka.' }],
      },
      { clientId: 'mine-by-someone-else', outcome: 'Conflict' },
    ]);
    open();

    expect(await screen.findByText(/Could not be sent: Outside Sri Lanka\./)).toBeInTheDocument();
    expect(screen.getByText(/belongs to another account/)).toBeInTheDocument();
    expect(api.uploadPhoto).not.toHaveBeenCalled();
    expect(loadPendingReports(7).map((r) => r.clientId)).toEqual(['bad', 'mine-by-someone-else']);
  });

  it('should stay quiet while offline and show a sync error otherwise', async () => {
    savePendingReport(queued('a'));
    vi.mocked(api.mine).mockResolvedValue(page([]));
    vi.mocked(api.sync).mockRejectedValueOnce(new NetworkError());
    const { unmount } = open();
    await waitFor(() => expect(api.sync).toHaveBeenCalled());
    expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
    expect(loadPendingReports(7)).toHaveLength(1);
    unmount();

    vi.mocked(api.sync).mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Sync is down.'));
    open();
    expect(await screen.findByText('Sync is down.')).toBeInTheDocument();
  });

  it('should show the empty, loading and error states', async () => {
    vi.mocked(api.mine).mockResolvedValueOnce(page([]));
    const { unmount } = open();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your reports');
    expect(await screen.findByText('You have not reported anything yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a hazard' })).toHaveAttribute(
      'href',
      '/report',
    );
    unmount();

    vi.mocked(api.mine).mockRejectedValueOnce(new Error('boom'));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });
});

describe('Update report (13a)', () => {
  const detail = (overrides: Partial<ReportDetail> = {}): ReportDetail => ({
    ...report({
      id: 4,
      status: 'NeedsInformation',
      outcome: { message: 'Please add a photo.', at: 'x' },
    }),
    latitude: 7.25,
    longitude: 80.35,
    updates: [],
    ...overrides,
  });
  const open = () =>
    renderWithApp(<UpdateReportPage />, {
      role: Role.Citizen,
      userId: 7,
      route: '/report/4/update',
      path: '/report/:id/update',
    });

  it('should show what the officer asked and resubmit with the new text and photo', async () => {
    vi.mocked(api.get).mockResolvedValue(detail());
    vi.mocked(api.update).mockResolvedValue(detail({ status: 'Pending' }));
    vi.mocked(api.uploadPhoto).mockResolvedValue({ mimeType: 'image/jpeg', sizeBytes: 3 });
    open();

    expect(await screen.findByText('Please add a photo.')).toBeInTheDocument();
    const description = screen.getByLabelText('Description');
    expect(description).toHaveValue('Water rising');
    await userEvent.clear(description);
    await userEvent.type(description, 'Water is now at the door');
    await userEvent.upload(
      screen.getByLabelText('Choose a photo to add'),
      new File(['abc'], 'door.jpg', { type: 'image/jpeg' }),
    );
    expect(await screen.findByText('door.jpg')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resubmit report' }));

    expect(
      await screen.findByText('Your report is back with the Duty Officer.'),
    ).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith(4, { description: 'Water is now at the door' });
    expect(api.uploadPhoto).toHaveBeenCalledWith(4, expect.any(Blob));
  });

  it('should resubmit with only a new photo, keeping the existing description', async () => {
    vi.mocked(api.get).mockResolvedValue(detail());
    vi.mocked(api.update).mockResolvedValue(detail({ status: 'Pending' }));
    vi.mocked(api.uploadPhoto).mockRejectedValue(new Error('too big'));
    open();
    await userEvent.upload(
      await screen.findByLabelText('Choose a photo to add'),
      new File(['abc'], 'a.png', { type: 'image/png' }),
    );
    await screen.findByText('a.png');
    expect(screen.getByRole('button', { name: 'Choose a different photo' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resubmit report' }));
    expect(await screen.findByText(/new photo could not be uploaded/)).toBeInTheDocument();
    expect(api.update).toHaveBeenCalledWith(4, { description: 'Water rising' });
  });

  it('should refuse a file that is not an image', async () => {
    vi.mocked(api.get).mockResolvedValue(detail());
    open();
    await userEvent.upload(
      await screen.findByLabelText('Choose a photo to add'),
      new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
      { applyAccept: false },
    );
    expect(await screen.findByText(/Choose a photo \(JPEG or PNG\)/)).toBeInTheDocument();
  });

  it('should show a server refusal and keep the form', async () => {
    vi.mocked(api.get).mockResolvedValue(detail());
    vi.mocked(api.update).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', [
        { field: 'description', message: 'Use 200 characters or fewer.' },
      ]),
    );
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Resubmit report' }));
    expect((await screen.findAllByText('Use 200 characters or fewer.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Resubmit report' })).toBeInTheDocument();
  });

  it('should explain that only a report needing information can be changed', async () => {
    vi.mocked(api.get).mockResolvedValue(detail({ status: 'Verified' }));
    open();
    expect(await screen.findByText('This report cannot be updated')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resubmit report' })).not.toBeInTheDocument();
  });

  it('should show loading and error states', async () => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Not your report.'));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Not your report.');
  });
});

describe('Field update (13c, critique CV-003 #7)', () => {
  const open = () => renderWithApp(<FieldUpdatePage />, { role: Role.Volunteer, userId: 8 });

  it('should add a note to a report and confirm', async () => {
    vi.mocked(api.addFieldUpdate).mockResolvedValue({
      id: 1,
      kind: 'VolunteerFieldUpdate',
      note: 'Water over the bridge',
      authorName: 'V',
      createdAt: 'x',
    });
    open();
    await userEvent.type(screen.getByLabelText('Report number'), '12');
    await userEvent.type(screen.getByLabelText('Field note'), ' Water over the bridge ');
    await userEvent.click(screen.getByRole('button', { name: 'Add field update' }));

    expect(await screen.findByText('Your note was added to report 12.')).toBeInTheDocument();
    expect(api.addFieldUpdate).toHaveBeenCalledWith(12, { note: 'Water over the bridge' });
    expect(screen.getByLabelText('Field note')).toHaveValue('');
  });

  it('should highlight missing or invalid fields without calling the server', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Add field update' }));
    expect(screen.getByText('Enter the report number.')).toBeInTheDocument();
    expect(screen.getByText('Write a short note about what you see.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Report number'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Add field update' }));
    expect(screen.getByText('Enter the report number.')).toBeInTheDocument();
    expect(api.addFieldUpdate).not.toHaveBeenCalled();
  });

  it('should explain when the volunteer is not certified for the area', async () => {
    vi.mocked(api.addFieldUpdate).mockRejectedValue(
      new ApiError(
        403,
        'NOT_CERTIFIED_FOR_AREA',
        'You are not certified for Kegalle, so you cannot add field updates there.',
      ),
    );
    open();
    await userEvent.type(screen.getByLabelText('Report number'), '12');
    await userEvent.type(screen.getByLabelText('Field note'), 'Looks bad');
    await userEvent.click(screen.getByRole('button', { name: 'Add field update' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not certified for Kegalle');
    expect(screen.getByLabelText('Report number')).toHaveValue('12');
  });
});

describe('module registration', () => {
  it('should give citizens two tabs, volunteers a third, and guard every route', () => {
    const labels = (role: string) =>
      groundReportingModule.nav
        .filter((item) => item.roles.includes(role as never))
        .map((item) => item.label);
    expect(labels('Citizen')).toEqual(['Report hazard', 'My reports']);
    expect(labels('Volunteer')).toEqual(['Report hazard', 'My reports', 'Field update']);
    expect(labels('DutyOfficer')).toEqual([]);
    expect(groundReportingModule.routes.map((route) => route.path)).toEqual([
      '/report',
      '/report/mine',
      '/report/field-update',
      '/report/:id/update',
    ]);
  });
});
