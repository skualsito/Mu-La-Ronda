import {
  Color3,
  DynamicTexture,
  Mesh,
  StandardMaterial,
  Texture,
  VertexData,
  type Scene,
} from '../../libs/babylon/exports';
import { LORENCIA_RING } from '../../common/terrain/lorenciaRing';
import { resolveUrlToDataFolder } from '../../common/resolveUrlToDataFolder';
import type { World } from '../../ecs/world';

/**
 * Mu La Ronda: the ring in the middle of Lorencia (`common/terrain/lorenciaRing.ts`)
 * - a floor of dark stone slabs with the La Ronda logo painted across it,
 * frosted at the edges, inside a low stone curb. It stands where the fountain
 * was (its objects are dropped by `libs/mu/mapObjectFixups.ts`).
 *
 * Both meshes hang off the terrain mesh, so they go when the map is unloaded
 * (`unloadMap` disposes the terrain with its children, materials and
 * textures). They follow the ground's height and take its baked light per
 * vertex, so the ring sits in the town's light instead of glowing in it.
 */

const SIZE_X = LORENCIA_RING.x2 - LORENCIA_RING.x1 + 1;
const SIZE_Y = LORENCIA_RING.y2 - LORENCIA_RING.y1 + 1;

/** Vertices per tile edge: enough to follow the ground. */
const SUB = 4;
/** The floor over the ground, against z-fighting with the terrain. */
const LIFT = 0.03;
/** Texels per tile of the floor texture. */
const PX = 128;

/** The curb: how wide (tiles, inside the ring) and how high over the floor. */
const CURB_WIDTH = 0.22;
const CURB_HEIGHT = 0.16;

/** The logo runs along the slabs, laid on the floor like the reference, not turned to face the camera: from the default camera it climbs to the right. */
const LOGO_TURN = -Math.PI / 2;

/** The slabs: Dungeon's dark rock. The curb: the town's own grey stone. */
const STONE = 'World2/TileRock01.jpg';
const CURB_STONE = 'World1/TileRock01.jpg';
const LOGO = './brand/la-ronda.png';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`ring: cannot load ${url}`));
    image.src = url;
  });
}

/** A seeded random, so the slabs come out the same on every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Mu La Ronda: how much of the logo shows over the slabs, and how much stone
 * grain shows through it - at 0.92 it read as a sticker lifted off the floor
 * (2026-10-10); now it reads painted into the stone.
 */
const LOGO_OPACITY = 0.6;
const LOGO_STONE_GRAIN = 0.4;

