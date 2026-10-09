import type { LogQuery, TrackEvent } from '../../src/common/adminProtocol';

/**
 * Where journal lines go and come back from. The SQLite one (`store.ts`)
 * needs `bun:sqlite`, which vitest cannot load, so the interface lives here
 * with a memory-backed one for tests and for `TRACK=off`.
 */
export interface Journal {
  append(event: TrackEvent): void;
  /** Newest first. One more than `limit` is asked for, so `more` is honest. */
  query(query: LogQuery): { events: TrackEvent[]; more: boolean };
  close(): void;
}

export const DEFAULT_LOG_LIMIT = 100;
export const MAX_LOG_LIMIT = 500;

export function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return DEFAULT_LOG_LIMIT;
  return Math.max(1, Math.min(MAX_LOG_LIMIT, Math.floor(limit)));
}

export class MemoryJournal implements Journal {
  private readonly rows: TrackEvent[] = [];
  private nextId = 1;

  constructor(private readonly capacity = 20_000) {}

  append(event: TrackEvent): void {
    this.rows.push({ ...event, id: this.nextId++ });
    if (this.rows.length > this.capacity) this.rows.splice(0, this.rows.length - this.capacity);
  }

  query(query: LogQuery): { events: TrackEvent[]; more: boolean } {
    const limit = clampLimit(query.limit);
    const wanted = query.character.toLowerCase();
    const kinds = query.kinds?.length ? new Set(query.kinds) : null;
    const found: TrackEvent[] = [];

    for (let i = this.rows.length - 1; i >= 0 && found.length <= limit; i--) {
      const row = this.rows[i];
      if ((row.character ?? '').toLowerCase() !== wanted) continue;
      if (query.before !== undefined && row.at >= query.before) continue;
      if (kinds && !kinds.has(row.kind)) continue;
      found.push(row);
    }

    return { events: found.slice(0, limit), more: found.length > limit };
  }

  close(): void {}
}

/**
 * Mu La Ronda: the kinds a playing character writes several times a second -
 * every step, swing, skill and exp tick. Kept on disk for 30 days they grew
 * the journal to 37 GB and filled the server's disk; they now live only in a
 * memory ring (the last hours of play), and the disk keeps the rest.
 */
export const VOLATILE_KINDS: readonly TrackEvent['kind'][] = ['walk', 'attack', 'skill', 'exp'];

/**
 * Two journals behind one: `volatile` kinds go to `recent` (memory), every
 * other kind to `durable` (disk). A query asks both and merges them newest
 * first, so the game master's log reads as one.
 */
export class SplitJournal implements Journal {
  private readonly volatile: ReadonlySet<string>;

  constructor(
    private readonly durable: Journal,
    private readonly recent: Journal = new MemoryJournal(200_000),
    volatile: readonly string[] = VOLATILE_KINDS
  ) {
    this.volatile = new Set(volatile);
  }

  append(event: TrackEvent): void {
    (this.volatile.has(event.kind) ? this.recent : this.durable).append(event);
  }

  query(query: LogQuery): { events: TrackEvent[]; more: boolean } {
    const limit = clampLimit(query.limit);
    const wanted = query.kinds?.length ? query.kinds : null;
    const askRecent = !wanted || wanted.some(k => this.volatile.has(k));
    const askDurable = !wanted || wanted.some(k => !this.volatile.has(k));

    const fromDurable = askDurable ? this.durable.query({ ...query, limit }) : { events: [], more: false };
    // The memory ring numbers its own lines from 1; negated, they cannot be
    // mistaken for a disk row by anything keyed on the id.
    const fromRecent = askRecent ? this.recent.query({ ...query, limit }) : { events: [], more: false };
    const recentEvents = fromRecent.events.map(e => ({ ...e, id: e.id === undefined ? undefined : -e.id }));

    const merged = [...fromDurable.events, ...recentEvents].sort((a, b) => b.at - a.at);
    return {
      events: merged.slice(0, limit),
      more: merged.length > limit || fromDurable.more || fromRecent.more,
    };
  }

  close(): void {
    this.durable.close();
    this.recent.close();
  }
}
