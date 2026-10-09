/**
 * Mu La Ronda: the options' "Clear cache" button - what Ctrl+F5 does, for a
 * player who cannot press it (the installed app, a phone) or does not know to.
 *
 * Drops what the asset worker (public/sw.js) kept - all but the music, which
 * is 75 MB and never changes - unregisters the worker so the next load
 * installs it fresh, and reloads with a throwaway query so the browser asks
 * the server for the page again instead of answering from its own cache.
 */

const ASSET_CACHE = 'mu-assets-v1';
const META_CACHE = 'mu-meta';
const KEPT = /\/Music\/|\.(mp3|ogg|wav)$/i;

export async function clearCacheAndReload(): Promise<void> {
  try {
    if ('caches' in window) {
      const cache = await caches.open(ASSET_CACHE);
      for (const request of await cache.keys()) {
        if (!KEPT.test(new URL(request.url).pathname)) await cache.delete(request);
      }
      await caches.delete(META_CACHE);
      for (const name of await caches.keys()) {
        if (name !== ASSET_CACHE) await caches.delete(name);
      }
    }
    if ('serviceWorker' in navigator) {
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        await registration.unregister();
      }
    }
  } catch {
    // Whatever could not be cleared, the reload below still fetches the page anew.
  }

  const url = new URL(location.href);
  url.searchParams.set('r', Date.now().toString(36));
  location.replace(url.toString());
}
