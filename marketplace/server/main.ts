import { createApp } from './app';
import { postgresBoxes } from './boxes';
import { handleVipRoute, sweepVipPayments } from './vipPayments';

/**
 * The marketplace service: the catalogue, the tickets, and the escrow tokens
 * the game server's plugin acts on. The routes are in app.ts; this boots
 * them.
 *
 * It refuses to start without the escrow secret. A token signed with
 * anything else is `badToken` to the plugin, so the service would run and
 * every listing would fail at the game server, which is worse than not
 * running at all.
 */

const PORT = Number(process.env.MARKETPLACE_API_PORT ?? 3300);
const HOSTNAME = process.env.MARKETPLACE_API_HOST ?? '127.0.0.1';
const SWEEP_MS = 30_000;

const secret = process.env.MARKETPLACE_ESCROW_SECRET;
if (!secret) {
  console.error(
    'marketplace: MARKETPLACE_ESCROW_SECRET is not set. It must be the same secret the game ' +
      "server's escrow plugin holds; without it no token this service mints can be acted on."
  );
  process.exit(1);
}

const boxes = postgresBoxes();

const app = createApp({
  boxes,
  secret: new TextEncoder().encode(secret),
  listingFee: Number(process.env.MARKETPLACE_LISTING_FEE ?? 0),
  commissionPercent: Number(process.env.MARKETPLACE_COMMISSION_PERCENT ?? 0),
});

Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  fetch: async (req, server) => {
    // Mu La Ronda: the VIP paid with Mercado Pago and the grand reset shop (vipPayments.ts).
    const url = new URL(req.url);
    if (req.method !== 'OPTIONS' && (url.pathname.startsWith('/api/market/vip/') || url.pathname === '/api/market/grand-shop')) {
      try {
        const routed = await handleVipRoute(req, url, {});
        if (routed) return routed;
      } catch (error) {
        console.error('vip:', error instanceof Error ? error.message : error);
        return new Response(JSON.stringify({ error: 'Algo falló, probá de nuevo.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return app.fetch(req, server);
  },
});

setInterval(() => {
  void sweepVipPayments();
}, 60_000);

/** What the sweep timer runs; exported so it can be called on demand. */
export const sweep = app.sweep;

setInterval(() => {
  void sweep();
}, SWEEP_MS);

console.info(`marketplace: serving on http://${HOSTNAME}:${PORT}`);
