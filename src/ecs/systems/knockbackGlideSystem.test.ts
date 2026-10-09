import { describe, expect, it } from 'vitest';
import type { Entity, World } from '../world';
import { GLIDE_SECONDS, KnockbackGlideSystem, startGlide } from './knockbackGlideSystem';

const character = (x: number, z: number) =>
  ({ transform: { pos: { x, y: 0, z }, rot: { x: 0, y: 0, z: 0 }, scale: 1, posOffset: { x: 0.5, y: 0, z: 0.5 } } }) as unknown as Entity;

describe('knockback glide', () => {
  it('draws a short shove from where it was, back to the tile centre', () => {
    const e = character(103, 100);
    expect(startGlide(e, { x: 100, y: 0, z: 100 })).toBe(true);
    // Drawn where it stood: the 3 tiles are lent to the offset.
    expect(e.transform!.posOffset!.x).toBeCloseTo(0.5 - 3);

    const system = KnockbackGlideSystem({} as World);
    system.update!(GLIDE_SECONDS / 2);
    expect(e.transform!.posOffset!.x).toBeGreaterThan(0.5 - 3);
    expect(e.transform!.posOffset!.x).toBeLessThan(0.5);
    system.update!(GLIDE_SECONDS);
    expect(e.transform!.posOffset!.x).toBeCloseTo(0.5);
    expect(e.transform!.posOffset!.z).toBeCloseTo(0.5);
  });

  it('leaves teleports and tiny corrections instant', () => {
    const far = character(150, 100);
    expect(startGlide(far, { x: 100, y: 0, z: 100 })).toBe(false);
    const near = character(100.5, 100);
    expect(startGlide(near, { x: 100, y: 0, z: 100 })).toBe(false);
  });
});
