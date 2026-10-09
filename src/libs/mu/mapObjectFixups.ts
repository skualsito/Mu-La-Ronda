import { ENUM_WORLD } from '../../common';
import { MODEL_CANDLE, MODEL_FURNITURE01 } from '../../common/objects/enum';
import { LORENCIA_RING } from '../../common/terrain/lorenciaRing';

export interface MapObjectFixup {
  type: number;
  x: number;
  y: number;
  z: number;
}

const MATCH_EPSILON = 1;

const MAP_OBJECT_FIXUPS: Partial<Record<ENUM_WORLD, MapObjectFixup[]>> = {
  [ENUM_WORLD.WD_0LORENCIA]: [
    { type: MODEL_FURNITURE01 + 3, x: 12494.65, y: 12235.38, z: 165 },
    { type: MODEL_FURNITURE01 + 3, x: 12483.23, y: 12235.69, z: 165 },

    { type: MODEL_CANDLE, x: 12531.0, y: 12253.23, z: 250 },
  ],
};

export function applyMapObjectFixups(
  map: ENUM_WORLD,
  objs: { id: number; pos: { x: number; y: number; z: number } }[]
): void {
  const fixups = MAP_OBJECT_FIXUPS[map];
  if (!fixups) return;

  for (const fixup of fixups) {
    let target: (typeof objs)[number] | undefined;
    let bestDistance = MATCH_EPSILON;

    for (const o of objs) {
      if (o.id !== fixup.type) continue;

      const distance = Math.hypot(o.pos.x - fixup.x, o.pos.y - fixup.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        target = o;
      }
    }

    if (!target) {
      console.warn(
        `[mapObjectFixups] no object ${fixup.type} near (${fixup.x}, ${fixup.y}) on map ${map}`
      );
      continue;
    }

    target.pos.z = fixup.z;
  }
}

/**
 * Mu La Ronda: map objects taken out, by the tile rectangle they stand in
 * (`x1..x2`, `y1..y2`, inclusive). Lorencia's fountain - the angel statue,
 * its spout, the fence round it and the grass in it - makes way for the ring
 * (`common/terrain/lorenciaRing.ts`), whose cells the server opens.
 */
const MAP_OBJECT_REMOVALS: Partial<
  Record<ENUM_WORLD, readonly { x1: number; y1: number; x2: number; y2: number }[]>
> = {
  [ENUM_WORLD.WD_0LORENCIA]: [LORENCIA_RING],
};

/** The map's objects without the ones standing in a removed area (a new array when any go). */
export function removeMapObjects<T extends { pos: { x: number; y: number } }>(
  map: ENUM_WORLD,
  objs: T[]
): T[] {
  const areas = MAP_OBJECT_REMOVALS[map];
  if (!areas) return objs;

  // Object positions are in the original's centimetres, 100 per tile.
  return objs.filter(o => {
    const x = Math.floor(o.pos.x / 100);
    const y = Math.floor(o.pos.y / 100);
    return !areas.some(a => x >= a.x1 && x <= a.x2 && y >= a.y1 && y <= a.y2);
  });
}
