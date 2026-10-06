/** The panel's calls to admin/server/main.ts (same origin, under /api). */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Set by App: what to do when the session runs out mid-use. */
export let onUnauthorized: () => void = () => {};
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const res = await fetch(`./api${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-MLR': '1' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && path !== '/login') onUnauthorized();
  if (!res.ok) throw new ApiError(data.error ?? `Error ${res.status}`, res.status);
  return data as T;
}

// ---- shapes -----------------------------------------------------------------

export type Stats = {
  level: number | null;
  masterLevel: number | null;
  resets: number | null;
  strength: number | null;
  agility: number | null;
  vitality: number | null;
  energy: number | null;
  leadership: number | null;
};

export type CharacterRow = {
  id: string;
  name: string;
  account: string | null;
  class: string;
  level: number;
  masterLevel: number;
  resets: number;
  status: number;
  map: string | null;
  online: boolean;
};

export type Character = {
  id: string;
  name: string;
  accountId: string | null;
  account: string | null;
  class: string;
  status: number;
  points: number;
  masterPoints: number;
  kills: number;
  heroState: number;
  mapId: string | null;
  x: number;
  y: number;
  experience: string;
  createdAt: string;
  money: number;
  stats: Stats;
  online: boolean;
};

export type AccountRow = {
  id: string;
  login: string;
  email: string | null;
  state: number;
  registeredAt: string;
  characters: number;
  online: boolean;
};

export type Account = {
  id: string;
  login: string;
  email: string | null;
  state: number;
  registeredAt: string;
  chatBanUntil: string | null;
  hasVaultPin: boolean;
  characters: { id: string; name: string; class: string; level: number; resets: number }[];
  online: boolean;
};

export type MapRow = { id: string; number: number; name: string; expMultiplier?: number };

export type Plugin = { id: string; name: string; group: string; description: string; active: boolean | null };

export type Config = {
  game: {
    experienceRate: number;
    masterExperienceRate: number;
    maximumLevel: number;
    maximumMasterLevel: number;
    preventExperienceOverflow: boolean;
  };
  reset: { active: boolean; config: Record<string, unknown> };
  maps: MapRow[];
  fast: { spawnFactor: number; respawnSeconds: number; available: boolean };
  plugins: Plugin[];
};

export type ServerStatus = { available: boolean; state?: string; status?: string; error?: string };

export type Dashboard = {
  accounts: number;
  characters: number;
  banned: number;
  newAccounts: number;
  online: number;
  onlineAccounts: string[];
  top: { name: string; class: string; resets: number; level: number }[];
  recent: { login: string; registeredAt: string }[];
  server: ServerStatus;
};

export type MapInfo = MapRow & { hasTerrain: boolean };

export type Monster = { id: string; number: number; name: string; kind: number };

export type Spawn = {
  id: string;
  monsterId: string;
  monsterNumber: number;
  monsterName: string;
  kind: number;
  quantity: number;
  baseQuantity: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  trigger: number;
  direction: number;
  leveling: boolean;
};

export type ItemOption = { optionId: string; level: number; type: string; name: string };

export type InventoryItem = {
  id: string;
  slot: number;
  level: number;
  durability: number;
  hasSkill: boolean;
  definitionId: string;
  name: string;
  group: number;
  number: number;
  width: number;
  height: number;
  maxDurability: number;
  maxLevel: number;
  canSkill: boolean;
  options: ItemOption[];
};

export type ItemDefinition = {
  id: string;
  name: string;
  group: number;
  number: number;
  width: number;
  height: number;
  durability: number;
  maxLevel: number;
  canSkill: boolean;
};

export type DefinitionOption = {
  optionId: string;
  number: number;
  definitionName: string;
  maxPerItem: number;
  type: string;
  name: string;
};
