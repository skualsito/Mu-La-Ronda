import { Matrix, Vector3, VertexBuffer, VertexData, type AbstractMesh, type Mesh, type TransformNode } from '../libs/babylon/exports';

/**
 * Mu La Ronda: the cloth of the Dark Lord's and the Rage Fighter's capes.
 *
 * The original hangs a `CPhysicsCloth` under these capes (ZzzCharacter.cpp:
 * 9780-9809) and simulates the model's own cloth mesh - the flat 48-vertex
 * sheet in DarkLordRobe, DarkLordRobe02 and Wing50. Drawn as authored, that
 * sheet stood stiff behind the hero whatever he did. Here it is a small
 * Verlet cloth: the edge nearest the cape bone is pinned and follows the body,
 * the rest swings under gravity, lags behind a turn or a run, ripples in a
 * light breeze and is kept out of the body by a capsule around the hero.
 *
 * Positions live in world space (that is where gravity and inertia are), and
 * are written back into the mesh in its own space every frame.
 */

/** World units per second squared (a character is about 1.8 units tall). */
const GRAVITY = 9.8;
/** Velocity kept per 60 Hz step. */
const DAMPING = 0.97;
/** Constraint passes per step: more is stiffer cloth. */
const ITERATIONS = 6;
/** The simulation runs in fixed steps of this many seconds. */
const STEP = 1 / 60;
/** A frame this long (a hitch, a tab come back) restarts from the rest pose. */
const RESET_DT = 0.5;
/** A cape that moves this far in one frame (world units, a warp) restarts from the rest pose too. */
const RESET_JUMP = 0.75;
/** The band at the top of the sheet that is pinned, as a share of its height. */
const PIN_BAND = 0.08;
/** The body the cloth may not pass through: a vertical capsule around the hero. */
const BODY_RADIUS = 0.26;
const BODY_BOTTOM = 0.15;
const BODY_TOP = 1.55;
/**
 * And it stays behind him: no free point closer than this to his back's plane
 * through the body's axis, world units. The hero turns on the spot in one
 * frame; the sheet swung through him, and the capsule then held it in front,
 * draped over the chest - the cape that "hung crooked" online.
 */
const BACK_MIN = 0.1;
/** Breeze, world units per second squared. */
const WIND = 0.9;
/**
 * Pull back toward the cape's own shape, per 60 Hz step: it keeps the cut the
 * model was drawn with (Cape of Overrule flares out a metre behind and would
 * otherwise hang straight through the floor) while it still swings and trails.
 */
const SHAPE = 0.06;
/** The lowest a free point may go, over the hero's feet. */
const FLOOR = 0.03;

const tmp = new Vector3();
const tmpB = new Vector3();
const back = new Vector3();
const LOCAL_BACK = new Vector3(0, 0, 1);
const inverse = new Matrix();
const boneMatrix = new Matrix();

/**
 * Mu La Ronda: a skinned cape as a plain mesh. Cape of Overrule's sheet hangs
 * off one bone of its own skeleton, in a clip of a single key - it never
 * moved. Its vertices are put where that pose draws them (what the skinning
 * shader does: world x bone x position), in the mesh's own space, and the
 * skeleton is let go, so the cloth can move them.
 */
export function bakeSkin(mesh: AbstractMesh): void {
  const skeleton = mesh.skeleton;
  if (!skeleton) return;
  (mesh as AbstractMesh & { makeGeometryUnique?: () => void }).makeGeometryUnique?.();
  skeleton.prepare(true);
  const matrices = skeleton.getTransformMatrices(mesh);
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getVerticesData(VertexBuffer.MatricesIndicesKind);
  const weights = mesh.getVerticesData(VertexBuffer.MatricesWeightsKind);
  if (!positions || !indices || !weights) return;
  const out = new Float32Array(positions.length);
  for (let v = 0; v < positions.length / 3; v++) {
    tmp.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 4; k++) {
      const w = weights[v * 4 + k];
      if (!w) continue;
      Matrix.FromArrayToRef(matrices, indices[v * 4 + k] * 16, boneMatrix);
      Vector3.TransformCoordinatesToRef(tmp, boneMatrix, tmpB);
      x += tmpB.x * w;
      y += tmpB.y * w;
      z += tmpB.z * w;
    }
    out[v * 3] = x;
    out[v * 3 + 1] = y;
    out[v * 3 + 2] = z;
  }
  mesh.skeleton = null;
  mesh.setVerticesData(VertexBuffer.PositionKind, out, true);
}

