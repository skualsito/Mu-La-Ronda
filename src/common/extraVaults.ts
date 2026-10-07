import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: the VIP's extra vaults - bronze 3, silver 6, gold 9, besides the
 * account's own (number 0). The server's /baul plugin
 * (marketplace/openmu/src/GameLogic/VipSystem/ExtraVaultChatCommandPlugIn.cs)
 * says which vault is shown and how many there are with a line "Baul 2/9",
 * when the vault opens and after every switch; that line is read here and
 * not shown. A switch is /baul N, sent from the vault window.
 */
export const extraVaults = observable({
  /** The vault shown, 0 the account's own. */
  current: 0,
  /** Extra vaults the VIP gives; 0 hides the selector. */
  allowed: 0,
  /** A switch is on its way; the next line answers it. */
  switching: false,
});

const STATE = /^Baul (\d+)\/(\d+)$/;
const REFUSAL = /^Baul: /;

/** Reads a server line; true when it is the hidden state line. */
export function readVaultLine(text: string): boolean {
  const state = STATE.exec(text);
  if (state) {
    runInAction(() => {
      extraVaults.current = Number(state[1]);
      extraVaults.allowed = Number(state[2]);
      extraVaults.switching = false;
    });
    return true;
  }
  if (REFUSAL.test(text)) {
    runInAction(() => {
      extraVaults.switching = false;
    });
  }
  return false;
}

/**
 * Asks for vault `number` (wrapping around) through `send` (the chat), unless
 * a switch is already on its way.
 */
export function switchVault(number: number, send: (command: string) => boolean): void {
  const count = extraVaults.allowed + 1;
  if (extraVaults.switching || count <= 1) return;
  const next = ((number % count) + count) % count;
  if (send(`/baul ${next}`)) {
    runInAction(() => {
      extraVaults.switching = true;
    });
  }
}

/** The vault closed: the next one opens on the account's own. */
export function resetExtraVaults(): void {
  runInAction(() => {
    extraVaults.current = 0;
    extraVaults.switching = false;
  });
}
