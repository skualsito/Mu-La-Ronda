import { describe, expect, it } from 'vitest';
import { FramePacer } from './fpsLimit';

/** Frames drawn in one second of a `hz` monitor under `limit`. */
function drawn(hz: number, limit: number): number {
  const pacer = new FramePacer();
  let count = 0;
  for (let i = 0; i < hz; i++) if (pacer.due((i * 1000) / hz, limit)) count++;
  return count;
}

describe('FramePacer', () => {
  it('draws every frame when uncapped', () => {
    expect(drawn(144, 0)).toBe(144);
  });

  it('caps to the limit on a faster monitor', () => {
    expect(drawn(144, 60)).toBeGreaterThanOrEqual(59);
    expect(drawn(144, 60)).toBeLessThanOrEqual(61);
    expect(drawn(60, 30)).toBe(30);
  });

  it('averages a cap that does not divide the refresh rate', () => {
    expect(Math.abs(drawn(60, 45) - 45)).toBeLessThanOrEqual(1);
  });

  it('does not drop frames when the cap equals the refresh rate', () => {
    expect(drawn(60, 60)).toBe(60);
  });
});
