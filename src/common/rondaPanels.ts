import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: which of our own in-game windows is open - the command list
 * (`/comandos`) and the rankings (`/ranking`, or the button on screen). Kept
 * outside the components so the chat can open them.
 */
export type RondaPanel = 'commands' | 'rankings' | 'vip';

export const rondaPanels = observable({ open: null as RondaPanel | null });

export function openRondaPanel(panel: RondaPanel): void {
  runInAction(() => {
    rondaPanels.open = panel;
  });
}

export function toggleRondaPanel(panel: RondaPanel): void {
  runInAction(() => {
    rondaPanels.open = rondaPanels.open === panel ? null : panel;
  });
}

export function closeRondaPanel(): void {
  runInAction(() => {
    rondaPanels.open = null;
  });
}
