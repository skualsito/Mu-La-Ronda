import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: PvP mode - Ctrl latched. A quick double tap of Ctrl turns it
 * on, another turns it off; while it is on every other player is a target as
 * if Ctrl were held (`attackSystem.canAttackPlayer`), so the hands are free
 * for the potion keys, which do not fire with Ctrl down.
 *
 * Inside the Lorencia ring no Ctrl is needed at all: two players standing in
 * it are fair game for each other (`ringFight`).
 */

/** Longest gap between the two Ctrl presses of a double tap. */
export const DOUBLE_TAP_MS = 350;

const CTRL_CODES: ReadonlySet<string> = new Set(['ControlLeft', 'ControlRight']);

export const PvpMode = observable({ on: false });

let lastCtrlAt = -Infinity;

/**
 * Feeds one first key press (a `keyPressed` code). Returns true when it
 * completed a double tap of Ctrl and flipped the mode. Any other key in
 * between breaks the tap, so Ctrl+key chords never count.
 */
export function notePvpKey(code: string, now: number): boolean {
  if (!CTRL_CODES.has(code)) {
    lastCtrlAt = -Infinity;
    return false;
  }
  if (now - lastCtrlAt <= DOUBLE_TAP_MS) {
    lastCtrlAt = -Infinity;
    runInAction(() => {
      PvpMode.on = !PvpMode.on;
    });
    return true;
  }
  lastCtrlAt = now;
  return false;
}
