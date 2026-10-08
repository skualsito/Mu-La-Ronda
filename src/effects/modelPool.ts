import type { AbstractMesh, Material, Node } from '../libs/babylon/exports';
import { disposeLoadedModel, type LoadedModel } from '../common/modelLoader';

/**
 * Mu La Ronda: spare clones of the effect models, handed out again instead of
 * cloned anew. A bolt, an arrow or a Multishot volley lives a fraction of a
 * second, and every one was a fresh `instantiateModelsToScene` - nodes, a
 * skeleton, clips - thrown away right after. A crowd fighting in Arena cloned
 * a hundred a second, and the garbage made the client stop for 400 ms every
 * few seconds to collect it.
 *
 * `spawnModel` dresses a clone for its own spawn (materials, metadata, vertex
 * colours, visibility, the shine clone); what it changes is written down the
 * first time the clone is taken and put back when it is returned, so a reused
 * clone starts exactly as a fresh one would.
 */

/** What `spawnModel` may change on a mesh of the clone. */
type MeshState = {
  mesh: AbstractMesh;
  material: Material | null;
  metadata: Record<string, unknown> | null;
  isVisible: boolean;
  visibility: number;
  enabled: boolean;
  useVertexColors: boolean;
  hasVertexAlpha: boolean;
  isPickable: boolean;
  alwaysSelectAsActiveMesh: boolean;
};

type Pooled = {
  model: LoadedModel;
  meshes: MeshState[];
  /** Every node of the clone as it was loaded; anything added later is dropped on return. */
  nodes: Set<Node>;
};

/** Spare clones kept per model file. */
export const POOL_PER_MODEL = 24;

const spare = new Map<string, Pooled[]>();
const taken = new WeakMap<LoadedModel, { path: string; entry: Pooled }>();

function record(model: LoadedModel): Pooled {
  const meshes = model.mesh.getChildMeshes(false).map(mesh => {
    const m = mesh as AbstractMesh & { useVertexColors?: boolean; hasVertexAlpha: boolean };
    return {
      mesh,
      material: mesh.material,
      metadata: mesh.metadata ? { ...mesh.metadata } : null,
      isVisible: mesh.isVisible,
      visibility: mesh.visibility,
      enabled: mesh.isEnabled(false),
      useVertexColors: m.useVertexColors ?? true,
      hasVertexAlpha: m.hasVertexAlpha,
      isPickable: mesh.isPickable,
      alwaysSelectAsActiveMesh: mesh.alwaysSelectAsActiveMesh,
    };
  });
  return { model, meshes, nodes: new Set<Node>([model.mesh, ...model.mesh.getDescendants(false)]) };
}

/**
 * A clone of `path`: a spare one when there is one, otherwise `load()`.
 * Handed out disabled - the caller enables it once it has dressed it.
 * Enabled here, a clone the spawn failed to dress (it throws, it never gets
 * to it) stood in the world as it came out of the GLB: Decay's landing left
 * the whole Inferno model - the spiral it hides and the black square under
 * it - drawn opaque on the ground.
 */
export async function takeModel(path: string, load: () => Promise<LoadedModel>): Promise<LoadedModel> {
  const entry = spare.get(path)?.pop() ?? record(await load());
  entry.model.mesh.setEnabled(false);
  taken.set(entry.model, { path, entry });
  return entry.model;
}

/**
 * Hands a clone from `takeModel` back. It is detached first, so the effect's
 * own node can be disposed after this without taking the clone with it.
 */
export function returnModel(model: LoadedModel): void {
  const owner = taken.get(model);
  taken.delete(model);

  if (!owner || model.mesh.isDisposed()) {
    disposeLoadedModel(model);
    return;
  }

  const list = spare.get(owner.path) ?? [];
  if (list.length >= POOL_PER_MODEL) {
    disposeLoadedModel(model);
    return;
  }

  // What the spawn added under the clone (the shine copy) is its own.
  for (const node of model.mesh.getDescendants(false)) {
    if (!owner.entry.nodes.has(node) && !node.isDisposed()) node.dispose(false, false);
  }

  for (const s of owner.entry.meshes) {
    const m = s.mesh as AbstractMesh & { useVertexColors?: boolean; hasVertexAlpha: boolean };
    m.material = s.material;
    m.metadata = s.metadata ? { ...s.metadata } : null;
    m.isVisible = s.isVisible;
    m.visibility = s.visibility;
    m.setEnabled(s.enabled);
    if (m.useVertexColors !== undefined) m.useVertexColors = s.useVertexColors;
    m.hasVertexAlpha = s.hasVertexAlpha;
    m.isPickable = s.isPickable;
    m.alwaysSelectAsActiveMesh = s.alwaysSelectAsActiveMesh;
  }

  for (const group of model.animationGroups) {
    group.stop();
    group.speedRatio = 1;
    // A spawn's own hooks (playKeys' hold) must not fire for the next one.
    group.onAnimationGroupEndObservable.clear();
    group.onAnimationGroupLoopObservable.clear();
  }

  model.mesh.setParent(null);
  model.mesh.setEnabled(false);
  list.push(owner.entry);
  spare.set(owner.path, list);
}

/** Map change: the spare clones go with the scene they were made in. */
export function clearModelPool(): void {
  for (const list of spare.values()) for (const entry of list) disposeLoadedModel(entry.model);
  spare.clear();
}

/** How many spare clones are kept (debug). */
export function spareModelCount(): number {
  let n = 0;
  for (const list of spare.values()) n += list.length;
  return n;
}
