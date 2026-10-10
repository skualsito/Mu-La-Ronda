import { Effect } from './exports';

/**
 * Mu La Ronda: a shader that has not compiled yet is not a broken shader.
 *
 * Babylon waits for an effect's program with `_retryWithInterval(…, 16, 30000)`
 * (Effect `_checkIsReady`), which counts *checks*, not time: 1 875 of them,
 * and then the effect is given up as a compile error and Babylon falls back to
 * fewer defines. A hidden page's intervals run once a second (once a minute
 * after a while) and the GPU process does not compile for it at all, so a
 * player left AFK - the PWA in the background, the tab behind another - ran
 * the count out on whatever was compiling when it left, and came back to
 * black or wrong materials ("Operation timed out after maximum retries -
 * Effect: …", the Lorencia ring, 2026-10-09) until a reload.
 *
 * The same check, then, with two changes: the countdown stops while the page
 * is hidden, and it is four times as long. A real compile error still ends it
 * at once - `_isReadyInternal` throws it - and goes to the same handler.
 */

const STEP_MS = 16;
const BUDGET_MS = 120_000;

type CheckingEffect = {
  _isReadyInternal(): boolean;
  _isDisposed: boolean;
  _processCompilationErrors(error: unknown, previousPipelineContext: unknown): void;
  name: unknown;
  key?: string;
};

let installed = false;

export function installPatientShaderCompiles(): void {
  if (installed) return;
  installed = true;

  const proto = Effect.prototype as unknown as { _checkIsReady(previous: unknown): void };
  proto._checkIsReady = function (this: CheckingEffect, previousPipelineContext: unknown) {
    const ready = (): boolean => {
      try {
        return this._isReadyInternal() || this._isDisposed;
      } catch (error) {
        this._processCompilationErrors(error, previousPipelineContext);
        return true;
      }
    };
    if (ready()) return;

    let budget = BUDGET_MS;
    const timer = setInterval(() => {
      if (ready()) {
        clearInterval(timer);
        return;
      }
      if (typeof document !== 'undefined' && document.hidden) return;
      budget -= STEP_MS;
      if (budget < 0) {
        clearInterval(timer);
        const name = typeof this.name === 'string' ? this.name : this.key;
        this._processCompilationErrors(new Error(`Operation timed out after maximum retries.  - Effect: ${name}`), previousPipelineContext);
      }
    }, STEP_MS);
  };
}
