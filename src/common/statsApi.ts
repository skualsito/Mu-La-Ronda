import { useEffect, useState } from 'react';
import { registerApiUrl } from './serverServices';

/**
 * Mu La Ronda: the read-only numbers the game protocol does not carry -
 * rankings and a character's reset count - served by the register service
 * (`register/server/stats.ts`) next to its signup endpoint, so the base is
 * the same `register.<domain>` the register window posts to.
 */

export type RankingType = 'resets' | 'pk' | 'guilds';

export type ResetRow = { name: string; class: string; grandResets: number; resets: number; level: number; masterLevel: number };
export type PkRow = { name: string; class: string; kills: number };
export type GuildRow = { name: string; score: number; members: number; grandResets: number; resets: number; master: string | null };

export type RankingRows = {
  resets: ResetRow[];
  pk: PkRow[];
  guilds: GuildRow[];
};

export type CharacterStats = {
  name: string;
  resets: number;
  level: number;
  masterLevel: number;
  kills: number;
};

/** `https://register.<domain>/api`, or empty when this world has no service. */
function statsBase(): string {
  return registerApiUrl().replace(/\/register$/, '');
}

async function getJson<T>(path: string): Promise<T> {
  const base = statsBase();
  if (!base) throw new Error('no stats service for this world');

  const response = await fetch(`${base}${path}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function fetchRanking<K extends RankingType>(type: K): Promise<RankingRows[K]> {
  const body = await getJson<{ rows: RankingRows[K] }>(`/rankings?type=${type}`);
  return body.rows;
}

export function fetchCharacterStats(name: string): Promise<CharacterStats> {
  return getJson<CharacterStats>(`/character?name=${encodeURIComponent(name)}`);
}

/**
 * A character's reset count, re-read whenever `refreshKey` changes (the
 * level: a reset drops it, so the count is fetched again after one). Null
 * while unknown or when the service cannot be reached.
 */
export function useCharacterResets(name: string, refreshKey: unknown): number | null {
  const [resets, setResets] = useState<number | null>(null);

  useEffect(() => {
    if (!name) return;
    let live = true;

    fetchCharacterStats(name).then(
      stats => live && setResets(stats.resets),
      () => live && setResets(null)
    );

    return () => {
      live = false;
    };
  }, [name, refreshKey]);

  return resets;
}
