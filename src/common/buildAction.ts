/**
 * Mu La Ronda: what an open page does about the build the server has now
 * (common/buildCheck.ts) - nothing, reload at once, or wait for the player to
 * leave the game. Its own module so it is testable without the game behind it.
 */
export type BuildAction = 'none' | 'reload' | 'later';

export function buildAction(own: string, served: string | null, inGame: boolean, alreadyReloadedFor: string | null): BuildAction {
  if (!served || own === 'dev' || served === own) return 'none';
  // A reload that still came back with the old build (a proxy or browser cache in the way):
  // do not loop on it.
  if (alreadyReloadedFor === served) return 'none';
  return inGame ? 'later' : 'reload';
}
