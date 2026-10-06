import './style.less';
import { useState } from 'react';

/**
 * Mu La Ronda's loading look: the logo, a bar and a tip. Shared by the opening
 * screen (`pages/rondaLoader`) and the loading screen shown on every map
 * change (`components/loadingScreen`), so all of them read as the same thing.
 */

const TIPS = [
  'Servidor en beta: rates altos para que pruebes todo.',
  'Al llegar a nivel 400 escribí /reset para resetear.',
  'Con /resetinfo ves tus resets y lo que cuesta el próximo.',
  'Encontraste un bug? Avisanos, estamos en beta.',
];

type Props = {
  /** 0..1 */
  progress: number;
  /** The line under the bar. */
  status: string;
  /** Fading off the scene behind it. */
  leaving?: boolean;
  /** Above the in-game UI (the map-change screen) rather than the pregame. */
  overlay?: boolean;
};

export function RondaLoadingView({ progress, status, leaving, overlay }: Props) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <div
      className={`ronda-loader${overlay ? ' is-overlay' : ''}${leaving ? ' is-leaving' : ''}`}
    >
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
        <p className="ronda-status">{status}</p>
      </main>

      <footer className="ronda-tip">{tip}</footer>
    </div>
  );
}