/** The floor: stone slabs, frosted edges, the logo painted on top. */
function paintFloor(
  ctx: CanvasRenderingContext2D,
  stone: HTMLImageElement | null,
  logo: HTMLImageElement | null
): void {
  const w = SIZE_X * PX;
  const h = SIZE_Y * PX;
  const rand = seeded(0x52494e47);

  ctx.fillStyle = '#26282b';
  ctx.fillRect(0, 0, w, h);

  // The rock, two tiles to a repeat, darkened to the slate of the reference.
  if (stone) {
    for (let y = 0; y < h; y += PX * 2) {
      for (let x = 0; x < w; x += PX * 2) ctx.drawImage(stone, x, y, PX * 2, PX * 2);
    }
  }
  ctx.fillStyle = 'rgba(14, 16, 20, 0.5)';
  ctx.fillRect(0, 0, w, h);

  // One slab per tile, each a touch lighter or darker than the next.
  for (let ty = 0; ty < SIZE_Y; ty++) {
    for (let tx = 0; tx < SIZE_X; tx++) {
      const shade = rand() * 0.16 - 0.08;
      ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
      ctx.fillRect(tx * PX, ty * PX, PX, PX);
    }
  }

  // Grout, with a thin lit lip on the slab below each joint.
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  for (let t = 1; t < SIZE_X; t++) {
    ctx.moveTo(t * PX, 0);
    ctx.lineTo(t * PX, h);
  }
  for (let t = 1; t < SIZE_Y; t++) {
    ctx.moveTo(0, t * PX);
    ctx.lineTo(w, t * PX);
  }
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.beginPath();
  for (let t = 1; t < SIZE_X; t++) {
    ctx.moveTo(t * PX + 4, 0);
    ctx.lineTo(t * PX + 4, h);
  }
  for (let t = 1; t < SIZE_Y; t++) {
    ctx.moveTo(0, t * PX + 4);
    ctx.lineTo(w, t * PX + 4);
  }
  ctx.stroke();

  // The logo, painted on: worn through by the stone and chipped here and there.
  if (logo) {
    const art = document.createElement('canvas');
    const span = Math.min(w, h) * 0.78;
    const scale = span / Math.max(logo.width, logo.height);
    art.width = Math.round(logo.width * scale);
    art.height = Math.round(logo.height * scale);
    const a = art.getContext('2d')!;
    a.drawImage(logo, 0, 0, art.width, art.height);
    if (stone) {
      a.globalCompositeOperation = 'source-atop';
      a.globalAlpha = LOGO_STONE_GRAIN;
      for (let y = 0; y < art.height; y += PX * 2) {
        for (let x = 0; x < art.width; x += PX * 2) a.drawImage(stone, x, y, PX * 2, PX * 2);
      }
    }
    a.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 450; i++) {
      a.globalAlpha = 0.2 + rand() * 0.5;
      const r = 0.8 + rand() * 2.4;
      a.beginPath();
      a.arc(rand() * art.width, rand() * art.height, r, 0, Math.PI * 2);
      a.fill();
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(LOGO_TURN);
    ctx.globalAlpha = LOGO_OPACITY;
    ctx.drawImage(art, -art.width / 2, -art.height / 2);
    ctx.restore();
  }

  // Frost along the edges: a pale band fading inwards, and loose specks.
  const band = PX * 0.85;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, band, 0, 0, w, band],
    [0, h, 0, h - band, 0, h - band, w, band],
    [0, 0, band, 0, 0, 0, band, h],
    [w, 0, w - band, 0, w - band, 0, band, h],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(228, 233, 238, 0.8)');
    g.addColorStop(0.35, 'rgba(228, 233, 238, 0.35)');
    g.addColorStop(1, 'rgba(225, 230, 235, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
  for (let i = 0; i < 5200; i++) {
    const along = rand();
    const depth = Math.pow(rand(), 2.2) * band * 1.3;
    const side = Math.floor(rand() * 4);
    const x = side < 2 ? along * w : side === 2 ? depth : w - depth;
    const y = side >= 2 ? along * h : side === 0 ? depth : h - depth;
    ctx.fillStyle = `rgba(235, 240, 245, ${0.15 + rand() * 0.45})`;
    ctx.fillRect(x, y, 1 + rand() * 3, 1 + rand() * 3);
  }
}

/** The ground's light at (x, y), as a vertex colour. */
function lightAt(world: World, x: number, y: number): [number, number, number] {
  const l = world.getTerrainLight(x, y);
  return [Math.min(l.x, 1.2), Math.min(l.y, 1.2), Math.min(l.z, 1.2)];
}

