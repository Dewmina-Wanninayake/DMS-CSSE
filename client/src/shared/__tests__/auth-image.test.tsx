import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setAuthToken } from '../api/api-client';
import { AuthImage } from '../ui/AuthImage';

describe('AuthImage (photos behind login)', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it('should fetch the photo with the bearer token and show it from an object URL', async () => {
    setAuthToken('tok');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['x'])) });
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<AuthImage src="/api/v1/reports/5/photo" alt="Evidence" />);

    expect(screen.getByText('Loading photo…')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Evidence' })).toHaveAttribute(
      'src',
      'blob:photo',
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/reports/5/photo');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('should say so when the photo cannot be loaded, instead of a broken image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    render(<AuthImage src="/reports/5/photo" alt="Evidence" />);
    expect(await screen.findByText('The photo could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should report a network failure the same way', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(api.getBlob('/reports/5/photo')).rejects.toThrow('could not be reached');
  });
});
