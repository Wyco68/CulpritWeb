import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResendCooldown } from '../use-resend-cooldown';

describe('useResendCooldown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is idle until started, then counts down to zero', () => {
    const { result } = renderHook(() => useResendCooldown({ seconds: 3 }));
    expect(result.current.remaining).toBe(0);

    act(() => result.current.start());
    expect(result.current.remaining).toBe(3);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remaining).toBe(2);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.remaining).toBe(0);
  });

  it('can start active, for a step entered right after a send', () => {
    const { result } = renderHook(() => useResendCooldown({ seconds: 30, startActive: true }));
    expect(result.current.remaining).toBe(30);
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.remaining).toBe(0);
  });
});
