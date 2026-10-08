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
 * GlobalText 486). A few lines at most, each one fading out on its own; the
 * newest at the bottom.
 */

/** 640x480 UI space: under the buff row, and under the performance readout when it shows. */
const X = 6;
const Y = 54;
const PERF_LINES_HEIGHT = 40;
/** In a party the member list takes the top left (partyList: 10 + 118 screen px, unscaled): the lines go beside it. */
const PARTY_LEFT_PX = 140;
const LINE_HEIGHT = 12;

const MAX_LINES = 5;
const LIFE_MS = 3000;
const FADE_MS = 600;

const COLOR = 'rgb(255, 230, 120)';

type Line = { id: number; text: string; at: number };

export const ExpFeed = observer(() => {
  const scale = useUiStageScale();
  const [lines, setLines] = useState<Line[]>([]);
  const nextId = useRef(1);

  useEventBus('experienceGained', ({ added }) => {
    const line = { id: nextId.current++, text: t('exp.gained', { amount: added.toLocaleString(i18n.language) }), at: performance.now() };
    setLines(old => [...old.slice(-(MAX_LINES - 1)), line]);
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

  const top = Y + (GameOptions.performanceReadout ? PERF_LINES_HEIGHT : 0);
  const left = Social.inParty ? PARTY_LEFT_PX : X * scale;
  return (
    <div className="exp-feed" style={{ left, top: top * scale, transform: `scale(${scale})` }}>
      {lines.map((line, index) => (
        <MuText
          key={line.id}
          color={COLOR}
          className="exp-feed-line"
          style={{ top: index * LINE_HEIGHT, animationDelay: `${LIFE_MS - FADE_MS}ms`, animationDuration: `${FADE_MS}ms` }}
          text={line.text}
        />
      ))}
    </div>
  );
});
