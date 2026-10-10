import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: the grand reset as the server last described it. The server's grand reset
 * (marketplace/openmu/src/GameLogic/GrandReset) answers /grandreset, a grand reset and every
 * purchase of its shop with one blue line - "Grand Reset: 2 hechos, 150 monedas. Pide nivel 400
 * y 10 resets; da 100 monedas." - and this is read from it. The window (rondaPanels) opens when
 * the Grand Reset NPC is clicked, and asks with /grandreset.
 */

/** The NPC's monster number (GrandReset.NpcNumber). */
export const GRAND_RESET_NPC = 760;

export const grandResetState = observable({
  known: false,
  enabled: true,
  count: 0,
  coins: 0,
  requiredLevel: 400,
  requiredResets: 10,
  /** Zen it costs; 0 when it is free. */
  requiredMoney: 0,
  coinsPerGrandReset: 0,
});

const LINE =
  /^Grand Reset: (\d+) hechos, (\d+) monedas\. Pide nivel (\d+) y (\d+) resets(?: y ([\d.,]+) zen)?; da (\d+) monedas\./;
const OFF = /^Grand Reset: no esta habilitado/;

/** Reads a server line; true when it was the grand reset's state. */
export function readGrandResetLine(text: string): boolean {
  const match = LINE.exec(text);
  if (match) {
    runInAction(() => {
      grandResetState.known = true;
      grandResetState.enabled = true;
      grandResetState.count = Number(match[1]);
      grandResetState.coins = Number(match[2]);
      grandResetState.requiredLevel = Number(match[3]);
      grandResetState.requiredResets = Number(match[4]);
      grandResetState.requiredMoney = match[5] ? Number(match[5].replace(/[.,]/g, '')) : 0;
      grandResetState.coinsPerGrandReset = Number(match[6]);
    });
    return true;
  }
  if (OFF.test(text)) {
    runInAction(() => {
      grandResetState.known = true;
      grandResetState.enabled = false;
    });
    return true;
  }
  return false;
}

export function resetGrandReset(): void {
  runInAction(() => {
    grandResetState.known = false;
  });
}
