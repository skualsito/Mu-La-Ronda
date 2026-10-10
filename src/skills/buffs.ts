/**
 * Active buffs / debuffs of the hero with the moment each one arrived.
 *
 * Driven by `Store.buffs` (MagicEffectStatus 0x07 / MagicEffectCancelled,
 * `logic.ts`): a MobX reaction stamps every newly present effect id with the
 * layer clock. OpenMU S6 sends no durations: Mu La Ronda's server answers
 * /buffs with each effect's seconds left (MlrBuffsChatCommandPlugIn.cs), asked
 * when a tooltip opens; until then `buffRemaining` counts down the effects
 * whose duration formula the client knows (`recipes.ts`), and answers `null`
 * otherwise.
 *
 * Read by the buff bar (`ui/components/buffBar`) through `skills.activeBuffs`
 * / `skills.buffRemaining`, and by the usability rules (`usability.ts`).
 */
import { reaction } from 'mobx';
import type { ENUM_WORLD } from '../common/types';
import type { SkillLayer } from './layer';
import { buffRecipe, type BuffKind } from './recipes';
import { Store } from '../store';

// ---- 1. tuning -------------------------------------------------------------

// Nothing to tune: the clock is the frame clock and durations are recipes.

// ---- 2. state + readers ----------------------------------------------------

export interface ActiveBuff {
  id: number;
  name: string;
  kind: BuffKind;
  /** Layer-clock seconds when the effect appeared. */
  startedAt: number;
}

/** Seconds of `update` since the last reset - the layer's own clock. */
let clock = 0;
/** Effect id → clock seconds when it appeared. */
const startedAt = new Map<number, number>();
/** Mu La Ronda: effect id → clock seconds when it runs out, as the server said (null: it lasts). */
const serverEnds = new Map<number, number | null>();

function noteBuffs(ids: readonly number[] | undefined): void {
  // Defensive: a reaction whose expression threw hands over `undefined`.
  if (!ids) return;
  for (const id of ids) {
    if (!startedAt.has(id)) {
      startedAt.set(id, clock);
      serverEnds.delete(id);
    }
  }
  for (const id of Array.from(startedAt.keys())) {
    if (!ids.includes(id)) {
      startedAt.delete(id);
      serverEnds.delete(id);
    }
  }
}

const BUFFS_PREFIX = 'Buffs: ';
/** At most one /buffs a while: hovering icon after icon asks once. */
const ASK_EVERY_SECONDS = 2;
let lastAsked = -Infinity;

/**
 * Mu La Ronda: asks the server for the effects' time left (a recast restarts one, so it is asked
 * again each time a tooltip opens). `send` puts the command on the wire unseen.
 */
export function requestBuffTimes(send: (command: string) => void): void {
  if (clock - lastAsked < ASK_EVERY_SECONDS) return;
  lastAsked = clock;
  send('/buffs');
}

/** Reads the server's "Buffs: effect=seconds;..." line; true when it was one (hidden from the chat). */
export function readBuffsLine(text: string): boolean {
  if (!text.startsWith(BUFFS_PREFIX)) return false;
  for (const pair of text.slice(BUFFS_PREFIX.length).split(';')) {
    const [rawId, rawSeconds] = pair.split('=');
    const id = Number(rawId);
    const seconds = Number(rawSeconds);
    if (!rawId || rawSeconds === undefined || !Number.isFinite(id) || !Number.isFinite(seconds)) continue;
    serverEnds.set(id, seconds < 0 ? null : clock + seconds);
  }
  return true;
}

/** Disposer of the `Store.buffs` reaction once it is running. */
let stopWatching: (() => void) | null = null;

/**
 * Start following `Store.buffs`. Deferred to the first `update` on purpose:
 * `store.ts` imports (through `logic.ts` and the facade) this very file, so
 * at module-evaluation time `Store` is still in its temporal dead zone and a
 * top-level reaction throws `Cannot access 'Store' before initialization`.
 * By the first frame every module has finished evaluating.
 *
 * `Store.buffs` is replaced wholesale on every change, so the reaction fires
 * once per packet; `fireImmediately` catches a hero that logged in buffed.
 */
function ensureWatching(): void {
  if (stopWatching) return;
  stopWatching = reaction(() => Store.buffs, noteBuffs, { fireImmediately: true });
}

/**
 * The hero's effects in the original's bar order (`CNewUIBuffWindow::
 * BuffSort`): buffs first, newest leftmost; debuffs after, oldest first.
 */
export function activeBuffs(): ActiveBuff[] {
  const buffs: ActiveBuff[] = [];
  const debuffs: ActiveBuff[] = [];
  for (const id of Store.buffs) {
    const recipe = buffRecipe(id);
    const entry: ActiveBuff = {
      id,
      name: recipe.name,
      kind: recipe.kind,
      startedAt: startedAt.get(id) ?? clock,
    };
    if (recipe.kind === 'debuff') debuffs.push(entry);
    else buffs.unshift(entry);
  }
  return buffs.concat(debuffs);
}

/** Whether the hero currently carries this effect. */
export function hasBuff(effectId: number): boolean {
  return Store.buffs.includes(effectId);
}

/**
 * Seconds until the effect runs out by the client's best estimate, or
 * `null` when the server never told and no formula is known.
 */
export function buffRemaining(effectId: number): number | null {
  if (serverEnds.has(effectId)) {
    const end = serverEnds.get(effectId);
    return end === null || end === undefined ? null : Math.max(0, end - clock);
  }
  const started = startedAt.get(effectId);
  const duration = buffRecipe(effectId).durationSeconds;
  if (started === undefined || !duration) return null;
  const total = duration(Store.playerData.eng);
  return Math.max(0, total - (clock - started));
}

function update(_map: ENUM_WORLD, dt: number): void {
  ensureWatching();
  clock += dt;
}

function reset(): void {
  // The buffs themselves survive a warp (the server re-sends nothing), so
  // their start stamps do too; only the clock is rebased.
  const now = clock;
  for (const [id, at] of startedAt) startedAt.set(id, at - now);
  for (const [id, end] of serverEnds) serverEnds.set(id, end === null ? null : end - now);
  lastAsked -= now;
  clock = 0;
}

// ---- 3. the layer ----------------------------------------------------------

export const buffsLayer: SkillLayer = {
  name: 'buffs',
  update,
  reset,
};
