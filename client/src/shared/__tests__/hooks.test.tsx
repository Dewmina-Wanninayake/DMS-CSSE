import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsync } from '../hooks/useAsync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

describe('useAsync', () => {
  it('should move from loading to data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve('ok'), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ data: 'ok', error: undefined });
  });

  it('should expose the error and recover on reload', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('back');
    const { result } = renderHook(() => useAsync(loader, []));
    await waitFor(() => expect(result.current.error?.message).toBe('down'));
    expect(result.current.data).toBeUndefined();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe('back'));
    expect(result.current.error).toBeUndefined();
  });

  it('should wrap non-Error rejections', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.reject('text'), []));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.error?.message).toBe('text');
  });

  it('should reload when dependencies change and ignore a superseded response', async () => {
    let resolveSlow: (value: string) => void = () => {};
    const loader = vi.fn((id: number) =>
      id === 1
        ? new Promise<string>((resolve) => (resolveSlow = resolve))
        : Promise.resolve('fast'),
    );
    const { result, rerender } = renderHook(({ id }) => useAsync(() => loader(id), [id]), {
      initialProps: { id: 1 },
    });
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.data).toBe('fast'));
    await act(async () => resolveSlow('stale'));
    expect(result.current.data).toBe('fast');
  });
});

describe('useOnlineStatus', () => {
  it('should follow the browser online and offline events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    const online = vi.spyOn(navigator, 'onLine', 'get');

    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);

    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
    online.mockRestore();
  });
});