function buildFloor(world: World, scene: Scene): Mesh {
  const { x1, y1 } = LORENCIA_RING;
  const nx = SIZE_X * SUB + 1;
  const ny = SIZE_Y * SUB + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x1 + i / SUB;
      const y = y1 + j / SUB;
      positions.push(x, world.getTerrainHeight(x, y) + LIFT, y);
      uvs.push(i / (nx - 1), j / (ny - 1));
      colors.push(...lightAt(world, x, y), 1);
    }
  }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      indices.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  }

  const mesh = new Mesh('lorenciaRingFloor', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.uvs = uvs;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

/** Four low stone bars along the inside of the ring's edge. */
function buildCurb(world: World, scene: Scene): Mesh {
  const { x1, y1 } = LORENCIA_RING;
  const x2 = x1 + SIZE_X;
  const y2 = y1 + SIZE_Y;
  const c = CURB_WIDTH;
  const bars: [number, number, number, number][] = [
    [x1, y1, x2, y1 + c],
    [x1, y2 - c, x2, y2],
    [x1, y1 + c, x1 + c, y2 - c],
    [x2 - c, y1 + c, x2, y2 - c],
  ];

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const quad = (corners: [number, number, number][], uLen: number, vLen: number) => {
    const base = positions.length / 3;
    const uv: [number, number][] = [[0, 0], [uLen, 0], [uLen, vLen], [0, vLen]];
    corners.forEach(([x, y, z], k) => {
      positions.push(x, y, z);
      uvs.push(...uv[k]);
      colors.push(...lightAt(world, x, z), 1);
    });
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };

  for (const [ax, az, bx, bz] of bars) {
    // The bar's foot follows the lowest ground under it, its top is level.
    const floor = Math.min(
      world.getTerrainHeight(ax, az),
      world.getTerrainHeight(bx, az),
      world.getTerrainHeight(ax, bz),
      world.getTerrainHeight(bx, bz)
    );
    const top = Math.max(
      world.getTerrainHeight(ax, az),
      world.getTerrainHeight(bx, az),
      world.getTerrainHeight(ax, bz),
      world.getTerrainHeight(bx, bz)
    ) + LIFT + CURB_HEIGHT;
    const bottom = floor - 0.05;
    const lx = bx - ax;
    const lz = bz - az;
    const hh = top - bottom;

    quad([[ax, top, az], [bx, top, az], [bx, top, bz], [ax, top, bz]], lx, lz);
    quad([[ax, bottom, az], [bx, bottom, az], [bx, top, az], [ax, top, az]], lx, hh);
    quad([[bx, bottom, bz], [ax, bottom, bz], [ax, top, bz], [bx, top, bz]], lx, hh);
    quad([[ax, bottom, bz], [ax, bottom, az], [ax, top, az], [ax, top, bz]], lz, hh);
    quad([[bx, bottom, az], [bx, bottom, bz], [bx, top, bz], [bx, top, az]], lz, hh);
  }

  const mesh = new Mesh('lorenciaRingCurb', scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.uvs = uvs;
  data.colors = colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

/** Builds the ring on the loaded Lorencia terrain. */
export function createLorenciaRing(world: World): void {
  const terrain = world.terrain?.mesh;
  if (!terrain) return;
  const scene = terrain.getScene();

  const floor = buildFloor(world, scene);
  const texture = new DynamicTexture(
    'lorenciaRingFloor',
    { width: SIZE_X * PX, height: SIZE_Y * PX },
    scene,
    true
  );
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;
  texture.anisotropicFilteringLevel = 8;
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  paintFloor(ctx, null, null);
  texture.update();

  const floorMaterial = new StandardMaterial('lorenciaRingFloor', scene);
  floorMaterial.diffuseTexture = texture;
  // Unlit: with no lights the standard shader shows the texture through the
  // emissive term, times the vertex colours (the ground's baked light).
  floorMaterial.disableLighting = true;
  floorMaterial.emissiveColor = Color3.White();
  floorMaterial.specularColor = Color3.Black();
  floorMaterial.backFaceCulling = false;
  floor.material = floorMaterial;
  floor.useVertexColors = true;
  floor.isPickable = false;
  floor.parent = terrain;

  const curb = buildCurb(world, scene);
  const stoneTexture = new Texture(resolveUrlToDataFolder(CURB_STONE), scene);
  const curbMaterial = new StandardMaterial('lorenciaRingCurb', scene);
  curbMaterial.diffuseTexture = stoneTexture;
  curbMaterial.disableLighting = true;
  curbMaterial.emissiveColor = new Color3(1, 0.98, 0.95);
  curbMaterial.specularColor = Color3.Black();
  // Hand-built faces: both sides drawn rather than one winding to get right.
  curbMaterial.backFaceCulling = false;
  curb.material = curbMaterial;
  curb.useVertexColors = true;
  curb.isPickable = false;
  curb.parent = terrain;

  // The textures come in after the meshes stand: repaint once they are here.
  void Promise.all([
    loadImage(resolveUrlToDataFolder(STONE)).catch(() => null),
    loadImage(LOGO).catch(() => null),
  ]).then(([stone, logo]) => {
    if (floor.isDisposed()) return;
    paintFloor(ctx, stone, logo);
    texture.update();
  });
}
