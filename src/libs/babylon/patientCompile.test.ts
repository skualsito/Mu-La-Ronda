import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Effect } from './exports';
import { installPatientShaderCompiles } from './patientCompile';

type Fake = {
  ready: boolean;
  errors: unknown[];
  _isReadyInternal(): boolean;
  _isDisposed: boolean;
  _processCompilationErrors(error: unknown): void;
  name: string;
};

const fake = (): Fake => ({
  ready: false,
  errors: [],
  _isReadyInternal() {
    return this.ready;
  },
  _isDisposed: false,
  _processCompilationErrors(error) {
    this.errors.push(error);
  },
  name: 'test',
});

const check = (effect: Fake) =>
  (Effect.prototype as unknown as { _checkIsReady(this: Fake, previous: unknown): void })._checkIsReady.call(effect, null);

describe('installPatientShaderCompiles', () => {
  let hidden = false;
  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    vi.stubGlobal('document', {
      get hidden() {
        return hidden;
      },
    });
    installPatientShaderCompiles();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not give a shader up while the page is hidden', () => {
    const effect = fake();
    hidden = true;
    check(effect);
    vi.advanceTimersByTime(10 * 60_000);
    expect(effect.errors).toHaveLength(0);
    hidden = false;
    effect.ready = true;
    vi.advanceTimersByTime(16);
    expect(effect.errors).toHaveLength(0);
  });

  it('waits longer than Babylon before calling it a timeout', () => {
    const effect = fake();
    check(effect);
    vi.advanceTimersByTime(60_000);
    expect(effect.errors).toHaveLength(0);
    vi.advanceTimersByTime(70_000);
    expect(effect.errors).toHaveLength(1);
  });

  it('still reports a real compile error at once', () => {
    const effect = fake();
    effect._isReadyInternal = () => {
      throw new Error('bad shader');
    };
    check(effect);
    expect(effect.errors).toHaveLength(1);
  });
});
