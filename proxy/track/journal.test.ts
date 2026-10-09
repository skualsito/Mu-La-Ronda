import { describe, expect, it } from 'vitest';
import type { TrackEvent } from '../../src/common/adminProtocol';
import { MemoryJournal, SplitJournal } from './journal';

const line = (at: number, kind: TrackEvent['kind'], character = 'Juan'): TrackEvent => ({
  at,
  account: 'acc',
  character,
  kind,
  text: `${kind} at ${at}`,
});

describe('the split journal', () => {
  it('sends steps, swings, skills and exp to memory and the rest to disk', () => {
    const disk = new MemoryJournal();
    const memory = new MemoryJournal();
    const journal = new SplitJournal(disk, memory);

    for (const kind of ['walk', 'attack', 'skill', 'exp', 'chat', 'kill', 'trade'] as const) {
      journal.append(line(1, kind));
    }

    expect(disk.query({ character: 'Juan' }).events.map(e => e.kind).sort()).toEqual(['chat', 'kill', 'trade']);
    expect(memory.query({ character: 'Juan' }).events.map(e => e.kind).sort()).toEqual(['attack', 'exp', 'skill', 'walk']);
  });

  it('answers a query from both, newest first, with ids that do not collide', () => {
    const journal = new SplitJournal(new MemoryJournal(), new MemoryJournal());
    journal.append(line(10, 'chat'));
    journal.append(line(20, 'walk'));
    journal.append(line(30, 'kill'));
    journal.append(line(40, 'attack'));

    const { events, more } = journal.query({ character: 'Juan' });
    expect(events.map(e => e.at)).toEqual([40, 30, 20, 10]);
    expect(more).toBe(false);
    const ids = events.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the limit, the page cursor and the kind filter', () => {
    const journal = new SplitJournal(new MemoryJournal(), new MemoryJournal());
    for (let at = 1; at <= 10; at++) journal.append(line(at, at % 2 ? 'walk' : 'chat'));

    const page = journal.query({ character: 'Juan', limit: 3 });
    expect(page.events.map(e => e.at)).toEqual([10, 9, 8]);
    expect(page.more).toBe(true);

    expect(journal.query({ character: 'Juan', before: 4 }).events.map(e => e.at)).toEqual([3, 2, 1]);
    expect(journal.query({ character: 'Juan', kinds: ['chat'] }).events.every(e => e.kind === 'chat')).toBe(true);
    expect(journal.query({ character: 'Juan', kinds: ['walk'] }).events).toHaveLength(5);
  });
});
