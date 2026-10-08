import { observable, runInAction } from 'mobx';

/**
 * Mu La Ronda: how many monsters of each invasion running now are left, for the
 * events window (ESC > Eventos). The server sends it as blue lines that are
 * read here and not shown (BaseInvasionPlugIn.cs), on the start, on every kill
 * and to whoever enters the game while it runs:
 *
 *   Invasion {key}|{part}/{parts}|monster,killed,total;monster,killed,total...
 *   Invasion {key}|0/0|            (the invasion is over)
 *
 * `key` is the plugin's name without "InvasionPlugIn": Golden, RedDragon,
 * WhiteWizard. Part 1 starts the list over.
 */

export type InvasionCount = {
  monster: number;
  killed: number;
  total: number;
};

const LINE = /^Invasion (\w+)\|(\d+)\/(\d+)\|(.*)$/;

const invasions = observable.map<string, InvasionCount[]>({}, { deep: false });

function parseEntries(text: string): InvasionCount[] {
  const counts: InvasionCount[] = [];
  for (const entry of text.split(';')) {
    const [monster, killed, total] = entry.split(',').map(Number);
    if ([monster, killed, total].some(n => n === undefined || Number.isNaN(n))) continue;
    counts.push({ monster, killed, total });
  }
  return counts;
}

/** Takes an invasion line from the server; false when the line is another one. */
export function readInvasionLine(text: string): boolean {
  const match = LINE.exec(text);
  if (!match) return false;
  const key = match[1];
  const part = Number(match[2]);
  const parts = Number(match[3]);
  runInAction(() => {
    if (parts === 0) {
      invasions.delete(key);
      return;
    }
    const held = part === 1 ? [] : (invasions.get(key) ?? []);
    invasions.set(key, held.concat(parseEntries(match[4])));
  });
  return true;
}

/** The invasions running now, each with its monsters' counts. */
export function runningInvasions(): { key: string; counts: readonly InvasionCount[] }[] {
  return [...invasions.entries()].map(([key, counts]) => ({ key, counts }));
}

/** Forget everything (a logout: the next login hears it again). */
export function clearInvasions(): void {
  runInAction(() => invasions.clear());
}
