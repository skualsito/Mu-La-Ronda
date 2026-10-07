/**
 * Mu La Ronda: every fenced pen of Arena can be walked into from the arrival
 * gate once its door is open (arenaPenDoors.ts, deploy/config/17-arena-pens.sql),
 * and the SQL opens the same cells as the client.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { parseTerrainAttribute } from './parseTerrainAttribute';
import { ARENA_PEN_DOORS } from './arenaPenDoors';

/** A cell inside each pen. */
const PENS = [[10, 38], [30, 38], [47, 39], [10, 56], [30, 56], [47, 57], [10, 74], [30, 74], [47, 82], [10, 92], [30, 92]];

test('every pen is reachable from the arrival', async () => {
  const att = await parseTerrainAttribute(new Uint8Array(readFileSync('Data/World7/EncTerrain7.att')), 6 as never);
  const walk = (x: number, y: number) => x >= 0 && y >= 0 && x < 256 && y < 256 && !(att[y * 256 + x] & 0x0c);
  const seen = new Set([55 + 114 * 256]);
  const queue = [[55, 114]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const key = x + dx + (y + dy) * 256;
        if (!seen.has(key) && walk(x + dx, y + dy)) {
          seen.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
  }
  expect(PENS.filter(([x, y]) => !seen.has(x + y * 256))).toEqual([]);
});

test('the SQL opens the same cells', () => {
  const sql = readFileSync('deploy/config/17-arena-pens.sql', 'utf8');
  const cells = [...sql.matchAll(/\((\d+),\s*(\d+)\)/g)].map(m => `${m[1]},${m[2]}`).sort();
  expect(cells).toEqual(ARENA_PEN_DOORS.map(([x, y]) => `${x},${y}`).sort());
});
