import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { migrate } from '../../tools/sqliteMigrate';
import type { LogQuery, TrackEvent } from '../../src/common/adminProtocol';
import { clampLimit, type Journal } from './journal';

/**
 * The journal on disk.
 *
 * Its own file, not OpenMU's database and not any other service's: this is
 * what was *observed* on the wire, and nothing here can reach an account.
 * The schema is `migrations/001_character_events.sql`, applied here on a
 * fresh box and by hand on a live one - the same file both times.
 *
 * Lines are written in batches: they queue in memory and land in one
 * transaction every half second, so a busy hour is a few hundred inserts
 * rather than a few hundred fsyncs.
 */

export const DEFAULT_TRACK_DB = join(homedir(), '.mu-proxy', 'track.sqlite');

const FLUSH_MS = 500;
/** Mu La Ronda: every 10 minutes, so a busy evening can't pile up an hour of rows. */
const PRUNE_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The kinds of every step and hit: kept TRACK_NOISY_HOURS (24 by default), not the full retention. */
const NOISY_KINDS = ['walk', 'attack', 'skill', 'exp', 'kill', 'pickup', 'money', 'teleport'];
const NOISY_RETAIN_MS = Number(process.env.TRACK_NOISY_HOURS ?? 24) * 60 * 60 * 1000;
/** The most the journal may hold on disk (TRACK_MAX_MB, 1 GB by default). */
const MAX_BYTES = Number(process.env.TRACK_MAX_MB ?? 1024) * 1024 * 1024;
/** Rows one prune step deletes, and the pause before the next (the game's traffic goes between). */
const PRUNE_CHUNK = 5000;
const PRUNE_PAUSE_MS = 50;

type Row = {
  id: number;
  at: number;
  account: string | null;
  character: string | null;
  kind: string;
  text: string;
  data: string | null;
};

export class SqliteJournal implements Journal {
  private readonly db: Database;
  private readonly insert;
  private pending: TrackEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly pruneTimer: ReturnType<typeof setInterval>;

