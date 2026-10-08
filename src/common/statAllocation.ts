import { makeAutoObservable, observable } from 'mobx';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { clampAmount, nextStep } from './statAmounts';
import { StatType } from './characterStats';

/**
 * "Add 200 points to Strength": the run behind the amount box in the
 * character info window.
 *
 * `IncreaseCharacterStatPoint` carries no amount - the wire only ever adds
 * one point - so a run is that request repeated. Mu La Ronda: up to
 * `IN_FLIGHT` of them are out at once (the server answers them in order),
 * so thousands of points take seconds instead of one round trip each. Also
 * what `/add` and `/addstr` run (`chatCommands.ts`): OpenMU's own multi-point
 * answer for this client version is to re-enter the character on the map.
 *
 * One writer: this module owns the run, the windows only read it.
 */

/** A step with no answer this long is a lost request; the run ends. */
const STEP_TIMEOUT = 5000;

/**
 * Requests sent ahead of their answers: big enough that thousands of points
 * land in a few round trips (the old `/add` was instant), small enough not to
 * dump 30 000 packets on the socket at once.
 */
const IN_FLIGHT = 1000;

/** Mu La Ronda: OpenMU's cap on every base stat (deploy/config/03-stats.sql). */
export const MAX_STAT = 65534;

/**
 * Mu La Ronda: what `/add` may ask OpenMU for: no more than the free points,
 * than the room under the cap (past it the server answers nothing) or than
 * its `ushort` amount holds.
 */
export function addableAmount(stat: StatType, amount: number): number {
  const room = Math.max(0, MAX_STAT - currentStat(stat));
  return Math.min(clampAmount(amount, Store.playerData.points), room, 65535);
}

function currentStat(stat: StatType): number {
  const p = Store.playerData;
  switch (stat) {
    case StatType.Strength:
      return p.str;
    case StatType.Agility:
      return p.agi;
    case StatType.Vitality:
      return p.sta;
    case StatType.Energy:
      return p.eng;
    default:
      return p.leadership;
  }
}

export type StatRun = {
  stat: StatType;
  /** Requests sent so far. */
  sent: number;
  /** Points the server has confirmed. */
  added: number;
  /** Points asked for when the run started. */
  wanted: number;
};

export const StatAllocation = new (class _StatAllocation {
  run: StatRun | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private detach: (() => void) | null = null;
  /** Answers (confirmed or refused) received for the current run. */
  private answers = 0;

  constructor() {
    // The run is swapped whole rather than mutated: a reader only ever sees a
    // consistent { sent, added } pair.
    makeAutoObservable<this, 'timer' | 'detach' | 'answers'>(this, {
      run: observable.ref,
      timer: false,
      detach: false,
      answers: false,
    });
  }

  get running(): boolean {
    return this.run !== null;
  }

  /** True while `stat`'s own row is the one being filled. */
  isRunning(stat: StatType): boolean {
    return this.run?.stat === stat;
  }

  start(stat: StatType, amount: number): void {
    if (this.run) {
      this.cancel();
      return;
    }

    // Past the cap the server answers nothing at all, so never ask for it.
    const room = Math.max(0, MAX_STAT - currentStat(stat));
    const wanted = Math.min(clampAmount(amount, Store.playerData.points), room);
    if (wanted <= 0) return;

    this.run = { stat, sent: 0, added: 0, wanted };
    this.answers = 0;
    this.listen();
    this.step();
  }

  cancel(): void {
    this.clearTimer();
    this.detach?.();
    this.detach = null;
    this.run = null;
  }

  private listen(): void {
    const answered = (e: { stat: number; added: number }) => this.onAnswer(e);
    const lost = () => this.cancel();

    EventBus.on('statPointAnswered', answered);
    EventBus.on('warpCompleted', lost);
    EventBus.on('wsClosed', lost);

    this.detach = () => {
      EventBus.off('statPointAnswered', answered);
      EventBus.off('warpCompleted', lost);
      EventBus.off('wsClosed', lost);
    };
  }

  private step(): void {
    for (let run = this.run; run; run = this.run) {
      const inFlight = run.sent - this.answers;
      if (inFlight >= IN_FLIGHT) return;

      // What is not yet asked for: `points` only drops as answers land.
      const unasked = { added: run.sent, wanted: run.wanted };
      if (nextStep(unasked, Store.playerData.points - inFlight) !== 'send') {
        if (inFlight === 0) this.cancel();
        else this.armTimer();
        return;
      }

      this.run = { ...run, sent: run.sent + 1 };
      this.armTimer();
      Store.increaseStatRequest(run.stat);
    }
  }

  private onAnswer(answer: { stat: number; added: number }): void {
    const run = this.run;
    if (!run || answer.stat !== run.stat) return;

    this.clearTimer();
    this.answers++;

    // A refused point means the server will refuse the rest too.
    if (answer.added <= 0) {
      this.cancel();
      return;
    }

    this.run = { ...run, added: run.added + answer.added };
    this.step();
  }

  private armTimer(): void {
    this.clearTimer();
    this.timer = setTimeout(() => this.cancel(), STEP_TIMEOUT);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
})();
