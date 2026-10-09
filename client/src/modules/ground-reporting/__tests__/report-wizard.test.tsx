import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role, type HazardTypeOption, type ReportSummary } from '@dms/shared';
import { ApiError, NetworkError } from '../../../shared/api/api-client';
import { renderWithApp } from '../../../test/render';
import { groundReportingApi as api } from '../api/ground-reporting.api';
import { loadPendingReports } from '../lib/pending-reports';
import { LocationError, captureLocation } from '../lib/location';
import { ReportWizardPage } from '../pages/ReportWizardPage';

vi.mock('../api/ground-reporting.api');
vi.mock('../lib/location', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/location')>()),
  captureLocation: vi.fn(),
}));
vi.mock('../../../shared/ui/DistrictMap', async () => import('../../../test/DistrictMapMock'));

const types: HazardTypeOption[] = [
  { value: 'Flood', label: 'Rising river / flood', descriptionRequired: false },
  { value: 'Landslide', label: 'Landslide', descriptionRequired: false },
  { value: 'BlockedRoad', label: 'Blocked road', descriptionRequired: false },
  { value: 'Other', label: 'Other hazard', descriptionRequired: true },
];

const summary = (overrides: Partial<ReportSummary> = {}): ReportSummary => ({
  id: 41,
  hazardType: 'Flood',
  description: 'Water rising',
  status: 'Pending',
  syncStatus: 'Synced',
  districtName: 'Kegalle',
  locationSource: 'Gps',
  reportedAt: '2026-10-09T08:00:00.000Z',
  hasPhoto: false,
  duplicateOf: null,
  outcome: null,
  ...overrides,
});

const setOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });

beforeEach(() => {
  vi.resetAllMocks();
  setOnline(true);
  vi.mocked(api.hazardTypes).mockResolvedValue(types);
  vi.mocked(api.resolveLocation).mockResolvedValue({
    districtId: 1,
    code: 'KEG',
    name: 'Kegalle',
    province: 'Sabaragamuwa',
    distanceKm: 1.2,
  });
  vi.mocked(captureLocation).mockResolvedValue({ latitude: 7.25, longitude: 80.35 });
});

const open = () => renderWithApp(<ReportWizardPage />, { role: Role.Citizen, userId: 7 });
const next = () =>
  userEvent.click(screen.getByRole('button', { name: /^(Next|Continue without photo)$/ }));

/** Walks steps 1-4 with a flood, skipping the photo, and lands on the review step. */
async function reachReview(description = 'Water rising') {
  await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
  await next();
  if (description)
    await userEvent.type(screen.getByLabelText('Describe what you see'), description);
  await next();
  await next(); // photo is optional
  await screen.findByText(/Nearest district: Kegalle/);
  await next();
}