  constructor(path: string, private readonly retainDays: number) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true });
    this.db.run('PRAGMA journal_mode = WAL');
    // Mu La Ronda: a DELETE only marks pages free inside the file, so the prune
    // below never gave a byte back to the disk. In incremental mode the freed
    // pages can be returned after each prune. Switching an existing file needs
    // one VACUUM, done here once (a new file pays nothing).
    if (this.db.query<{ auto_vacuum: number }, []>('PRAGMA auto_vacuum').get()?.auto_vacuum !== 2) {
      this.db.run('PRAGMA auto_vacuum = INCREMENTAL');
      this.db.run('VACUUM');
    }

    const applied = migrate(this.db, join(import.meta.dir, '..', 'migrations'));
    if (applied.length > 0) {
      console.info(`track: applied ${applied.length} migration(s): ${applied.join(', ')}`);
    }

    this.insert = this.db.query<unknown, [number, string | null, string | null, string, string, string | null]>(
      'INSERT INTO character_events (at, account, character, kind, text, data) VALUES (?, ?, ?, ?, ?, ?)'
    );

    this.prune();
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_MS);
  }

  append(event: TrackEvent): void {
    this.pending.push(event);
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), FLUSH_MS);
  }

  flush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pending.length === 0) return;

    const batch = this.pending;
    this.pending = [];

    try {
      this.db.transaction(() => {
        for (const event of batch) {
          this.insert.run(
            event.at,
            event.account,
            event.character,
            event.kind,
            event.text,
            event.data ? JSON.stringify(event.data) : null
          );
        }
      })();
    } catch (error) {
      console.error('track: journal write failed:', error);
    }
  }

  query(query: LogQuery): { events: TrackEvent[]; more: boolean } {
    const limit = clampLimit(query.limit);
    const where: string[] = ['character = ? COLLATE NOCASE'];
    const params: (string | number)[] = [query.character];

    if (query.before !== undefined) {
      where.push('at < ?');
      params.push(query.before);
    }
    if (query.kinds?.length) {
      where.push(`kind IN (${query.kinds.map(() => '?').join(', ')})`);
      params.push(...query.kinds);
    }

    // The queue is flushed first so a line written a moment ago is in the answer.
    this.flush();

    const rows = this.db
      .query<Row, (string | number)[]>(
        `SELECT id, at, account, character, kind, text, data FROM character_events
         WHERE ${where.join(' AND ')}
         ORDER BY at DESC, id DESC
         LIMIT ?`
      )
      .all(...params, limit + 1);

    const events = rows.slice(0, limit).map(row => {
      const event: TrackEvent = {
        id: row.id,
        at: row.at,
        account: row.account,
        character: row.character,
        kind: row.kind as TrackEvent['kind'],
        text: row.text,
      };
      if (row.data) {
        try {
          event.data = JSON.parse(row.data) as Record<string, unknown>;
        } catch {
          /* a line nobody can parse is still a line */
        }
      }
      return event;
    });

    return { events, more: rows.length > limit };
  }

  private pruning = false;

  /**
   * Drops what is past its retention. Mu La Ronda: in chunks with a pause between them - this
   * process carries the game's traffic, and one DELETE of millions of rows (the first prune
   * after the noisy rows got a shorter life) would freeze every connection while it ran.
   */
  private prune(): void {
    if (!(this.retainDays > 0) || this.pruning) return;
    this.pruning = true;
    const now = Date.now();
    const kinds = NOISY_KINDS.map(() => '?').join(', ');
    const steps: { sql: string; params: (string | number)[] }[] = [
      { sql: 'at < ?', params: [now - this.retainDays * DAY_MS] },
      // The moves, hits and kills of every player (the MU Helper hits four times a second) are
      // most of the rows and only matter for a day or so; with a full server a week of them was
      // gigabytes. They keep NOISY_RETAIN_MS, everything else retainDays.
      { sql: `at < ? AND kind IN (${kinds})`, params: [now - NOISY_RETAIN_MS, ...NOISY_KINDS] },
    ];

    const finish = () => {
      try {
        // Hand the freed pages back to the disk, and empty the write-ahead log.
        this.db.run('PRAGMA incremental_vacuum');
        this.db.run('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch (error) {
        console.error('track: prune failed:', error);
      }
      this.pruning = false;
    };

    const next = () => {
      try {
        const step = steps[0];
        if (!step) {
          // A ceiling on the file: past it, the oldest rows go, a chunk at a time, until it fits.
          if (this.sizeBytes() <= MAX_BYTES) return finish();
          const gone = this.db.run(
            `DELETE FROM character_events WHERE id IN (SELECT id FROM character_events ORDER BY at LIMIT ${PRUNE_CHUNK})`
          ).changes;
          this.db.run('PRAGMA incremental_vacuum(2000)');
          if (gone === 0) return finish();
        } else {
          const gone = this.db.run(
            `DELETE FROM character_events WHERE id IN (SELECT id FROM character_events WHERE ${step.sql} LIMIT ${PRUNE_CHUNK})`,
            step.params
          ).changes;
          if (gone < PRUNE_CHUNK) steps.shift();
        }
        setTimeout(next, PRUNE_PAUSE_MS);
      } catch (error) {
        console.error('track: prune failed:', error);
        this.pruning = false;
      }
    };
    next();
  }

  /** The pages in use (the free ones are given back by incremental_vacuum). */
  private sizeBytes(): number {
    const pages = this.db.query<{ page_count: number }, []>('PRAGMA page_count').get()?.page_count ?? 0;
    const free = this.db.query<{ freelist_count: number }, []>('PRAGMA freelist_count').get()?.freelist_count ?? 0;
    const size = this.db.query<{ page_size: number }, []>('PRAGMA page_size').get()?.page_size ?? 4096;
    return (pages - free) * size;
  }

  close(): void {
    clearInterval(this.pruneTimer);
    this.flush();
    this.db.close();
  }
}
