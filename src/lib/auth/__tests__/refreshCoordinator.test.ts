import { describe, expect, it, vi } from 'vitest';
import { createRefreshCoordinator } from '../refreshCoordinator';

/**
 * This is the piece the brief explicitly asks us to have an opinion on: "decide what
 * your app does when the token expires mid session". The risk being tested here is a
 * race between the proactive refresh timer and a reactive 401-retry landing at the
 * same moment -- without coalescing, both would call /auth/refresh, and DummyJSON
 * would happily hand back two different valid token pairs, silently invalidating
 * whichever one is applied first.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createRefreshCoordinator', () => {
  it('coalesces concurrent refresh() calls into a single network request', async () => {
    const gate = deferred<{ accessToken: string; refreshToken: string }>();
    const refreshRequest = vi.fn().mockReturnValue(gate.promise);
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const coordinator = createRefreshCoordinator({
      refreshRequest,
      getRefreshToken: () => 'stored-refresh-token',
      onSuccess,
      onFailure,
    });

    // Three "triggers" landing at once: the proactive timer plus two 401 retries.
    const results = Promise.all([
      coordinator.refresh(),
      coordinator.refresh(),
      coordinator.refresh(),
    ]);

    expect(refreshRequest).toHaveBeenCalledTimes(1);

    gate.resolve({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(await results).toEqual([true, true, true]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });

  it('allows a new refresh after the previous one has settled', async () => {
    const refreshRequest = vi
      .fn()
      .mockResolvedValueOnce({ accessToken: 'first', refreshToken: 'first-r' })
      .mockResolvedValueOnce({ accessToken: 'second', refreshToken: 'second-r' });

    const coordinator = createRefreshCoordinator({
      refreshRequest,
      getRefreshToken: () => 'stored-refresh-token',
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    await coordinator.refresh();
    await coordinator.refresh();

    expect(refreshRequest).toHaveBeenCalledTimes(2);
  });

  it('reports failure and calls onFailure exactly once for concurrent callers when the request rejects', async () => {
    const onFailure = vi.fn();
    const coordinator = createRefreshCoordinator({
      refreshRequest: vi.fn().mockRejectedValue(new Error('refresh token expired')),
      getRefreshToken: () => 'stored-refresh-token',
      onSuccess: vi.fn(),
      onFailure,
    });

    const results = await Promise.all([coordinator.refresh(), coordinator.refresh()]);

    expect(results).toEqual([false, false]);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('fails fast without a network call when there is no refresh token to send', async () => {
    const refreshRequest = vi.fn();
    const onFailure = vi.fn();
    const coordinator = createRefreshCoordinator({
      refreshRequest,
      getRefreshToken: () => null,
      onSuccess: vi.fn(),
      onFailure,
    });

    expect(await coordinator.refresh()).toBe(false);
    expect(refreshRequest).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
