import { reaction } from 'mobx';
import { Store, UIState } from '../store';
import { t } from '../i18n';
import { clearCacheAndReload } from './cacheReset';
import { buildAction } from './buildAction';

/**
 * Mu La Ronda: a page left open across a deploy runs the old build until it
 * is reloaded by hand. The installed app gets a new one each time it is
 * started; a browser tab kept open for days did not, and played the new
 * server with the old client.
 *
 * Every build ships `build.json` with its id (vite.config.ts). The page asks
 * for it on start, every few minutes and on coming back to the tab; when the
 * server has another build it clears the cache and reloads
 * (`clearCacheAndReload`, the options' button) - at once outside the game,
 * and in the game only once the player is back at the character list or the
 * login, so nobody is thrown out mid-fight.
 */

const CHECK_EVERY_MS = 5 * 60_000;
/** Remembers the build a reload was made for: never two reloads for the same one. */
const RELOADED_FOR = 'mu-reloaded-for-build';

async function servedBuild(): Promise<string | null> {
  try {
    const res = await fetch(`./build.json?t=${Date.now().toString(36)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body.build === 'string' ? body.build : null;
  } catch {
    return null;
  }
}

function readReloadedFor(): string | null {
  try {
    return sessionStorage.getItem(RELOADED_FOR);
  } catch {
    return null;
  }
}

function reloadFor(build: string): void {
  try {
    sessionStorage.setItem(RELOADED_FOR, build);
  } catch {
    // Without storage the loop guard is gone; the reload still happens once per check.
  }
  void clearCacheAndReload();
}

let started = false;
let waiting = false;

async function check(): Promise<void> {
  const own = typeof BUILD_ID === 'string' ? BUILD_ID : 'dev';
  const served = await servedBuild();
  const inGame = Store.uiState === UIState.World || Store.uiState === UIState.LoadingWorld;
  const action = buildAction(own, served, inGame, readReloadedFor());
  if (action === 'reload' && served) {
    reloadFor(served);
  } else if (action === 'later' && served && !waiting) {
    waiting = true;
    Store.addNotification(t('update.available'), 'info');
    reaction(
      () => Store.uiState,
      (state, _, r) => {
        if (state === UIState.World || state === UIState.LoadingWorld) return;
        r.dispose();
        reloadFor(served);
      }
    );
  }
}

export function startBuildCheck(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  void check();
  setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
}
