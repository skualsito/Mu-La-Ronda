import { EventBus } from '../../libs/eventBus';
import { isKey } from '../../common/keyBindings';
import { dropPassesLootFilter } from '../../common/lootFilter';
import type { Entity, ISystemFactory } from '../world';

/**
 * Mu La Ronda: the pickup key (Space by default) grabs the nearest drop
 * around the hero, and held down it keeps grabbing the next one. It hands
 * the drop to `world.pickupTarget` - the same field a click on it sets - so
 * the walk and the request are ItemPickupSystem's, exactly as for a click.
 *
 * Drops the loot filter hides are left alone, and one the server refused
 * (inventory full, someone else's) is not asked for again for a while, so a
 * held key does not stall on it.
 *
 * No original analog: the C++ client picks up with the mouse only.
 */

/** Tiles around the hero a drop is reached for in. */
const PICKUP_RADIUS = 6;

/** Seconds a drop that was asked for is skipped by the held key. */
const RETRY_AFTER = 3;

function tileDistance(a: Entity, b: Entity): number {
  return Math.max(
    Math.abs(~~a.transform!.pos.x - ~~b.transform!.pos.x),
    Math.abs(~~a.transform!.pos.z - ~~b.transform!.pos.z)
  );
}

export const PickupNearestSystem: ISystemFactory = world => {
  let held = false;
  let clock = 0;
  /** netId → when it was last asked for. */
  const asked = new Map<number, number>();

  const nearest = (hero: Entity): Entity | null => {
    let best: Entity | null = null;
    let bestDistance = PICKUP_RADIUS + 1;
    for (const e of world.netObjsQuery.entities) {
      if (!e.droppedItem || !e.transform || e.netId === undefined || e.objOutOfScope) continue;
      if (e.worldIndex !== undefined && e.worldIndex !== world.mapIndex) continue;
      const last = asked.get(e.netId);
      if (last !== undefined && clock - last < RETRY_AFTER) continue;
      if (!dropPassesLootFilter(e.droppedItem)) continue;
      const distance = tileDistance(hero, e);
      if (distance < bestDistance) {
        best = e;
        bestDistance = distance;
      }
    }
    return best;
  };

  const grab = () => {
    const hero = world.playerEntity;
    if (!hero || hero.dying || world.pickupTarget) return;
    const drop = nearest(hero);
    if (!drop) return;
    asked.set(drop.netId!, clock);
    world.pickupTarget = drop;
  };

  EventBus.on('keyPressed', code => {
    if (!isKey('pickupNearest', code)) return;
    held = true;
    grab();
  });
  EventBus.on('keyReleased', code => {
    if (isKey('pickupNearest', code)) held = false;
  });

  return {
    update: dt => {
      clock += dt;
      if (asked.size > 200) {
        for (const [id, at] of asked) if (clock - at >= RETRY_AFTER) asked.delete(id);
      }
      if (held) grab();
    },
  };
};
