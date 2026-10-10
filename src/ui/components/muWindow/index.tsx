import './style.less';
import { useCallback, useLayoutEffect, useState, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { MuSpriteFrame, useMuSprite } from '../muSprite';
import { MuResizeGrip, useWindowChrome } from './useWindowChrome';
import { MuWindows, type WindowCloser } from './windowState';

const BACK_SPRITE = 'newui_msgbox_back.OZJ';
const TOP_SPRITE = 'newui_item_back04.OZT';
const LEFT_SPRITE = 'newui_item_back02-L.OZT';
const RIGHT_SPRITE = 'newui_item_back02-R.OZT';
const BOTTOM_SPRITE = 'newui_item_back03.OZT';

export const WINDOW_WIDTH = 190;
export const WINDOW_HEIGHT = 429;

const TOP_HEIGHT = 64;
const SIDE_WIDTH = 21;
const SIDE_HEIGHT = 320;
const BOTTOM_HEIGHT = 45;

// The main bar's height in 640x480 units; the bar is scaled by the player, so
// every window that rides on it (the original's `480 - 51 - h`) follows the
// bar's on-screen height, not the constant.
const BOTTOM_BAR_HEIGHT = 51;
export const BOTTOM_BAR_ID = 'bottom-bar';
export const bottomBarScreenHeight = () => BOTTOM_BAR_HEIGHT * MuWindows.scaleOf(BOTTOM_BAR_ID);

type MuItemWindowProps = {
  id: string;
  column?: number;
  className?: string;
  style?: CSSProperties;
  /** Read by screen readers; defaults to the id. */
  label?: string;
  /**
   * Escape while this is the top window. Without one, Escape falls back to
   * the `keyPressed` broadcast, which closes every window listening for it.
   */
  onClose?: WindowCloser;
  /**
   * Mu La Ronda: sits against the left side of this open window, at its scale
   * and top - the vault beside the bag, wherever the bag was put or however
   * big it was made. Falls back to the column when there is no room.
   */
  dockLeftOf?: string;
  children?: React.ReactNode;
};

/** Where a docked window goes: against the left of its host, or null to use the column. */
function useDock(hostId: string | undefined): CSSProperties | null {
  const [dock, setDock] = useState<CSSProperties | null>(null);
  // Read so the observer re-renders when the host moves or is resized.
  const hostPlacement = hostId ? MuWindows.placement(hostId) : null;
  const hostScale = hostId ? MuWindows.scaleOf(hostId) : 1;
  const hostX = hostPlacement?.x;
  const hostY = hostPlacement?.y;

  useLayoutEffect(() => {
    if (!hostId) return;
    const measure = () => {
      const host = document.querySelector<HTMLElement>(`[data-window-id="${hostId}"]`);
      const rect = host?.getBoundingClientRect();
      const left = rect ? rect.left - WINDOW_WIDTH * hostScale : -1;
      const next =
        rect && left >= 0
          ? { left, top: rect.top, right: 'auto', bottom: 'auto', transform: `scale(${hostScale})`, transformOrigin: '0 0' }
          : null;
      setDock(old => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [hostId, hostScale, hostX, hostY]);

  return hostId ? dock : null;
}

export const MuItemWindow = observer(
  ({ id, column = 0, className, style, label, onClose, dockLeftOf, children }: MuItemWindowProps) => {
    const back = useMuSprite(BACK_SPRITE);
    const dock = useDock(dockLeftOf);
    const chrome = useWindowChrome(id, {
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      onClose,
    });
    const stackRef = chrome.ref as (el: HTMLElement | null) => void;
    // Joins the stack and takes the focus, so the window is the keyboard's
    // target the moment it opens (and Escape scopes to it).
    const ref = useCallback(
      (el: HTMLDivElement | null) => {
        stackRef(el);
        if (el) el.focus({ preventScroll: true });
      },
      [stackRef]
    );

    return (
      <div
        ref={ref}
        data-window-id={id}
        role="dialog"
        aria-label={label ?? id.replace(/-/g, ' ')}
        tabIndex={-1}
        className={`mu-item-window${className ? ` ${className}` : ''}`}
        onPointerDown={chrome.onPointerDown}
        style={{
          right: column * WINDOW_WIDTH * chrome.scale,
          bottom: bottomBarScreenHeight(),
          backgroundImage: back ? `url(${back.url})` : undefined,
          backgroundSize: '100% 100%',
          ...chrome.style,
          ...dock,
          ...style,
        }}
      >
      <MuSpriteFrame
        file={TOP_SPRITE}
        width={WINDOW_WIDTH}
        height={TOP_HEIGHT}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <MuSpriteFrame
        file={LEFT_SPRITE}
        width={SIDE_WIDTH}
        height={SIDE_HEIGHT}
        style={{ position: 'absolute', left: 0, top: TOP_HEIGHT }}
      />
      <MuSpriteFrame
        file={RIGHT_SPRITE}
        width={SIDE_WIDTH}
        height={SIDE_HEIGHT}
        style={{
          position: 'absolute',
          left: WINDOW_WIDTH - SIDE_WIDTH,
          top: TOP_HEIGHT,
        }}
      />
      <MuSpriteFrame
        file={BOTTOM_SPRITE}
        width={WINDOW_WIDTH}
        height={BOTTOM_HEIGHT}
        style={{
          position: 'absolute',
          left: 0,
          top: WINDOW_HEIGHT - BOTTOM_HEIGHT,
        }}
      />
        {children}
        <MuResizeGrip id={id} width={WINDOW_WIDTH} />
      </div>
    );
  }
);

const TABLE_TOP_LEFT = 'newui_item_table01(L).OZT';
const TABLE_TOP_RIGHT = 'newui_item_table01(R).OZT';
const TABLE_BOTTOM_LEFT = 'newui_item_table02(L).OZT';
const TABLE_BOTTOM_RIGHT = 'newui_item_table02(R).OZT';
const TABLE_TOP_PIXEL = 'newui_item_table03(Up).OZT';
const TABLE_BOTTOM_PIXEL = 'newui_item_table03(Dw).OZT';
const TABLE_LEFT_PIXEL = 'newui_item_table03(L).OZT';
const TABLE_RIGHT_PIXEL = 'newui_item_table03(R).OZT';

export const TABLE_CORNER = 14;

type MuTableFrameProps = {
  left: number;
  top: number;
  width: number;
  height: number;
  className?: string;
};

export const MuTableFrame = ({
  left,
  top,
  width,
  height,
  className,
}: MuTableFrameProps) => {
  const runX = Math.max(0, width - TABLE_CORNER * 2);
  const runY = Math.max(0, height - TABLE_CORNER * 2);

  const edge = (file: string, style: CSSProperties, repeat: string) => (
    <MuSpriteFrame
      file={file}
      style={{ position: 'absolute', backgroundRepeat: repeat, ...style }}
    />
  );

  return (
    <div
      className={`mu-table-frame${className ? ` ${className}` : ''}`}
      style={{ left, top, width, height }}
    >
      {edge(
        TABLE_TOP_PIXEL,
        { left: TABLE_CORNER, top: 0, width: runX, height: TABLE_CORNER },
        'repeat-x'
      )}
      {edge(
        TABLE_BOTTOM_PIXEL,
        {
          left: TABLE_CORNER,
          top: height - TABLE_CORNER,
          width: runX,
          height: TABLE_CORNER,
        },
        'repeat-x'
      )}
      {edge(
        TABLE_LEFT_PIXEL,
        { left: 0, top: TABLE_CORNER, width: TABLE_CORNER, height: runY },
        'repeat-y'
      )}
      {edge(
        TABLE_RIGHT_PIXEL,
        {
          left: width - TABLE_CORNER,
          top: TABLE_CORNER,
          width: TABLE_CORNER,
          height: runY,
        },
        'repeat-y'
      )}

      <MuSpriteFrame
        file={TABLE_TOP_LEFT}
        width={TABLE_CORNER}
        height={TABLE_CORNER}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <MuSpriteFrame
        file={TABLE_TOP_RIGHT}
        width={TABLE_CORNER}
        height={TABLE_CORNER}
        style={{ position: 'absolute', left: width - TABLE_CORNER, top: 0 }}
      />
      <MuSpriteFrame
        file={TABLE_BOTTOM_LEFT}
        width={TABLE_CORNER}
        height={TABLE_CORNER}
        style={{ position: 'absolute', left: 0, top: height - TABLE_CORNER }}
      />
      <MuSpriteFrame
        file={TABLE_BOTTOM_RIGHT}
        width={TABLE_CORNER}
        height={TABLE_CORNER}
        style={{
          position: 'absolute',
          left: width - TABLE_CORNER,
          top: height - TABLE_CORNER,
        }}
      />
    </div>
  );
};

export const MuTableRule = ({
  left,
  top,
  width,
}: {
  left: number;
  top: number;
  width: number;
}) => (
  <MuSpriteFrame
    file={TABLE_BOTTOM_PIXEL}
    style={{
      position: 'absolute',
      left,
      top,
      width,
      height: TABLE_CORNER,
      backgroundRepeat: 'repeat-x',
    }}
  />
);

export const MU_WINDOW_SPRITES = [
  BACK_SPRITE,
  TOP_SPRITE,
  LEFT_SPRITE,
  RIGHT_SPRITE,
  BOTTOM_SPRITE,
  TABLE_TOP_LEFT,
  TABLE_TOP_RIGHT,
  TABLE_BOTTOM_LEFT,
  TABLE_BOTTOM_RIGHT,
  TABLE_TOP_PIXEL,
  TABLE_BOTTOM_PIXEL,
  TABLE_LEFT_PIXEL,
  TABLE_RIGHT_PIXEL,
];
