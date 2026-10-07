import { ENUM_WORLD } from '../types';
import { TERRAIN_SIZE } from './consts';

/**
 * Mu La Ronda: the fenced pens of Arena (the squares north of the leveling
 * zone) are closed all the way round in `EncTerrain7.att`, so nobody could
 * walk in. They are opened where the drawn fence has its gap: the cells of the
 * pens' walls that no fence piece (Object11, two tiles long, rotated 0 or 90)
 * stands on, taken from EncTerrain7.obj. The server's copy of the terrain
 * is opened at the same cells (deploy/config/17-arena-pens.sql) - keep both
 * lists equal, or the client walks where the server refuses (or the other way).
 */
export const ARENA_PEN_DOORS: readonly (readonly [x: number, y: number])[] = [
  [16, 37], [17, 37], [35, 37], [36, 37], [53, 37], [54, 37], [16, 38], [35, 38],
  [53, 38], [16, 39], [35, 39], [53, 39], [16, 40], [17, 40], [35, 40], [36, 40],
  [53, 40], [54, 40], [16, 55], [17, 55], [35, 55], [36, 55], [53, 55], [54, 55],
  [16, 56], [35, 56], [53, 56], [16, 57], [35, 57], [53, 57], [16, 58], [17, 58],
  [35, 58], [36, 58], [53, 58], [54, 58], [16, 73], [17, 73], [35, 73], [36, 73],
  [16, 74], [35, 74], [16, 75], [35, 75], [16, 76], [17, 76], [35, 76], [36, 76],
  [53, 80], [54, 80], [53, 81], [53, 82], [53, 83], [54, 83], [15, 85], [16, 85],
  [28, 85], [31, 85], [15, 86], [16, 86], [17, 86], [28, 86], [29, 86], [30, 86],
  [31, 86], [17, 87], [18, 87], [44, 92], [45, 92],
];

/** Opens the pens' doors in Arena's attribute grid (`y * 256 + x`), in place. */
export function openArenaPens(map: ENUM_WORLD, attributes: Uint16Array): void {
  if (map !== ENUM_WORLD.WD_6STADIUM && map !== ENUM_WORLD.WD_100VIP_STADIUM) return;
  for (const [x, y] of ARENA_PEN_DOORS) attributes[y * TERRAIN_SIZE + x] = 0;
}
