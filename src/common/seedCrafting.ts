import type { Item } from '../ecs/world';
import { SOCKET_EMPTY } from './itemExtraOptions';

/**
 * Mu La Ronda: the socket system's two NPCs (Elbeland), which share the chaos machine's
 * tray (Economy.mixKind 'seedMaster' / 'seedResearcher'):
 *
 *  - the **Seed Master** makes a seed (OpenMU crafting 42) and a seed sphere out of a seed and a
 *    sphere (43). The server tells the two apart by the items, like the goblin's mixes.
 *  - the **Seed Researcher** mounts a seed sphere on a socket of an item (44) or takes one off
 *    (45); both name the socket, so the window asks which.
 *
 * On the server they are their own storages (MoveItemAction: 11-12 while the Seed Master's window
 * is open, 13-14 the Seed Researcher's) over the same temporary storage as the chaos machine.
 */

export const SEED_MASTER_WIRE_STORAGE = 11;
export const SEED_RESEARCHER_WIRE_STORAGE = 13;

export const MOUNT_SEED_SPHERE = 44;
export const REMOVE_SEED_SPHERE = 45;

/** The highest seed sphere level that mounts (MountSeedSphereCrafting.MaximumSphereLevel). */
export const MAX_SPHERE_LEVEL = 3;

const SEED_SPHERE_FIRST = 100;
const SEED_SPHERE_LAST = 129;
const SEED_TYPES = 6;
/** Wings, orbs, seeds and spheres. */
const GROUP = 12;

/** Group 12, 100-129: Seed Sphere (Fire) (1) ... Seed Sphere (Earth) (5). */
export function isSeedSphere(item: Item | null | undefined): item is Item {
  return !!item && item.group === GROUP && item.num >= SEED_SPHERE_FIRST && item.num <= SEED_SPHERE_LAST;
}

/** A seed sphere's level, 1-5, by its number (its item level is the kind of option). */
export function seedSphereLevel(item: Item): number {
  return Math.floor((item.num - SEED_SPHERE_FIRST) / SEED_TYPES) + 1;
}

/** The item in the tray that has sockets. */
export function socketItemOf(items: readonly (Item | null)[]): Item | null {
  return items.find(i => !!i && (i.socketCount ?? 0) > 0) ?? null;
}

/** Whether that socket holds a seed sphere. */
export function socketFilled(item: Item, slot: number): boolean {
  const byte = item.sockets?.[slot];
  return byte !== undefined && byte !== SOCKET_EMPTY;
}

/**
 * The socket the Seed Researcher works on: the picked one while it fits what is in the tray (an
 * empty socket to mount on, a full one to take off), else the first that does.
 */
export function socketToUse(items: readonly (Item | null)[], picked: number): number {
  const item = socketItemOf(items);
  if (!item) return picked;
  const mounting = items.some(isSeedSphere);
  return picked < (item.socketCount ?? 0) && socketFilled(item, picked) !== mounting ? picked : defaultSocket(items);
}

/**
 * The socket to start on: with a seed sphere in the tray (mounting), the first empty one;
 * without (taking one off), the first that holds one.
 */
export function defaultSocket(items: readonly (Item | null)[]): number {
  const item = socketItemOf(items);
  if (!item) return 0;
  const mounting = items.some(isSeedSphere);
  for (let slot = 0; slot < (item.socketCount ?? 0); slot++) {
    if (socketFilled(item, slot) !== mounting) return slot;
  }
  return 0;
}
