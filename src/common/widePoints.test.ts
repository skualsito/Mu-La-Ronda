import { describe, expect, it } from 'vitest';
import { pointsFromWire, readPointsLine } from './widePoints';

describe('wide free points', () => {
  it('reads the hidden server line', () => {
    expect(readPointsLine('Puntos libres: 123456')).toBe(123456);
    expect(readPointsLine('Puntos libres: abc')).toBeNull();
    expect(readPointsLine('Hola')).toBeNull();
  });

  it('takes the packet as is while the points fit', () => {
    expect(pointsFromWire(500, 0)).toBe(500);
    expect(pointsFromWire(65535, 65000)).toBe(65535);
  });

  it('keeps the high part past 65 535', () => {
    // 70 000 held; a level-up adds 5: the packet says (70 005 & 0xffff) = 4 469.
    expect(pointsFromWire(70005 & 0xffff, 70000)).toBe(70005);
    // Spending across a 65 536 boundary.
    expect(pointsFromWire(131070 & 0xffff, 131080)).toBe(131070);
    expect(pointsFromWire(65530, 65540)).toBe(65530);
  });
});
