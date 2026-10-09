import { describe, expect, it } from 'vitest';
import { cachedTint } from './core';

describe('cachedTint', () => {
  it('rounds a flickering tint to a few materials, not one a frame', () => {
    const keys = new Set<string>();
    for (let frame = 0; frame < 1000; frame++) {
      const flicker = 0.85 + 0.15 * Math.sin(frame / 7);
      keys.add(cachedTint([1.6 * flicker, 0.4 * flicker, 0.2 * flicker]).join(','));
    }
    expect(keys.size).toBeLessThan(25);
  });

  it('keeps the colour within half a step, the gain applied', () => {
    const [r, g, b] = cachedTint([0.5, 0.25, 0.1], 2);
    expect(r).toBeCloseTo(1, 1);
    expect(g).toBeCloseTo(0.5, 1);
    expect(Math.abs(b - 0.2)).toBeLessThanOrEqual(1 / 64);
  });
});
