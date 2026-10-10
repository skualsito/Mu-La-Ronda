import { observable, runInAction } from 'mobx';
import { MarketError, vipCheckout, vipOrders, vipPrices, type VipOrder } from '../marketplace/api';
import { Social } from '../social';
import type { VipTierInfo } from './vip';

/**
 * Mu La Ronda: paying VIP Plata or Oro with Mercado Pago from the VIP window
 * (marketplace/server/vipPayments.ts). The window opens Mercado Pago in another tab, and this
 * watches the order until the service says it was granted - the VIP itself reaches the game
 * as the usual "VIP ... activo hasta" line.
 */

export const vipPay = observable({
  /** Pesos per tier (2 silver, 3 gold); null until the service answered. */
  prices: null as Record<number, number> | null,
  /** Whether Mercado Pago is set up on the server. */
  enabled: false,
  /** With Plata running: the months a move up to Oro is charged for. */
  upgradeMonths: null as number | null,
  busy: false,
  /** What the window says at the bottom while a payment is under way. */
  message: null as { text: string; ok: boolean | null } | null,
});

const POLL_MS = 5000;
const WATCH_FOR_MS = 20 * 60 * 1000;
let watching: ReturnType<typeof setInterval> | null = null;

export const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

/** The price in pesos with a discount code, as the service charges it (never under a peso). */
export const discountedPesos = (full: number, percent: number | null) =>
  percent ? Math.max(1, Math.round(full * (100 - Math.min(100, Math.max(0, percent)))) / 100) : full;

const say = (text: string, ok: boolean | null) =>
  runInAction(() => {
    vipPay.message = { text, ok };
  });

export async function loadVipPrices(): Promise<void> {
  try {
    const { prices, enabled, upgradeMonths } = await vipPrices();
    runInAction(() => {
      vipPay.prices = prices;
      vipPay.enabled = enabled;
      vipPay.upgradeMonths = upgradeMonths ?? null;
    });
  } catch {
    runInAction(() => {
      vipPay.enabled = false;
    });
  }
}

/**
 * Called from the confirm's click: the tab is opened right away (a tab opened after an await is
 * what popup blockers stop) and pointed at Mercado Pago once the checkout exists.
 */
export async function payWithMercadoPago(tier: VipTierInfo, months: number, code?: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  runInAction(() => {
    vipPay.busy = true;
  });
  say('Preparando el pago…', null);
  try {
    const { order, url } = await vipCheckout(tier.tier, months, code);
    if (tab && !tab.closed) tab.location.href = url;
    else window.open(url, '_blank');
    say(`Pagá en la pestaña de Mercado Pago. Cuando se apruebe, el VIP ${tier.name} se acredita solo.`, null);
    watch(order, tier);
  } catch (error) {
    tab?.close();
    say(error instanceof MarketError || error instanceof Error ? error.message : 'No se pudo iniciar el pago.', false);
  } finally {
    runInAction(() => {
      vipPay.busy = false;
    });
  }
}

function watch(id: string, tier: VipTierInfo): void {
  if (watching) clearInterval(watching);
  const until = Date.now() + WATCH_FOR_MS;
  watching = setInterval(async () => {
    if (Date.now() > until) {
      stop();
      return;
    }
    let order: VipOrder | undefined;
    try {
      order = (await vipOrders()).orders.find(o => o.id === id);
    } catch {
      return;
    }
    if (!order) return;
    if (order.status === 'granted') {
      stop();
      say(`¡Pago acreditado! Ya tenés tu VIP ${tier.name}.`, true);
      Social.sendChat('/vip');
    } else if (order.status === 'paid') {
      say(order.note ? `Pago recibido, pero falta acreditarlo: ${order.note}` : 'Pago recibido, acreditando el VIP…', null);
    } else if (order.status === 'rejected' || order.status === 'cancelled') {
      stop();
      say('Mercado Pago no aprobó el pago; no se cobró nada.', false);
    }
  }, POLL_MS);
}

function stop(): void {
  if (watching) clearInterval(watching);
  watching = null;
}
