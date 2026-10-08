import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: the account's VIP as the server last described it. The server's
 * VIP plugin (marketplace/openmu/src/GameLogic/VipSystem) answers /vip, a
 * purchase and every entry into the world with one blue line - "VIP Oro activo
 * hasta 06/11/2026: ..." or "VIP: no tenes VIP ..." - and this is read from it.
 * The window (rondaPanels, game menu → VIP) asks with /vip when it opens.
 */

export type VipTierInfo = { tier: number; name: string; price: number; bonus: number };

/** The same tiers, prices and bonuses as the server's Vip.cs (zen during the beta). */
export const VIP_TIERS: readonly VipTierInfo[] = [
  { tier: 1, name: 'Bronce', price: 200_000_000, bonus: 10 },
  { tier: 2, name: 'Plata', price: 500_000_000, bonus: 20 },
  { tier: 3, name: 'Oro', price: 1_000_000_000, bonus: 30 },
];

export const vipState = observable({
  /** Null until the server has said. */
  known: false,
  name: null as string | null,
  until: null as string | null,
  /** A higher tier bought to start when the current one ends. */
  next: null as { name: string; until: string } | null,
  /** A purchase is on its way; the next VIP line answers it. */
  buying: false,
});

/** The window's discount code as the server checked it (/vip codigo X). */
export const vipCode = observable({
  code: '',
  /** Null while it is being checked or when it can't be used. */
  percent: null as number | null,
  /** Why it can't be used, as the server put it. */
  refusal: null as string | null,
});

const ACTIVE = /^VIP (Bronce|Plata|Oro) activo hasta (\d{2}\/\d{2}\/\d{4})/;
const NEXT = /Despues sigue (Bronce|Plata|Oro) hasta (\d{2}\/\d{2}\/\d{4})/;
const CODE = /^VIP codigo (\S+): (?:(\d+)% de descuento\.?|(.+))$/;
const NONE = /^VIP: no tenes VIP/;
const ANY = /^VIP[ :]/;

/** Reads a server line; true when it was one of the VIP plugin's. */
export function readVipLine(text: string): boolean {
  if (!ANY.test(text)) return false;
  const active = ACTIVE.exec(text);
  runInAction(() => {
    vipState.buying = false;
    if (active) {
      vipState.known = true;
      vipState.name = active[1];
      vipState.until = active[2];
      const next = NEXT.exec(text);
      vipState.next = next ? { name: next[1], until: next[2] } : null;
    } else if (NONE.test(text)) {
      vipState.known = true;
      vipState.name = null;
      vipState.until = null;
      vipState.next = null;
    }
  });
  return true;
}

/** Starts checking a code: the answer comes as a server line. */
export function checkingVipCode(code: string): void {
  runInAction(() => {
    vipCode.code = code;
    vipCode.percent = null;
    vipCode.refusal = null;
  });
}

/** Reads the answer to /vip codigo X; true when it was one (it is not shown in the chat). */
export function readVipCodeLine(text: string): boolean {
  const match = CODE.exec(text);
  if (!match) return false;
  runInAction(() => {
    if (match[1].toUpperCase() !== vipCode.code) return;
    vipCode.percent = match[2] ? Number(match[2]) : null;
    vipCode.refusal = match[3] ?? null;
  });
  return true;
}

/** The price with the checked discount, rounded down as the server does. */
export function discounted(price: number, percent: number | null): number {
  if (!percent) return price;
  return Math.floor((price * (100 - Math.min(100, Math.max(0, percent)))) / 100);
}

export function markVipBuying(): void {
  runInAction(() => {
    vipState.buying = true;
  });
}

export function resetVip(): void {
  runInAction(() => {
    vipState.known = false;
    vipState.name = null;
    vipState.until = null;
    vipState.next = null;
    vipState.buying = false;
  });
}
