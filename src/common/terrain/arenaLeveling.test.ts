/**
 * Mu La Ronda: the Arena levelling zone (deploy/config/06-leveling.sql) - every
 * spot and the arrival gate sit on walkable cells, and each spot's monsters
 * give at least one level a kill across its range under OpenMU's experience
 * formula (rate 9999, Arena ExpMultiplier 2). Change one, change the other.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { parseTerrainAttribute } from './parseTerrainAttribute';

const RECTS = { spot1: [37, 108, 50, 117], spot2: [69, 112, 82, 117], spot3: [80, 84, 99, 100], spot4: [88, 110, 97, 117], gate: [53, 113, 57, 116] };

test('walkable', async () => {
  const att = await parseTerrainAttribute(new Uint8Array(readFileSync('Data/World7/EncTerrain7.att')), 6 as never);
  for (const [name, [x1, y1, x2, y2]] of Object.entries(RECTS)) {
    const bad: string[] = [];
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (att[y * 256 + x] & 0x0c) bad.push(`${x},${y}`);
    expect(bad, name).toEqual([]);
  }
});

// OpenMU: experience table and CalculateBaseExperience, rate 9999, map x2.
const total = (l: number) => (l + 9) * l * l * 10 + (l > 255 ? (l - 255 + 9) * (l - 255) ** 2 * 1000 : 0);
const gain = (m: number, l: number) => {
  let e = ((m + 25) * m) / 3;
  if (l > m + 10) e *= (m + 10) / l;
  if (m >= 65) e += (m - 64) * (m / 4);
  return Math.min(e * 1.25 * 9999 * 2, 2 ** 31 - 1);
};
test.each([
  ['spot1', [26, 28], 1, 230],
  ['spot2', [60, 62], 230, 300],
  ['spot3', [106], 300, 385],
  ['spot4', [134, 135], 385, 399],
] as const)('%s levels each kill', (_n, monsters, from, to) => {
  for (const m of monsters) for (let l = from; l <= to; l++) {
    expect(gain(m, l), `monster lvl ${m} at ${l}`).toBeGreaterThanOrEqual(total(l + 1) - total(l));
  }
});
