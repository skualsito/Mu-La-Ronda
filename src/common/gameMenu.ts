import { makeAutoObservable } from 'mobx';

/**
 * Mu La Ronda: the game menu (Escape, the bottom bar's options button, the
 * options key). A short MU-style list - game settings, commands, rankings,
 * switch character, select server, exit - in front of the big options
 * window, which is now its first entry.
 */
export const GameMenu = new (class _GameMenu {
  open = false;

  constructor() {
    makeAutoObservable(this);
  }

  show(): void {
    this.open = true;
  }

  hide(): void {
    this.open = false;
  }

  toggle(): void {
    this.open = !this.open;
  }
})();
