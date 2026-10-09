/**
 * Mu La Ronda: a yes/no request from another player answers itself "no" after
 * 20 seconds - trade, party, guild join, alliance / hostility, guild war, duel.
 * Before, the window stayed open until clicked, and a request left behind
 * blocked the next one. A trade request is also turned down as soon as the
 * player who asked walks away (out of sight, or further than trading range).
 */

import { reaction } from 'mobx';
import { Economy } from '../economy';
import { Social } from '../social';
import { Store } from '../store';
import { answerDuelRequest, duelRequest } from '../events/duel';

/** How long a request waits for an answer. */
export const REQUEST_TIMEOUT_MS = 20_000;

/** Further than this many tiles from the hero, a trade request is withdrawn. */
export const TRADE_REQUEST_RANGE = 8;

/** How often a pending trade request checks where its sender went. */
const TRADE_CHECK_MS = 500;

type Watched = {
  /** The pending request, or null. Compared by identity: a new request restarts the clock. */
  read: () => object | null;
  /** Answers it "no". */
  decline: () => void;
};

const WATCHED: readonly Watched[] = [
  { read: () => Economy.tradeRequest, decline: () => Economy.answerTradeRequest(false) },
  { read: () => Social.partyRequest, decline: () => Social.partyRespond(false) },
  { read: () => Social.guildJoinRequest, decline: () => Social.guildJoinRespond(false) },
  { read: () => Social.guildRelationRequest, decline: () => Social.guildRelationRespond(false) },
  { read: () => Social.guildWarRequest, decline: () => Social.guildWarRespond(false) },
  { read: () => duelRequest(), decline: () => answerDuelRequest(false) },
];

/** The tiles between the hero and the player named `name`, or null when they are not in sight. */
export function tilesTo(name: string): number | null {
  const world = Store.world;
  if (!world) return null;
  let hero: { x: number; z: number } | null = null;
  let other: { x: number; z: number } | null = null;
  for (const entity of world.playersQuery.entities) {
    if (!entity.transform) continue;
    if (entity.localPlayer) hero = entity.transform.pos;
    else if (entity.objectNameInWorld === name) other = entity.transform.pos;
  }
  if (!hero || !other) return null;
  return Math.max(Math.abs(hero.x - other.x), Math.abs(hero.z - other.z));
}

let installed = false;

export function installRequestTimeouts(): void {
  if (installed) return;
  installed = true;

  for (const watched of WATCHED) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    reaction(
      () => watched.read(),
      request => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (!request) return;
        timer = setTimeout(() => {
          timer = null;
          if (watched.read() === request) watched.decline();
        }, REQUEST_TIMEOUT_MS);
      }
    );
  }

  // The trade request's sender walking off.
  setInterval(() => {
    const request = Economy.tradeRequest;
    if (!request) return;
    const tiles = tilesTo(request.name);
    if (tiles === null || tiles > TRADE_REQUEST_RANGE) Economy.answerTradeRequest(false);
  }, TRADE_CHECK_MS);
}
