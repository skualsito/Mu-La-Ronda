import { ENUM_WORLD } from '../types';
import { TERRAIN_SIZE } from './consts';

/**
 * Mu La Ronda: the fenced pens of Arena (the squares north of the leveling
 * zone) are closed all the way round in `EncTerrain7.att`, so nobody could
 * walk in. Each gets a two-cell door on the side facing the corridor, the
 * way the reference server's Arena has them. The server's copy of the terrain
 * is opened at the same cells (deploy/config/17-arena-pens.sql) - keep both
 * lists equal, or the client walks where the server refuses (or the other way).
 */
export const ARENA_PEN_DOORS: readonly (readonly [x: number, y: number])[] = [
  [16, 38], [17, 38], [16, 39], [17, 39],
  [23, 38], [24, 38], [23, 39], [24, 39],
  [41, 39], [41, 40],
  [16, 56], [17, 56], [16, 57], [17, 57],
  [23, 56], [24, 56], [23, 57], [24, 57],
  [41, 57], [41, 58],
  [16, 74], [17, 74], [16, 75], [17, 75],
  [23, 74], [24, 74], [23, 75], [24, 75],
  [41, 82], [41, 83],
  [17, 92], [18, 92], [17, 93], [18, 93],
  [23, 92], [24, 92], [23, 93], [24, 93],
];

/** Opens the pens' doors in Arena's attribute grid (`y * 256 + x`), in place. */
export function openArenaPens(map: ENUM_WORLD, attributes: Uint16Array): void {
  if (map !== ENUM_WORLD.WD_6STADIUM) return;
  for (const [x, y] of ARENA_PEN_DOORS) attributes[y * TERRAIN_SIZE + x] = 0;
}
