import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearGameTimeout, gameTimeout } from './backgroundPump';

describe('gameTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires once, after its delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    gameTimeout(fn, 100);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not fire once cleared', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const id = gameTimeout(fn, 100);
    clearGameTimeout(id);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores a clear of nothing', () => {
    expect(() => clearGameTimeout(null)).not.toThrow();
    expect(() => clearGameTimeout(12345)).not.toThrow();
  });
});
