import './style.less';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import { ServerConfig, playableHere } from '../../../common/serverConfig';
import { ServerList } from '../../../common/serverList';
import { loadVersionUi, versionUi } from '../../../version';
import type { PregameBackdrop } from '../../../version/uiContract';
import { setSceneCovered } from '../../../common/sceneCover';
import { pregameLoad } from '../../../common/pregameLoad';

/**
 * Mu La Ronda's opening screen, in place of the upstream world picker
 * (`preloaderPage`): a loading bar over the login scene that loads behind it,
 * and then straight into the server select - no Start button, no worlds card.
 *
 * The world is the one published as `Mu La Ronda` in the server list
 * (deploy/serverlist.template.md), falling back to the first listed world this
 * client can play, and to whatever is selected if the list never arrives.
 */

const WORLD_NAME = 'Mu La Ronda';

/** A load that never finishes still enters after this long. */
const ENTER_ANYWAY_MS = 20000;

/** Time to let the full bar be seen before the screen fades off it. */
const SETTLE_MS = 500;

/** How long the fade off the login scene takes. */
const LEAVE_MS = 400;

/** The share of the bar the character scene's scenery takes, after the login scene. */
const CHARACTERS_SHARE = 0.2;

const TIPS = [
  'Servidor en beta: rates altos para que pruebes todo.',
  'Al llegar a nivel 400 escribí /reset para resetear.',
  'Con /resetinfo ves tus resets y lo que cuesta el próximo.',
  'Encontraste un bug? Avisanos, estamos en beta.',
];

/** Same reading of the loading behind the page as the upstream preloader. */
function backgroundLoad(backdrop: PregameBackdrop | null): {
  progress: number;
  done: boolean;
} {
  const loading = Store.sceneLoading;
  const loaded = Store.loadingProgress;
  const warmed = pregameLoad.characters;

  if (!backdrop) return { progress: 0, done: false };

  const loginReady =
    !loading &&
    (backdrop.kind !== 'world' || Store.world?.mapIndex === backdrop.login);
  const login = loginReady ? 1 : loading ? loaded : 0;

  if (backdrop.kind !== 'world') return { progress: login, done: loginReady };

  return {
    progress: login * (1 - CHARACTERS_SHARE) + warmed * CHARACTERS_SHARE,
    done: loginReady && warmed >= 1,
  };
}

/** The world to enter, or null while the list may still bring it. */
function pickWorld(listSettled: boolean): string | null {
  const all = ServerConfig.all;
  const named = all.find(
    w => w.listed && w.name.trim().toLowerCase() === WORLD_NAME.toLowerCase()
  );

  if (named) return named.id;
  if (!listSettled) return null;

  const listed = all.find(w => w.listed && playableHere(w));

  return listed?.id ?? (ServerConfig.isEmpty ? null : ServerConfig.active.id);
}

export const RondaLoader = observer(() => {
  const [backdrop, setBackdrop] = useState<PregameBackdrop | null>(
    () => versionUi()?.pregame.backdrop ?? null
  );
  const [timedOut, setTimedOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const timer = useRef(0);

  useEffect(() => {
    if (!backdrop)
      void loadVersionUi().then(ui => setBackdrop(ui.pregame.backdrop));
  }, [backdrop]);

  // Opaque over the scene until it starts to fade off it.
  useEffect(() => {
    setSceneCovered(true);
    const anyway = window.setTimeout(() => setTimedOut(true), ENTER_ANYWAY_MS);

    return () => {
      setSceneCovered(false);
      window.clearTimeout(anyway);
      window.clearTimeout(timer.current);
    };
  }, []);

  const load = backgroundLoad(backdrop);
  const listSettled =
    timedOut || ServerList.state === 'ok' || ServerList.state === 'error';
  const world = pickWorld(listSettled);
  const ready = (load.done || timedOut) && world !== null;

  // Ready: let the full bar show, pick the world and start the fade...
  useEffect(() => {
    if (!ready || leaving || world === null) return;

    timer.current = window.setTimeout(() => {
      ServerConfig.select(world);
      ServerConfig.markPlayed(world);
      setLeaving(true);
      setSceneCovered(false);
    }, SETTLE_MS);

    return () => window.clearTimeout(timer.current);
  }, [ready, leaving, world]);

  // ...and once it has faded, hand over to the server select. Its own effect:
  // `leaving` flipping re-runs the one above, whose cleanup would cancel this.
  useEffect(() => {
    if (!leaving) return;

    const handOver = window.setTimeout(() => Store.playOnline(), LEAVE_MS);

    return () => window.clearTimeout(handOver);
  }, [leaving]);

  const percent = Math.round((load.done ? 1 : load.progress) * 100);

  return (
    <div className={`ronda-loader${leaving ? ' is-leaving' : ''}`}>
      <div className="ronda-glow" aria-hidden />

      <main className="ronda-center">
        <h1 className="ronda-title">
          <img src="./brand/la-ronda.png" alt="Mu La Ronda" draggable={false} />
        </h1>
        <p className="ronda-kicker">MU Online · Season 6 Episode 3</p>
        <span className="ronda-beta">BETA</span>

        <div
          className="ronda-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="ronda-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p className="ronda-status">
          {ready ? 'Entrando…' : `Cargando el mundo… ${percent}%`}
        </p>
      </main>

      <footer className="ronda-tip">{tip}</footer>
    </div>
  );
});
