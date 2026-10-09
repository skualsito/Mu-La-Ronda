/**
 * Mu La Ronda: the Lorencia ring (lorenciaRing.ts) is open and out of the
 * safezone, can be walked into from the town, and the server's two copies of
 * the rectangle (deploy/config/30-lorencia-ring.sql, LorenciaRing.cs) agree
 * with the client's.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { parseTerrainAttribute } from './parseTerrainAttribute';
import { LORENCIA_RING, inLorenciaRing } from './lorenciaRing';
import { TW_NOGROUND, TW_NOMOVE, TW_SAFEZONE } from './consts';

const load = async () =>
  parseTerrainAttribute(new Uint8Array(readFileSync('Data/World1/EncTerrain1.att')), 0 as never);

test('every ring cell is walkable and outside the safezone', async () => {
  const att = await load();
  const { x1, y1, x2, y2 } = LORENCIA_RING;
  for (let y = y1; y <= y2; y++)
    for (let x = x1; x <= x2; x++) expect(att[y * 256 + x] & (TW_SAFEZONE | TW_NOMOVE | TW_NOGROUND)).toBe(0);
});

test('the town around the ring stays safe, and the ring is reached from the spawn', async () => {
  const att = await load();
  const { x1, y1, x2, y2 } = LORENCIA_RING;
  for (let x = x1 - 1; x <= x2 + 1; x++) {
    for (const y of [y1 - 1, y2 + 1]) {
      expect(inLorenciaRing(x, y)).toBe(false);
      const v = att[y * 256 + x];
      // Either the safe square or a flower bed: never a cell to fight from.
      expect(v & TW_SAFEZONE || v & TW_NOMOVE).toBeTruthy();
    }
  }

  // From the spawn gate (deploy/config/04-gates.sql: 137..151, 118..123).
  const walk = (x: number, y: number) => !(att[y * 256 + x] & (TW_NOMOVE | TW_NOGROUND));
  const seen = new Set([140 + 120 * 256]);
  const queue = [[140, 120]];
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
  expect(seen.has(140 + 127 * 256)).toBe(true);
});

test('the server opens the same rectangle', () => {
  const { x1, y1, x2, y2 } = LORENCIA_RING;
  const sql = readFileSync('deploy/config/30-lorencia-ring.sql', 'utf8');
  expect(sql).toContain(`FOR y IN ${y1}..${y2} LOOP`);
  expect(sql).toContain(`FOR x IN ${x1}..${x2} LOOP`);

  const cs = readFileSync('marketplace/openmu/src/GameLogic/LorenciaRing.cs', 'utf8');
  const constant = (name: string) => Number(cs.match(new RegExp(`const byte ${name} = (\\d+);`))?.[1]);
  expect([constant('X1'), constant('Y1'), constant('X2'), constant('Y2')]).toEqual([x1, y1, x2, y2]);
});
