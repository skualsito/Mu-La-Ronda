/**
 * Mu La Ronda: the asset cache worker's script URL (public/sw.js). It carries
 * the build, so every deploy installs a new worker, and the new worker drops
 * the assets the old build cached - a model, texture or icon changed under the
 * same name otherwise stayed the old one for good, and every version looked
 * broken until the player cleared the site data.
 *
 * Its own module, with no imports: `pwaInstall` registers the worker from
 * `main.tsx`, before the game version is loaded, and `assetDownload` reads the
 * version at module scope.
 */
export const CACHE_WORKER_URL = `./sw.js?build=${encodeURIComponent(
  typeof BUILD_ID === 'string' ? BUILD_ID : 'dev'
)}`;
