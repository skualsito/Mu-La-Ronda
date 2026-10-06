import { ITEM_ICON_MANIFEST } from '../../src/common/itemIconManifest';

/**
 * The game's own item pictures for the panel's grids. They live on the game
 * site (`public/items`, see src/common/itemIconPack.ts): admin.<domain> loads
 * them from <domain>, and the dev panel from the client's dev server.
 */

const TINTS = [0, 3, 5, 7, 9, 11, 13, 15];

function tintOf(level: number): number {
  let tint = 0;
  for (const t of TINTS) if (level >= t) tint = t;
  return tint;
}

function gameOrigin(): string {
  const { protocol, hostname, port } = location;
  if (hostname.startsWith('admin.')) return `${protocol}//${hostname.slice('admin.'.length)}${port ? `:${port}` : ''}`;
  return `${protocol}//${hostname}:5173`;
}

function has(group: number, number: number, tint: number, excellent: boolean): boolean {
  const mask = ITEM_ICON_MANIFEST[`${group}_${number}`];
  if (mask === undefined) return false;
  const bit = TINTS.indexOf(tint) + (excellent ? TINTS.length : 0);
  return (mask & (1 << bit)) !== 0;
}

/** The picture for an item, falling back from its tint and excellent look to the plain one; null when there is none. */
export function itemIconUrl(item: { group: number; number: number; level?: number; excellent?: boolean }): string | null {
  const tint = tintOf(item.level ?? 0);
  const candidates: [number, boolean][] = [[tint, !!item.excellent], [0, !!item.excellent], [tint, false], [0, false]];
  for (const [t, e] of candidates) {
    if (has(item.group, item.number, t, e)) {
      return `${gameOrigin()}/items/item_${item.group}_${item.number}_${t}${e ? '_e' : ''}.png`;
    }
  }
  return null;
}
