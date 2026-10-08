import type { ENUM_WORLD } from '../../common';
import { getTilesList } from '../../common/terrain/getTilesList';
import { TERRAIN_SIZE } from '../../common/terrain/consts';
import { assetWorldNum } from '../../common/worldAssets';
import type { TerrainLayers, World } from '../../ecs/world';
import { loadMuSprite, type MuSprite } from './sprites';

/**
 * Mu La Ronda: a TAB map for the worlds whose Data has no `mini_map.ozt`
 * (Arena, among others), drawn from the ground the hero stands on: each
 * tile in the average colour of its texture (both layers, blended as drawn),
 * times the baked terrain light, and darker where it cannot be walked. Laid
 * out like the original pictures - U along tile Y, V along tile X - so the
 * sheet places it the same way.
 */

/** Pixels per tile of the finished picture. */
const SCALE = 2;
/** The baked light is dark for a picture seen whole: lifted by this much. */
const BRIGHTNESS = 1.7;
/** How much of its colour a tile that cannot be walked keeps. */
const BLOCKED_SHADE = 0.45;
const FALLBACK_COLOR: Rgb = [90, 80, 70];

type Rgb = [number, number, number];

async function averageColor(path: string): Promise<Rgb> {
  try {
    const sprite = await loadMuSprite(path);
    const image = new Image();
    image.src = sprite.url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return FALLBACK_COLOR;
    ctx.drawImage(image, 0, 0, 8, 8);
    const data = ctx.getImageData(0, 0, 8, 8).data;
    const sum: Rgb = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
    }
    const n = data.length / 4;
    return [sum[0] / n, sum[1] / n, sum[2] / n];
  } catch {
    return FALLBACK_COLOR;
  }
}

/** The picture for `map`, or null when the hero is not on it (nothing to draw from). */
export async function generateWorldMinimap(world: World, map: ENUM_WORLD): Promise<MuSprite | null> {
  if (world.mapIndex !== map) return null;

  const folder = `World${assetWorldNum(map)}/`;
  const colors = await Promise.all(getTilesList(map).map(tile => averageColor(`${folder}${tile}.OZJ`)));
  if (world.mapIndex !== map) return null;

  const tiles = document.createElement('canvas');
  tiles.width = TERRAIN_SIZE;
  tiles.height = TERRAIN_SIZE;
  const ctx = tiles.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(TERRAIN_SIZE, TERRAIN_SIZE);
  const layers: TerrainLayers = { layer1: 0, layer2: 255, alpha: 0 };

  for (let x = 0; x < TERRAIN_SIZE; x++) {
    for (let y = 0; y < TERRAIN_SIZE; y++) {
      world.getTerrainLayers(x, y, layers);
      const base = colors[layers.layer1] ?? FALLBACK_COLOR;
      const over = layers.layer2 === 255 ? base : (colors[layers.layer2] ?? base);
      const a = layers.layer2 === 255 ? 0 : layers.alpha;
      const light = world.getTerrainLight(x, y);
      const shade = (world.isWalkable(x, y) ? 1 : BLOCKED_SHADE) * BRIGHTNESS;
      // Row = tile X, column = tile Y (`Tx = PositionY / 256 · L`, `Ty = PositionX / 256 · L`).
      const i = (x * TERRAIN_SIZE + y) * 4;
      image.data[i] = Math.min(255, (base[0] + (over[0] - base[0]) * a) * light.x * shade);
      image.data[i + 1] = Math.min(255, (base[1] + (over[1] - base[1]) * a) * light.y * shade);
      image.data[i + 2] = Math.min(255, (base[2] + (over[2] - base[2]) * a) * light.z * shade);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const size = TERRAIN_SIZE * SCALE;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const outCtx = out.getContext('2d');
  if (!outCtx) return null;
  outCtx.imageSmoothingEnabled = true;
  outCtx.drawImage(tiles, 0, 0, size, size);

  const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return { url: URL.createObjectURL(blob), width: size, height: size };
}