describe('Report wizard (steps 1-9, critique CV-003 #1)', () => {
  it('should count "Step n of 5" truthfully and never ask for severity', async () => {
    open();
    expect(await screen.findByText('Step 1 of 5')).toBeInTheDocument();
    expect(screen.queryByText(/severity/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Landslide' }));
    await next();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
    await next();
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
    await next();
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    await screen.findByText(/Nearest district/);
    await next();
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
  });

  it('8a: should require a hazard type before moving on', async () => {
    open();
    await next();
    expect(await screen.findByText('Choose what is happening.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('3a: should require a description for an other hazard and allow going back', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Other hazard' }));
    await next();
    expect(screen.getByText(/Required for other hazards/)).toBeInTheDocument();
    await next();
    expect(
      screen.getByText('Describe the hazard so the officer knows what it is.'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Describe what you see'), 'Sinkhole');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: 'Other hazard' })).toBeChecked();
    await next();
    expect(screen.getByLabelText('Describe what you see')).toHaveValue('Sinkhole');
  });

  it('should fall back to the shared hazard labels when the list cannot load', async () => {
    vi.mocked(api.hazardTypes).mockRejectedValue(new Error('offline'));
    open();
    expect(await screen.findByRole('radio', { name: 'Blocked road' })).toBeInTheDocument();
  });

  it('5: should add a photo, show its size and let the reporter remove it', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    expect(screen.getByRole('button', { name: 'Continue without photo' })).toBeInTheDocument();
    expect(screen.getByText('No photo added.')).toBeInTheDocument();

    const photo = new File(['abc'], 'river.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Take a photo'), photo);
    expect(await screen.findByText('Photo added')).toBeInTheDocument();
    expect(screen.getByText(/river\.jpg · 0\.0 MB of 2 MB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(screen.getByText('No photo added.')).toBeInTheDocument();
  });

  it('5a: should accept a gallery photo and refuse a file that is not an image', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await userEvent.upload(
      screen.getByLabelText('Choose a photo from your gallery'),
      new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
      { applyAccept: false },
    );
    expect(await screen.findByText(/Choose a photo \(JPEG or PNG\)/)).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText('Choose a photo from your gallery'),
      new File(['x'], 'ok.png', { type: 'image/png' }),
    );
    expect(await screen.findByText('Photo added')).toBeInTheDocument();
  });

  it('6: should capture GPS, show the district and ask the reporter to confirm', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await next();
    expect(await screen.findByText(/Nearest district: Kegalle/)).toHaveTextContent(
      'Location found by GPS',
    );
    expect(api.resolveLocation).toHaveBeenCalledWith(7.25, 80.35);
    expect(screen.getByText('Hazard location')).toBeInTheDocument();
  });

  it('6a: should offer a manual pin when GPS fails and record the source as Manual', async () => {
    vi.mocked(captureLocation).mockRejectedValue(
      new LocationError('Location access is turned off for this app.'),
    );
    vi.mocked(api.submit).mockResolvedValue(summary({ locationSource: 'Manual' }));
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await next();
    expect(await screen.findByText('We could not get your location')).toBeInTheDocument();
    expect(screen.getByText(/turned off for this app/)).toBeInTheDocument();

    await next();
    expect(screen.getByText('Confirm the location before you continue.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Drop test pin' }));
    expect(await screen.findByText(/Location set by pin/)).toBeInTheDocument();
    await next();
    expect(screen.getByText(/7\.2500, 80\.3500 \(pin\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    await screen.findByText('Report submitted', { selector: '.alert__title' });
    expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({ locationSource: 'Manual' }));
  });

  it('should let the reporter retry GPS or choose on the map instead', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await next();
    await screen.findByText(/Nearest district/);
    expect(screen.queryByRole('button', { name: 'Drop test pin' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Choose on the map instead' }));
    expect(screen.getByRole('button', { name: 'Drop test pin' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use my location again' }));
    expect(captureLocation).toHaveBeenCalledTimes(2);
  });

  it('7-12: should review, submit with the photo and confirm', async () => {
    vi.mocked(api.submit).mockResolvedValue(summary());
    vi.mocked(api.uploadPhoto).mockResolvedValue({ mimeType: 'image/jpeg', sizeBytes: 3 });
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await userEvent.type(screen.getByLabelText('Describe what you see'), 'Water rising');
    await next();
    await userEvent.upload(
      screen.getByLabelText('Take a photo'),
      new File(['abc'], 'river.jpg', { type: 'image/jpeg' }),
    );
    await screen.findByText('Photo added');
    await next();
    await screen.findByText(/Nearest district/);
    await next();

    expect(screen.getByText('Rising river / flood')).toBeInTheDocument();
    expect(screen.getByText('Water rising')).toBeInTheDocument();
    expect(screen.getByText('river.jpg')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(await screen.findByText(/A Duty Officer will check your report/)).toBeInTheDocument();
    const sent = vi.mocked(api.submit).mock.calls[0][0];
    expect(sent).toMatchObject({
      hazardType: 'Flood',
      description: 'Water rising',
      latitude: 7.25,
      longitude: 80.35,
      locationSource: 'Gps',
    });
    expect(sent).not.toHaveProperty('severity');
    expect(sent.clientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(api.uploadPhoto).toHaveBeenCalledWith(41, expect.any(Blob));
    expect(screen.getByRole('link', { name: 'View my reports' })).toHaveAttribute(
      'href',
      '/report/mine',
    );
  });

  it('should say when the photo could not be uploaded but the report was sent', async () => {
    vi.mocked(api.submit).mockResolvedValue(summary());
    vi.mocked(api.uploadPhoto).mockRejectedValue(new Error('too big'));
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await userEvent.upload(
      screen.getByLabelText('Take a photo'),
      new File(['abc'], 'r.jpg', { type: 'image/jpeg' }),
    );
    await screen.findByText('Photo added');
    await next();
    await screen.findByText(/Nearest district/);
    await next();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/photo could not be uploaded/)).toBeInTheDocument();
  });

  it('10a: should tell the reporter when the report was linked to an earlier one', async () => {
    vi.mocked(api.submit).mockResolvedValue(summary({ duplicateOf: 12 }));
    open();
    await reachReview('');
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/linked/)).toBeInTheDocument();
  });

  it('9a: should return to the step the server rejected and show its message', async () => {
    vi.mocked(api.submit).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'The request contains invalid data.', [
        { field: 'description', message: 'Use 200 characters or fewer.' },
      ]),
    );
    open();
    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('Use 200 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('should show other failures and stay on the review step', async () => {
    vi.mocked(api.submit).mockRejectedValue(new Error('Server error'));
    open();
    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
  });

  it('9b: should keep the report on the device as Pending Sync when the network drops', async () => {
    vi.mocked(api.submit).mockRejectedValue(new NetworkError());
    open();
    await reachReview();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/Saved offline, Pending Sync/)).toBeInTheDocument();
    const saved = loadPendingReports(7);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      hazardType: 'Flood',
      description: 'Water rising',
      ownerId: 7,
    });
  });

  it('9b: should save straight to the device while offline, with the photo', async () => {
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await userEvent.upload(
      screen.getByLabelText('Take a photo'),
      new File(['abc'], 'r.png', { type: 'image/png' }),
    );
    await screen.findByText('Photo added');
    await next();
    await screen.findByText(/Nearest district/);
    await next();
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
    expect(
      await screen.findByText(/You are offline\. You can still write your report/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/Saved offline, Pending Sync/)).toBeInTheDocument();
    expect(api.submit).not.toHaveBeenCalled();
    expect(loadPendingReports(7)[0].photo?.mimeType).toBe('image/png');
  });

  it('should keep the report and drop the photo when the device is too full for both', async () => {
    setOnline(false);
    open();
    await userEvent.click(await screen.findByRole('radio', { name: 'Rising river / flood' }));
    await next();
    await next();
    await userEvent.upload(
      screen.getByLabelText('Take a photo'),
      new File(['abc'], 'r.png', { type: 'image/png' }),
    );
    await screen.findByText('Photo added');
    await next();
    await screen.findByText(/Nearest district/);
    await next();
    const real = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (value.includes('data:image')) throw new Error('quota');
      return real.call(this, key, value);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/photo could not be kept on this device/)).toBeInTheDocument();
    expect(loadPendingReports(7)[0].photo).toBeUndefined();
    setItem.mockRestore();
  });

  it('should say so when nothing can be saved on the device', async () => {
    setOnline(false);
    open();
    await reachReview();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await userEvent.click(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText(/no space to save the report/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Step 5 of 5')).toBeInTheDocument());
    vi.restoreAllMocks();
  });
});