/**
 * Mu La Ronda: cuts every triangle of a sheet into `n` x `n` smaller ones,
 * positions, normals, UVs and colours alike. Cape of Overrule's cape and
 * ribbons are each one quad: four corners cannot fold, and a ribbon swung
 * from the shoulder like a 1.8 m pole. The original simulates them as grids
 * of its own (`CPhysicsCloth::Create`, 10 x 10 and 2 x 5 points). Run after
 * `bakeSkin`: the bone weights are dropped.
 */
export function subdivideSheet(mesh: AbstractMesh, n: number): void {
  if (n <= 1) return;
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions) return;
  const kinds: [string, number][] = [
    [VertexBuffer.PositionKind, 3],
    [VertexBuffer.NormalKind, 3],
    [VertexBuffer.UVKind, 2],
    [VertexBuffer.ColorKind, 4],
  ];
  const sources = kinds
    .map(([kind, size]) => ({ kind, size, data: mesh.getVerticesData(kind) }))
    .filter((k): k is { kind: string; size: number; data: Float32Array } => !!k.data);
  const own = mesh.getIndices();
  const vertexCount = positions.length / 3;
  const indices = own && own.length > 0 ? own : Array.from({ length: vertexCount }, (_, i) => i);
  const out = sources.map(() => [] as number[]);
  const emit = (a: number, b: number, c: number, i: number, j: number) => {
    const u = i / n;
    const v = j / n;
    sources.forEach((src, k) => {
      for (let d = 0; d < src.size; d++) {
        const pa = src.data[a * src.size + d];
        const pb = src.data[b * src.size + d];
        const pc = src.data[c * src.size + d];
        out[k].push(pa + (pb - pa) * u + (pc - pa) * v);
      }
    });
  };
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        emit(a, b, c, i, j);
        emit(a, b, c, i + 1, j);
        emit(a, b, c, i, j + 1);
        if (i + j < n - 1) {
          emit(a, b, c, i + 1, j);
          emit(a, b, c, i + 1, j + 1);
          emit(a, b, c, i, j + 1);
        }
      }
    }
  }
  const data = new VertexData();
  sources.forEach((src, k) => data.set(Float32Array.from(out[k]), src.kind));
  data.indices = Array.from({ length: out[0].length / 3 }, (_, i) => i);
  mesh.skeleton = null;
  for (const kind of [VertexBuffer.MatricesIndicesKind, VertexBuffer.MatricesWeightsKind]) {
    if (mesh.isVerticesDataPresent(kind)) (mesh as Mesh).removeVerticesData(kind);
  }
  data.applyToMesh(mesh as Mesh, true);
}

/** Mu La Ronda: how a cloth differs from the plain cape (wings.ts `cloth`). */
export type ClothOptions = {
  /** Pull back toward the model's cut, per step (default SHAPE). 0 hangs by gravity alone. */
  shape?: number;
};

export class CapeCloth {
  readonly mesh: AbstractMesh;

  /** The mesh's own vertex positions as loaded (mesh space). */
  private readonly restVertices: Float32Array;
  /** Vertex -> particle (vertices on a UV seam share one particle). */
  private readonly particleOf: Int32Array;
  /** Particle rest positions, mesh space. */
  private readonly restParticles: Float32Array;
  private readonly pinned: Uint8Array;
  private readonly edges: Int32Array;
  private readonly restLengths: Float32Array;
  /** Pairs two apart along the sheet: they keep it from crumpling like a rag. */
  private readonly bends: Int32Array;
  private readonly bendLengths: Float32Array;
  private readonly pos: Float32Array;
  private readonly prev: Float32Array;
  private readonly out: Float32Array;
  private readonly count: number;
  private seeded = false;
  /** Where the mesh was last frame, world space (a jump re-seeds). */
  private readonly lastAt = new Vector3(Infinity, Infinity, Infinity);
  private accumulator = 0;
  private time = 0;

  /** Particle -> its piece of the sheet (Cape of Overrule's two ribbons are two). */
  private readonly component: Int32Array;
  private readonly shape: number;

