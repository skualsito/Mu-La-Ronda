import { describe, expect, it } from 'vitest';
import { secondsToNext } from './fixedSchedule';

describe('secondsToNext', () => {
  const times = [[8, 0], [20, 0]] as const;

  it('counts to the next start of the day, or of the next day', () => {
    expect(secondsToNext(times, Date.UTC(2026, 9, 7, 7, 0))).toBe(3600);
    expect(secondsToNext(times, Date.UTC(2026, 9, 7, 21, 0))).toBe(11 * 3600);
  });

  it('skips the day it never runs on', () => {
    // Saturday 2026-10-10 21:00 UTC: Sunday is skipped, so Monday 08:00.
    expect(secondsToNext(times, Date.UTC(2026, 9, 10, 21, 0), 0)).toBe(35 * 3600);
    expect(secondsToNext(times, Date.UTC(2026, 9, 10, 21, 0))).toBe(11 * 3600);
  });
});
