import { describe, expect, it } from 'vitest';
import { Matrix, TransformNode } from '../libs/babylon/exports';
import { CapeCloth } from './capeCloth';

/** Mantle of Monarch's cloth sheet: 3 x 5 points, 16 triangles, no index buffer. */
function sheet(widen = 1): Float32Array {
  const rows = [0.505, 0.31, -0.179, -0.628, -0.965];
  const width = [0.28, 0.337, 0.451, 0.562, 0.668];
  const height = [0.134, 0.256, 0.328, 0.301, 0.19];
  const point = (r: number, c: number) => [(c - 1) * width[r] * widen, height[r], rows[r]];
  const out: number[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      out.push(...point(r, c), ...point(r + 1, c), ...point(r, c + 1));
      out.push(...point(r, c + 1), ...point(r + 1, c), ...point(r + 1, c + 1));
    }
  }
  return Float32Array.from(out);
}

function fakeMesh(world: Matrix, indices: number[] | null = null, widen = 1) {
  let data = sheet(widen);
  return {
    getVerticesData: () => data,
    setVerticesData: (_k: string, d: Float32Array) => { data = Float32Array.from(d); },
    updateVerticesData: (_k: string, d: Float32Array) => { data = Float32Array.from(d); },
    getIndices: () => indices,
    computeWorldMatrix: () => world,
    isDisposed: () => false,
    get data() { return data; },
    alwaysSelectAsActiveMesh: false,
  };
}

describe('CapeCloth', () => {
  it('hangs from its top edge and keeps its length', () => {
    // Cape bone space: +z up the back (the sheet's top is z = 0.5), x across.
    const world = Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 1.6, 0));
    const mesh = fakeMesh(world);
    const cloth = new CapeCloth(mesh as never, () => null as unknown as TransformNode);
    for (let i = 0; i < 120; i++) cloth.update(1 / 60);
    const d = mesh.data;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < d.length; i += 3) { minZ = Math.min(minZ, d[i]); maxZ = Math.max(maxZ, d[i]); }
    // Never longer than the sheet itself (1.47 from top to bottom) - it does not fall through.
    expect(maxZ - minZ).toBeLessThan(1.6);
    expect(maxZ).toBeCloseTo(0.505, 1);
  });

  it('reads an empty index list as triangles in order, as Babylon hands it over', () => {
    const world = Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 1.6, 0));
    const mesh = fakeMesh(world, []);
    const cloth = new CapeCloth(mesh as never, () => null as unknown as TransformNode);
    expect(cloth.stats.edges).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) cloth.update(1 / 60);
    const d = mesh.data;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 2; i < d.length; i += 3) { minZ = Math.min(minZ, d[i]); maxZ = Math.max(maxZ, d[i]); }
    expect(maxZ - minZ).toBeLessThan(1.6);
  });

  it('hangs a sheet wider than it is long from its top, not its side', () => {
    // Cape of Fighter: a hair wider than long.
    const world = Matrix.RotationX(-Math.PI / 2).multiply(Matrix.Translation(0, 1.6, 0));
    const mesh = fakeMesh(world, null, 1.6);
    const cloth = new CapeCloth(mesh as never, () => null as unknown as TransformNode);
    cloth.update(1 / 60);
    expect(cloth.stats.pinned).toBe(3);
    for (let i = 0; i < 120; i++) cloth.update(1 / 60);
    let maxZ = -Infinity;
    for (let i = 2; i < mesh.data.length; i += 3) maxZ = Math.max(maxZ, mesh.data[i]);
    expect(maxZ).toBeCloseTo(0.505, 1);
  });
});