  constructor(mesh: AbstractMesh, private readonly body: () => TransformNode | null, options: ClothOptions = {}) {
    this.mesh = mesh;
    this.shape = options.shape ?? SHAPE;
    // Models come out of a shared container: this instance needs its own vertices.
    (mesh as AbstractMesh & { makeGeometryUnique?: () => void }).makeGeometryUnique?.();
    const data = mesh.getVerticesData(VertexBuffer.PositionKind) ?? new Float32Array();
    this.restVertices = Float32Array.from(data);
    this.out = Float32Array.from(data);

    // Weld the vertices that sit on one spot.
    const vertexCount = data.length / 3;
    this.particleOf = new Int32Array(vertexCount);
    const byKey = new Map<string, number>();
    const rest: number[] = [];
    for (let v = 0; v < vertexCount; v++) {
      const x = data[v * 3], y = data[v * 3 + 1], z = data[v * 3 + 2];
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
      let p = byKey.get(key);
      if (p === undefined) {
        p = rest.length / 3;
        byKey.set(key, p);
        rest.push(x, y, z);
      }
      this.particleOf[v] = p;
    }
    this.restParticles = Float32Array.from(rest);
    this.count = rest.length / 3;
    this.pos = new Float32Array(rest.length);
    this.prev = new Float32Array(rest.length);

    // The triangles' sides are the constraints. The cloth sheets have no index
    // buffer: their vertices are the triangles in order. Babylon hands back an
    // empty list for that, not null.
    const own = mesh.getIndices();
    const indices = own && own.length > 0 ? own : Array.from({ length: vertexCount }, (_, i) => i);
    const seen = new Set<number>();
    const edges: number[] = [];
    for (let i = 0; i + 2 < indices.length; i += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]] as const) {
        const p = this.particleOf[indices[i + a]];
        const q = this.particleOf[indices[i + b]];
        if (p === q) continue;
        const key = p < q ? p * 65536 + q : q * 65536 + p;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(p, q);
      }
    }
    this.edges = Int32Array.from(edges);
    this.restLengths = new Float32Array(edges.length / 2);

    // Bend pairs: neighbours of neighbours that are not neighbours themselves.
    const neighbours = Array.from({ length: this.count }, () => new Set<number>());
    for (let e = 0; e < edges.length; e += 2) {
      neighbours[edges[e]].add(edges[e + 1]);
      neighbours[edges[e + 1]].add(edges[e]);
    }
    const bends: number[] = [];
    const bendSeen = new Set<number>();
    for (let p = 0; p < this.count; p++) {
      for (const q of neighbours[p]) {
        for (const r of neighbours[q]) {
          if (r === p || neighbours[p].has(r)) continue;
          const key = p < r ? p * 65536 + r : r * 65536 + p;
          if (bendSeen.has(key)) continue;
          bendSeen.add(key);
          bends.push(p, r);
        }
      }
    }
    this.bends = Int32Array.from(bends);
    this.bendLengths = new Float32Array(bends.length / 2);

    // Pieces: each hangs from its own top edge.
    this.component = new Int32Array(this.count).fill(-1);
    let pieces = 0;
    for (let start = 0; start < this.count; start++) {
      if (this.component[start] >= 0) continue;
      const stack = [start];
      this.component[start] = pieces;
      while (stack.length) {
        const p = stack.pop()!;
        for (const q of neighbours[p]) {
          if (this.component[q] >= 0) continue;
          this.component[q] = pieces;
          stack.push(q);
        }
      }
      pieces++;
    }

    // Which edge hangs from the bone is decided on the first update, in the world.
    this.pinned = new Uint8Array(this.count);

    mesh.setVerticesData(VertexBuffer.PositionKind, this.out, true);
    // The sheet moves away from its loaded bounds; never cull it on those.
    mesh.alwaysSelectAsActiveMesh = true;
  }

  /** For probes: particles, pinned ones, constraints, and whether it has started. */
  get stats(): { particles: number; pinned: number; edges: number; bends: number; seeded: boolean } {
    let pinned = 0;
    for (const p of this.pinned) pinned += p;
    return { particles: this.count, pinned, edges: this.restLengths.length, bends: this.bendLengths.length, seeded: this.seeded };
  }

  /** Back to the rest pose on the next update (a warp, a model change). */
  reset(): void {
    this.seeded = false;
  }

  update(dt: number): void {
    if (this.count === 0) return;
    const world = this.mesh.computeWorldMatrix(true);
    const at = world.getTranslation();
    const jumped = Vector3.Distance(at, this.lastAt) > RESET_JUMP;
    this.lastAt.copyFrom(at);

    if (!this.seeded || dt > RESET_DT || jumped) {
      for (let p = 0; p < this.count; p++) this.restToWorld(world, p, this.pos);
      this.prev.set(this.pos);
      this.measure();
      this.seeded = true;
      this.accumulator = 0;
    }

    this.accumulator += Math.min(dt, 0.1);
    let steps = 0;
    while (this.accumulator >= STEP && steps < 6) {
      this.accumulator -= STEP;
      this.time += STEP;
      this.step(world);
      steps++;
    }

    // Back into mesh space, every vertex from its particle.
    world.invertToRef(inverse);
    for (let v = 0; v < this.particleOf.length; v++) {
      const p = this.particleOf[v];
      tmp.set(this.pos[p * 3], this.pos[p * 3 + 1], this.pos[p * 3 + 2]);
      Vector3.TransformCoordinatesToRef(tmp, inverse, tmpB);
      this.out[v * 3] = tmpB.x;
      this.out[v * 3 + 1] = tmpB.y;
      this.out[v * 3 + 2] = tmpB.z;
    }
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.out, false, false);
  }

  /** The mesh as loaded, for a model swap or a disposal. */
  restore(): void {
    if (this.mesh.isDisposed()) return;
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, this.restVertices, false, false);
  }

  private step(world: Matrix): void {
    const gravity = GRAVITY * STEP * STEP;
    const breeze = WIND * STEP * STEP;
    const gust = Math.sin(this.time * 1.7) * 0.6 + Math.sin(this.time * 4.3) * 0.4;

    for (let p = 0; p < this.count; p++) {
      const i = p * 3;
      if (this.pinned[p]) {
        this.restToWorld(world, p, this.pos);
        this.prev[i] = this.pos[i];
        this.prev[i + 1] = this.pos[i + 1];
        this.prev[i + 2] = this.pos[i + 2];
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const velocity = (this.pos[i + k] - this.prev[i + k]) * DAMPING;
        this.prev[i + k] = this.pos[i + k];
        this.pos[i + k] += velocity;
      }
      this.pos[i + 1] -= gravity;
      this.pos[i] += breeze * gust * (0.5 + 0.5 * Math.sin(p * 1.3 + this.time));
      this.pos[i + 2] += breeze * gust * 0.5 * Math.cos(p * 0.7 + this.time);
    }

    for (let pass = 0; pass < ITERATIONS; pass++) {
      for (let e = 0; e < this.restLengths.length; e++) {
        const a = this.edges[e * 2];
        const b = this.edges[e * 2 + 1];
        const wa = this.pinned[a] ? 0 : 1;
        const wb = this.pinned[b] ? 0 : 1;
        if (wa + wb === 0) continue;
        const dx = this.pos[b * 3] - this.pos[a * 3];
        const dy = this.pos[b * 3 + 1] - this.pos[a * 3 + 1];
        const dz = this.pos[b * 3 + 2] - this.pos[a * 3 + 2];
        const length = Math.hypot(dx, dy, dz) || 1e-6;
        const k = (length - this.restLengths[e]) / length / (wa + wb);
        this.pos[a * 3] += dx * k * wa;
        this.pos[a * 3 + 1] += dy * k * wa;
        this.pos[a * 3 + 2] += dz * k * wa;
        this.pos[b * 3] -= dx * k * wb;
        this.pos[b * 3 + 1] -= dy * k * wb;
        this.pos[b * 3 + 2] -= dz * k * wb;
      }
      this.relax(this.bends, this.bendLengths, 0.5);
      this.keepOutOfBody();
    }
    this.keepShape(world);
  }

  /** Each free point drawn a little toward where the model puts it. */
  private keepShape(world: Matrix): void {
    const body = this.body();
    const floor = body ? body.getAbsolutePosition().y + FLOOR : -Infinity;
    for (let p = 0; p < this.count; p++) {
      if (this.pinned[p]) continue;
      const i = p * 3;
      tmp.set(this.restParticles[i], this.restParticles[i + 1], this.restParticles[i + 2]);
      Vector3.TransformCoordinatesToRef(tmp, world, tmpB);
      this.pos[i] += (tmpB.x - this.pos[i]) * this.shape;
      this.pos[i + 1] += (tmpB.y - this.pos[i + 1]) * this.shape;
      this.pos[i + 2] += (tmpB.z - this.pos[i + 2]) * this.shape;
      if (this.pos[i + 1] < floor) this.pos[i + 1] = floor;
    }
  }

  /**
   * Rest lengths in the world (the model is scaled), and the pinned edge: the
   * points that stand highest in the world as the cape is worn, which is the
   * shoulders. Nearest the bone is not it (Mantle of Monarch's middle row is),
   * and neither is the end of the sheet's longest side: Cape of Fighter is a
   * hair wider than it is long, and hung from its side.
   */
  private measure(): void {
    for (let e = 0; e < this.restLengths.length; e++) {
      this.restLengths[e] = this.distance(this.pos, this.edges[e * 2], this.edges[e * 2 + 1]);
    }
    for (let e = 0; e < this.bendLengths.length; e++) {
      this.bendLengths[e] = this.distance(this.pos, this.bends[e * 2], this.bends[e * 2 + 1]);
    }

    // Per piece: each ribbon hangs from its own top.
    const low: number[] = [];
    const high: number[] = [];
    for (let p = 0; p < this.count; p++) {
      const c = this.component[p];
      low[c] = Math.min(low[c] ?? Infinity, this.pos[p * 3 + 1]);
      high[c] = Math.max(high[c] ?? -Infinity, this.pos[p * 3 + 1]);
    }
    this.pinned.fill(0);
    for (let p = 0; p < this.count; p++) {
      const c = this.component[p];
      if (this.pos[p * 3 + 1] >= high[c] - (high[c] - low[c]) * PIN_BAND) this.pinned[p] = 1;
    }
  }

  /** One pass of distance constraints, at a stiffness. */
  private relax(pairs: Int32Array, lengths: Float32Array, stiffness: number): void {
    for (let e = 0; e < lengths.length; e++) {
      const a = pairs[e * 2];
      const b = pairs[e * 2 + 1];
      const wa = this.pinned[a] ? 0 : 1;
      const wb = this.pinned[b] ? 0 : 1;
      if (wa + wb === 0) continue;
      const dx = this.pos[b * 3] - this.pos[a * 3];
      const dy = this.pos[b * 3 + 1] - this.pos[a * 3 + 1];
      const dz = this.pos[b * 3 + 2] - this.pos[a * 3 + 2];
      const length = Math.hypot(dx, dy, dz) || 1e-6;
      const k = ((length - lengths[e]) / length / (wa + wb)) * stiffness;
      this.pos[a * 3] += dx * k * wa;
      this.pos[a * 3 + 1] += dy * k * wa;
      this.pos[a * 3 + 2] += dz * k * wa;
      this.pos[b * 3] -= dx * k * wb;
      this.pos[b * 3 + 1] -= dy * k * wb;
      this.pos[b * 3 + 2] -= dz * k * wb;
    }
  }

  /** Pushes free particles out of the capsule around the hero. */
  private keepOutOfBody(): void {
    const body = this.body();
    if (!body) return;
    const origin = body.getAbsolutePosition();
    // The hero's back: his model faces -z, so +z is behind him.
    Vector3.TransformNormalToRef(LOCAL_BACK, body.getWorldMatrix(), back);
    back.y = 0;
    const length = back.length();
    if (length > 1e-6) back.scaleInPlace(1 / length);
    for (let p = 0; p < this.count; p++) {
      if (this.pinned[p]) continue;
      const i = p * 3;
      const height = this.pos[i + 1] - origin.y;
      // Mu La Ronda: behind him down to the floor - a ribbon that reached the ground slid round in front of his feet.
      if (height > BODY_TOP) continue;
      let dx = this.pos[i] - origin.x;
      let dz = this.pos[i + 2] - origin.z;
      const behind = dx * back.x + dz * back.z;
      if (length > 1e-6 && behind < BACK_MIN) {
        dx += back.x * (BACK_MIN - behind);
        dz += back.z * (BACK_MIN - behind);
        this.pos[i] = origin.x + dx;
        this.pos[i + 2] = origin.z + dz;
      }
      if (height < BODY_BOTTOM) continue;
      const d = Math.hypot(dx, dz);
      if (d >= BODY_RADIUS || d < 1e-5) continue;
      const push = BODY_RADIUS / d;
      this.pos[i] = origin.x + dx * push;
      this.pos[i + 2] = origin.z + dz * push;
    }
  }

  private restToWorld(world: Matrix, p: number, into: Float32Array): void {
    tmp.set(this.restParticles[p * 3], this.restParticles[p * 3 + 1], this.restParticles[p * 3 + 2]);
    Vector3.TransformCoordinatesToRef(tmp, world, tmpB);
    into[p * 3] = tmpB.x;
    into[p * 3 + 1] = tmpB.y;
    into[p * 3 + 2] = tmpB.z;
  }

  private distance(array: Float32Array, a: number, b: number): number {
    return Math.hypot(
      array[a * 3] - array[b * 3],
      array[a * 3 + 1] - array[b * 3 + 1],
      array[a * 3 + 2] - array[b * 3 + 2]
    );
  }
}
