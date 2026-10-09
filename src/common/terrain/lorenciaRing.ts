import { ENUM_WORLD } from '../types';
import { TERRAIN_SIZE } from './consts';

/**
 * Mu La Ronda: the ring in the middle of Lorencia, where the fountain with the
 * angel statue stood. An 8x8 block of cells between the four flower beds of
 * the square, walkable and outside the safezone, so players can fight in it
 * while the town around it stays safe. A kill inside does not make the killer
 * a PK.
 *
 * The server opens the same cells (deploy/config/30-lorencia-ring.sql) and
 * knows the same rectangle (marketplace/openmu/.../LorenciaRing.cs) - keep the
 * three equal, or the client walks where the server refuses. The floor is
 * drawn by `maps/lorencia/ring.ts`, and the fountain's objects are taken out
 * by `libs/mu/mapObjectFixups.ts`.
 */
export const LORENCIA_RING = { x1: 137, y1: 124, x2: 144, y2: 131 } as const;

/** Whether tile (x, y) of Lorencia is inside the ring. */
export function inLorenciaRing(x: number, y: number): boolean {
  const { x1, y1, x2, y2 } = LORENCIA_RING;
  return x >= x1 && x <= x2 && y >= y1 && y <= y2;
}

/** Opens the ring in Lorencia's attribute grid (`y * 256 + x`), in place: walkable, not safezone. */
export function openLorenciaRing(map: ENUM_WORLD, attributes: Uint16Array): void {
  if (map !== ENUM_WORLD.WD_0LORENCIA) return;
  const { x1, y1, x2, y2 } = LORENCIA_RING;
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) attributes[y * TERRAIN_SIZE + x] = 0;
  }
}
