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
  classId: string;
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
    minimumMonsterLevelForMasterExperience: number;
    shouldDropMoney: boolean;
    /** Seconds. */
    itemDropDuration: number;
    maximumItemOptionLevelDrop: number;
    excellentItemDropLevelDelta: number;
    maximumInventoryMoney: number;
    maximumVaultMoney: number;
    maximumCharactersPerAccount: number;
    maximumPartySize: number;
    areaSkillHitsPlayer: boolean;
    maximumLetters: number;
    letterSendPrice: number;
    damagePerOneItemDurability: number;
    hitsPerOneItemDurability: number;
    pvpEnabled: boolean;
  };
  /** Percent; 100 = the drops as configured. */
  rates: { itemDropRate: number; excellentDropRate: number; zenDropRate: number };
  /** Mu La Ronda: the grand reset NPC. */
  grandReset: { active: boolean; RequiredLevel: number; RequiredResets: number; RequiredMoney: number; CoinsPerGrandReset: number };
  reset: { active: boolean; config: Record<string, unknown> };
  maps: MapRow[];
  fast: { spawnFactor: number; respawnSeconds: number; available: boolean };
  plugins: Plugin[];
  /** On a plugin change: whether the running game servers took it too (no restart needed). */
  live?: boolean;
};

export type ServerStatus = { available: boolean; state?: string; status?: string; error?: string };

export type Dashboard = {
  accounts: number;
  characters: number;
  banned: number;
  newAccounts: number;
  online: number;
  onlineAccounts: string[];
  /** Who is playing: the character in the game, or null while still on the character list. */
  onlineList: {
    accountId: string;
    login: string;
    character: { id: string; name: string; class: string; level: number; resets: number; map: string | null } | null;
  }[];
  /** False when OpenMU did not answer: onlineList is then the accounts, with no character. */
  gameData: boolean;
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
  /** Mu La Ronda: the item's sockets and how many it may have. */
  socketCount?: number;
  maxSockets?: number;
  sockets?: (SocketChoice | null)[];
};

export type SocketChoice = { optionId: string; level: number };

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
  maxSockets?: number;
};

export type DefinitionOption = {
  optionId: string;
  number: number;
  definitionName: string;
  maxPerItem: number;
  type: string;
  name: string;
  /** The socket element (0 fire, 1 water, 2 ice, 3 wind, 4 lightning, 5 earth), else null. */
  element?: number | null;
  /** The option's levels with a value (harmony, socket spheres); empty when it has no levels. */
  levels?: number[];
};

export type SkillRow = { skillId: string; number: number; name: string; type: number; maxLevel: number | null; rank: number | null };
export type LearnedSkill = SkillRow & { id: string; level: number };
export type CharacterSkills = { learned: LearnedSkill[]; available: SkillRow[] };

export type AutoMessage = { id: number; text: string; intervalMinutes: number; enabled: boolean; sendNowAt: string | null };

export type ShopRow = { id: string; number: number; name: string; storeId: string | null; items: number; maps: string[] };
export type ShopList = { shops: ShopRow[]; candidates: { id: string; number: number; name: string }[] };

export type DropItem = { id: string; group: number; number: number; name: string };
export type DropGroup = {
  id: string;
  description: string;
  chance: number;
  itemType: number;
  itemLevel: number | null;
  minMonsterLevel: number | null;
  maxMonsterLevel: number | null;
  monsterId: string | null;
  monsterName: string | null;
  mapIds: string[];
  items: DropItem[];
  inUse: string | null;
  edited: boolean;
};
export type DropList = { groups: DropGroup[]; types: { value: number; label: string }[] };

export type MonsterRow = {
  id: string;
  number: number;
  name: string;
  kind: number;
  level: number | null;
  health: number | null;
  minDamage: number | null;
  maxDamage: number | null;
  defense: number | null;
  spots: number;
  edited: boolean;
};
export type MonsterAttribute = { attributeId: string; designation: string; value: number };
export type MonsterDetail = MonsterRow & {
  respawnSeconds: number;
  attackDelayMs: number;
  moveDelayMs: number;
  moveRange: number;
  attackRange: number;
  viewRange: number;
  maxDrops: number;
  attributes: MonsterAttribute[];
  maps: string[];
};
export type MonsterList = {
  monsters: MonsterRow[];
  attributes: { id: string; designation: string }[];
  main: { designation: string; label: string; hint?: string }[];
};

export type EventStatus = 'untested' | 'ok' | 'broken';
export type GameEventRow = {
  id: string;
  type: string;
  name: string;
  kind: 'minigame' | 'periodic';
  state: 'NotStarted' | 'Prepared' | 'Started';
  running: boolean;
  players: number;
  lastStartUtc: string | null;
  nextStepUtc: string;
  nextStartUtc: string | null;
  status: EventStatus;
  note: string;
  testedAt: string | null;
  testedBy: string | null;
};
export type EventList = { events: GameEventRow[]; error: string | null };
export type EventMonster = { number: number; name: string; map: number; mapName: string; x: number; y: number };
export type EventDetails = {
  id: string;
  type: string;
  name: string;
  setup: {
    timetable: string[];
    durationMinutes: number;
    mobs: { number: number; name: string; count: number; maps: string[]; x: number | null; y: number | null }[] | null;
  } | null;
  places: { x: number; y: number }[] | null;
  servers: {
    server: number;
    description: string;
    state: GameEventRow['state'];
    running: boolean;
    players: number;
    lastStartUtc: string | null;
    nextStepUtc: string;
    nextStartUtc: string | null;
    monsters: EventMonster[];
  }[];
};

export type SectionKey = 'inicio' | 'personajes' | 'cuentas' | 'spots' | 'shops' | 'drops' | 'monstruos' | 'eventos' | 'mensajes' | 'vip' | 'encuesta' | 'config' | 'servidor';

export type VipCode = {
  id: string;
  code: string;
  percent: number;
  maxUses: number | null;
  uses: number;
  oncePerAccount: boolean;
  active: boolean;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
};
export type Me = { user: string; superuser: boolean; permissions: SectionKey[]; sections: { key: SectionKey; label: string }[] };
export type PanelUser = { id: number; username: string; permissions: SectionKey[]; enabled: boolean; createdAt: string; lastLoginAt: string | null };

export type CharacterClassRow = { id: string; name: string; number: number };

/** One answered post-beta survey (admin/server/survey.ts). */
export type SurveyResponse = {
  login: string;
  answers: import('../../src/common/surveyRules').SurveyAnswers;
  staff: boolean;
  createdAt: string;
};

/** Mu La Ronda: a row of the grand reset shop (server/grandShop.ts). */
export type GrandShopRow = {
  id: number;
  definitionId: string;
  name: string;
  group: number;
  number: number;
  level: number;
  skill: boolean;
  luck: boolean;
  optionLevel: number;
  /** Bit mask of the excellent options (63 = all six). */
  excellent: number;
  price: number;
  sort: number;
  active: boolean;
};

/** Mu La Ronda: a VIP paid with Mercado Pago. */
export type VipPayment = {
  id: string;
  login: string;
  tier: number;
  months: number;
  amount: number;
  status: 'pending' | 'paid' | 'granted' | 'rejected' | 'cancelled';
  mpPaymentId: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  grantedAt: string | null;
};

export type VipPayments = {
  payments: VipPayment[];
  /** Per account, what was paid during the beta: to give again in production. */
  totals: { login: string; silverMonths: number; goldMonths: number; amount: number }[];
  /** Pesos per month. */
  prices: { silver: number; gold: number };
};
