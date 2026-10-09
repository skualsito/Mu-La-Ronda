import type { AnimationGroup, Node } from '../libs/babylon/exports';

/**
 * Mu La Ronda: a model's animation clips, cloned the first time each is asked for.
 *
 * `instantiateModelsToScene` clones *every* clip of a model for every copy of
 * it, and the player rig carries some 236 of them: a crowd of 17 players in
 * the Lorencia ring held 5,600 AnimationGroups (and their per-bone targeted
 * animations) for the five or six clips each one ever plays - the memory and
 * the per-frame bookkeeping the PWA choked on (2026-10-09). The model loader
 * now instantiates without the clips and hands out this list instead.
 *
 * It is an array to its readers: `groups[i]` and `groups.at(i)` clone clip `i`
 * on first use (onto the copy's own nodes, as `instantiateModelsToScene`
 * would) and `length` counts them all. Iterating it - `for…of`, `forEach`,
 * `some`, `find`… - walks only the clips cloned so far, with their real
 * indices: a clip that was never cloned is not playing and holds nothing to
 * stop or dispose. Whatever must happen to every clip as it comes into being
 * goes through `forEachAnimationGroup`, which also runs for the clips cloned
 * later.
 */

type Hook = (group: AnimationGroup, index: number) => void;

type State = {
  sources: readonly (AnimationGroup | undefined)[];
  slots: (AnimationGroup | undefined)[];
  hooks: Hook[];
  make: (source: AnimationGroup) => AnimationGroup | null;
};

const STATE = Symbol('lazyAnimationGroups');

function stateOf(groups: readonly AnimationGroup[]): State | undefined {
  return (groups as unknown as { [STATE]?: State })[STATE];
}

function materialize(state: State, index: number): AnimationGroup | undefined {
  if (!Number.isInteger(index) || index < 0 || index >= state.slots.length) return undefined;
  const held = state.slots[index];
  if (held) return held;

  const source = state.sources[index];
  if (!source) return undefined;
  const group = state.make(source);
  if (!group) return undefined;

  state.slots[index] = group;
  for (const hook of state.hooks) hook(group, index);
  return group;
}

/** The clips cloned so far, with their indices. */
function entries(state: State): [AnimationGroup, number][] {
  const out: [AnimationGroup, number][] = [];
  state.slots.forEach((group, index) => {
    if (group) out.push([group, index]);
  });
  return out;
}

/**
 * An array view over `sources` that clones clip `i` with `make` the first
 * time index `i` is read. `make` returns null when the copy is gone (its
 * meshes disposed): nothing is cloned then and the read is undefined.
 */
export function lazyAnimationGroups(
  sources: readonly AnimationGroup[],
  make: (source: AnimationGroup) => AnimationGroup | null
): AnimationGroup[] {
  const state: State = {
    sources: [...sources],
    slots: new Array<AnimationGroup | undefined>(sources.length).fill(undefined),
    hooks: [],
    make,
  };

  const iterate = <T>(fn: (list: [AnimationGroup, number][]) => T) => fn(entries(state));

  const methods: Record<PropertyKey, unknown> = {
    [Symbol.iterator]: function* () {
      for (const [group] of entries(state)) yield group;
    },
    forEach: (cb: (g: AnimationGroup, i: number) => void) =>
      iterate(list => list.forEach(([g, i]) => cb(g, i))),
    some: (cb: (g: AnimationGroup, i: number) => boolean) => iterate(list => list.some(([g, i]) => cb(g, i))),
    every: (cb: (g: AnimationGroup, i: number) => boolean) => iterate(list => list.every(([g, i]) => cb(g, i))),
    find: (cb: (g: AnimationGroup, i: number) => boolean) => iterate(list => list.find(([g, i]) => cb(g, i))?.[0]),
    findIndex: (cb: (g: AnimationGroup, i: number) => boolean) =>
      iterate(list => list.find(([g, i]) => cb(g, i))?.[1] ?? -1),
    filter: (cb: (g: AnimationGroup, i: number) => boolean) =>
      iterate(list => list.filter(([g, i]) => cb(g, i)).map(([g]) => g)),
    map: <T>(cb: (g: AnimationGroup, i: number) => T) => iterate(list => list.map(([g, i]) => cb(g, i))),
    indexOf: (g: AnimationGroup) => state.slots.indexOf(g),
    includes: (g: AnimationGroup) => state.slots.includes(g),
    at: (i: number) => materialize(state, i < 0 ? state.slots.length + i : i),
    push: (...added: AnimationGroup[]) => {
      for (const group of added) {
        const index = state.slots.push(group) - 1;
        (state.sources as (AnimationGroup | undefined)[]).push(undefined);
        for (const hook of state.hooks) hook(group, index);
      }
      return state.slots.length;
    },
  };

  return new Proxy([] as AnimationGroup[], {
    get(target, prop) {
      if (prop === STATE) return state;
      if (prop === 'length') return state.slots.length;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return materialize(state, Number(prop));
      if (prop in methods) return methods[prop];
      // Anything else (slice, concat, …) sees the clips cloned so far.
      const cloned = entries(state).map(([g]) => g);
      const value = Reflect.get(cloned, prop);
      return typeof value === 'function' ? value.bind(cloned) : value;
    },
    has(target, prop) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < state.slots.length;
      return prop === 'length' || prop in methods;
    },
  });
}

