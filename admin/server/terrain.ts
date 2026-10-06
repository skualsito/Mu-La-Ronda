import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTerrainAttribute } from '../../src/common/terrain/parseTerrainAttribute';
import worlds from './worlds.json';

/**
 * A map's walkability for the spot editor, read from the client's own terrain
 * files (`Data/World<n>/EncTerrain<n>.att`, in the repo the panel's container
 * mounts). `worlds.json` maps OpenMU's map number to the client's World folder
 * (event maps share folders); it was generated from the client's map registry.
 *
 * Cell codes: 0 walkable, 1 safe zone, 2 blocked (NoMove / NoGround).
 */

const SIZE = 256;
const REPO = fileURLToPath(new URL('../..', import.meta.url));
const cache = new Map<number, string>();

export function hasTerrain(mapNumber: number): boolean {
  return String(mapNumber) in worlds;
}

export async function terrainOf(mapNumber: number): Promise<string | null> {
  const hit = cache.get(mapNumber);
  if (hit) return hit;

  const world = (worlds as Record<string, number>)[String(mapNumber)];
  if (world === undefined) return null;
  const file = path.join(REPO, 'Data', `World${world}`, `EncTerrain${world}.att`);
  if (!existsSync(file)) return null;

  const att = await parseTerrainAttribute(new Uint8Array(readFileSync(file)), mapNumber as never);
  const cells = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < cells.length; i++) {
    const a = att[i];
    cells[i] = a & 0x0c ? 2 : a & 0x01 ? 1 : 0;
  }
  const encoded = Buffer.from(cells).toString('base64');
  cache.set(mapNumber, encoded);
  return encoded;
}
