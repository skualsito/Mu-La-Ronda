import './style.less';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { GameOptions } from '../../../../../common/gameOptions';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { MuText } from '../../../../components/muText';
import { useUiStageScale } from '../../../../components/uiStage';
import { i18n, t } from '../../../../../i18n';
import { Social } from '../../../../../social';

/**
 * Mu La Ronda: the experience each kill gave, in the top left - the original
 * prints the experience there as a system line (`ReceiveDieExp`,
 * GlobalText 486), in the blue of the system lines. A few lines at most,
 * each one fading out on its own; the newest at the bottom. Master experience
 * says so, in gold. The shares of one kill come as several packets on a high
 * rate server (the plain packet carries 65 535 at most): they add up into one
 * line.
 */

/** 640x480 UI space: under the buff row, and under the performance readout when it shows. */
const X = 6;
const Y = 54;
const PERF_LINES_HEIGHT = 40;
/** In a party the member list takes the top left: the lines go under it, this far below its last row (screen px). */
const PARTY_GAP_PX = 6;
const LINE_HEIGHT = 12;

const MAX_LINES = 5;
const LIFE_MS = 3000;
const FADE_MS = 600;

/** The chat's system line (common/chat.ts, ChatLineType.System). */
const COLOR = 'rgb(100,150,255)';
/** Master experience: the gold of the master level window. */
const MASTER_COLOR = 'rgb(255,204,26)';
/** Packets of the same kill this close together are one share. */
const SAME_KILL_MS = 250;
const BACKGROUND = 'rgba(0,0,0,0.59)';

/** Where the party list ends, in the page's own pixels; null when it is not on screen. */
function partyListBottom(feed: HTMLElement | null): number | null {
  const list = document.querySelector('.party-list');
  const parent = feed?.offsetParent ?? document.body;
  if (!list) return null;
  return list.getBoundingClientRect().bottom - parent.getBoundingClientRect().top;
}

type Line = { id: number; amount: number; master: boolean; killedNetId: number; at: number };

const lineText = (line: Line) =>
  t(line.master ? 'exp.gainedMaster' : 'exp.gained', { amount: line.amount.toLocaleString(i18n.language) });

export const ExpFeed = observer(() => {
  const scale = useUiStageScale();
  const [lines, setLines] = useState<Line[]>([]);
  const nextId = useRef(1);
  const feedRef = useRef<HTMLDivElement>(null);

  useEventBus('experienceGained', ({ added, master, killedNetId }) => {
    const now = performance.now();
    setLines(old => {
      const last = old.at(-1);
      if (last && last.master === master && last.killedNetId === killedNetId && now - last.at < SAME_KILL_MS) {
        return [...old.slice(0, -1), { ...last, amount: last.amount + added }];
      }
      const line = { id: nextId.current++, amount: added, master, killedNetId, at: now };
      return [...old.slice(-(MAX_LINES - 1)), line];
    });
  });

  // Drop the lines that have faded out; nothing runs while there are none.
  useEffect(() => {
    if (!lines.length) return;
    const oldest = lines[0].at;
    const timer = setTimeout(
      () => setLines(old => old.filter(l => performance.now() - l.at < LIFE_MS)),
      Math.max(16, oldest + LIFE_MS - performance.now())
    );
    return () => clearTimeout(timer);
  }, [lines]);

  if (!lines.length) return null;

  let top = (Y + (GameOptions.performanceReadout ? PERF_LINES_HEIGHT : 0)) * scale;
  const below = Social.inParty ? partyListBottom(feedRef.current) : null;
  if (below !== null) top = Math.max(top, below + PARTY_GAP_PX);
  return (
    <div ref={feedRef} className="exp-feed" style={{ left: X * scale, top, transform: `scale(${scale})` }}>
      {lines.map((line, index) => (
        <MuText
          key={line.id}
          color={line.master ? MASTER_COLOR : COLOR}
          background={BACKGROUND}
          className="exp-feed-line"
          style={{ top: index * LINE_HEIGHT, animationDelay: `${LIFE_MS - FADE_MS}ms`, animationDuration: `${FADE_MS}ms` }}
          text={lineText(line)}
        />
      ))}
    </div>
  );
});
