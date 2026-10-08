/// <reference lib="webworker" />
// Mu La Ronda: a steady tick for the main thread (common/backgroundPump.ts).
// A dedicated worker's timers keep their rate in a hidden tab, where the
// page's own requestAnimationFrame stops and its timers slow to once a second.

const TICK_MS = 50;

setInterval(() => postMessage(0), TICK_MS);