/**
 * Runs `fn` on every clip of `groups` - now for the ones that exist, and, on
 * a lazy list, later for each one as it is cloned. On a plain array it is
 * `forEach`.
 */
export function forEachAnimationGroup(groups: readonly AnimationGroup[], fn: Hook): void {
  const state = stateOf(groups);
  if (!state) {
    groups.forEach(fn);
    return;
  }
  for (const [group, index] of entries(state)) fn(group, index);
  state.hooks.push(fn);
}

/**
 * Clip `index`'s source animation data without cloning it (a clone shares
 * its `Animation`s with the source): for reading keys and ranges.
 */
export function animationGroupSource(groups: readonly AnimationGroup[], index: number): AnimationGroup | undefined {
  const state = stateOf(groups);
  if (!state) return groups[index];
  return state.slots[index] ?? state.sources[index];
}

/** How many clips are cloned (all of them, on a plain array). */
export function clonedAnimationGroupCount(groups: readonly AnimationGroup[]): number {
  const state = stateOf(groups);
  return state ? entries(state).length : groups.length;
}

/**
 * The key a node is found by in its copy: the names from its model's root
 * down to it. `instantiateModelsToScene` names every clone after its source
 * (the loader passes `name => name`), so a source node and its clone share
 * it - as long as the map is made before the loader renames the copy's root.
 */
function pathOf(node: Node): string {
  const names: string[] = [];
  for (let n: Node | null = node; n; n = n.parent) names.push(n.name);
  return names.reverse().join('/');
}

function keyedNodes(roots: readonly Node[]): Map<string, Node | null> {
  const keyed = new Map<string, Node | null>();
  for (const root of roots) {
    for (const node of [root, ...root.getDescendants(false)]) {
      const key = pathOf(node);
      keyed.set(key, keyed.has(key) ? null : node);
    }
  }
  return keyed;
}

/**
 * Maps a model's source nodes onto their clones by `pathOf`, for retargeting
 * clips. `ambiguous` when some node cannot be told apart that way (two share
 * a path, or one has no clone at that path): the loader then clones every
 * clip up front, as `instantiateModelsToScene` did.
 */
export function cloneTargetMap(
  sourceRoots: readonly Node[],
  cloneRoots: readonly Node[]
): { map: Map<Node, Node>; ambiguous: boolean } {
  const clones = keyedNodes(cloneRoots);
  const map = new Map<Node, Node>();
  let ambiguous = false;
  for (const [key, source] of keyedNodes(sourceRoots)) {
    const clone = clones.get(key);
    if (!source || !clone) {
      ambiguous = true;
      continue;
    }
    map.set(source, clone);
  }
  return { map, ambiguous };
}
