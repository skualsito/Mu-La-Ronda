import type { Sql } from 'postgres';
import bcrypt from 'bcryptjs';

/**
 * Everything the panel reads from and writes to OpenMU's database. The game
 * server keeps loaded characters and its configuration in memory, so:
 *  - a character is only edited while its account is offline (OpenMU would
 *    overwrite the edit when it saves on logout);
 *  - configuration changes apply when OpenMU restarts (the panel's Restart).
 */

export const STAT = {
  level: '560931ad-0901-4342-b7f4-fd2e2fcc0563',
  masterLevel: '70cd8c10-391a-4c51-9aa4-a854600e3a9f',
  resets: '89a891a7-f9f9-4ab5-af36-12056e53a5f7',
  strength: '123282fe-fead-448e-ad2c-baece939b4b1',
  agility: '1ae9c014-e3cd-4703-bd05-1b65f5f94ceb',
  vitality: '6ca5c3a6-b109-45a5-87a7-fdcb107b4982',
  energy: '01b0ef28-f7a0-46b5-97ba-2b624a54cd75',
  leadership: '6af2c9df-3ae4-4721-8462-9a8ec7f56fe4',
} as const;

type StatKey = keyof typeof STAT;

/** Stats.CurrentHealth / Stats.CurrentMana, and a value above any maximum (OpenMU clamps it). */
const CURRENT_HEALTH = '20686ffd-7a96-4be2-9889-2a4dd9ff5a25';
const CURRENT_MANA = 'b3299ee6-3815-4e48-b620-95db78f8a142';
const FULL_POOL = 100_000_000;

export const MAX_STAT = 65534;

/** CharacterStatus: 0 Normal, 1 Banned, 32 Game Master. */
export const CHARACTER_STATUS = [0, 1, 32] as const;
/** AccountState: 0 Normal, 2 Game Master, 4 Banned, 5 Temporarily banned. */
export const ACCOUNT_STATES = [0, 2, 4, 5] as const;

/**
 * OpenMU's default experience table (GameConfiguration.ExperienceFormula):
 * the experience a character has on reaching `level`.
 */
export function experienceForLevel(level: number): number {
  if (level <= 1) return 0;
  const base = 10 * (level + 8) * (level - 1) ** 2;
  return level > 256 ? base + 1000 * (level - 247) * (level - 256) ** 2 : base;
}

/** Plug-ins the panel shows by name; OpenMU stores only their type ids. */
export const PLUGINS: { id: string; name: string; group: string; description: string }[] = [
  { id: '6a9d585d-79d7-4674-b6ea-7e87392fa501', group: 'Resets', name: 'Sistema de resets', description: 'Habilita los resets (la configuracion esta en la pestaña Resets).' },
  { id: '90b35404-aade-4f22-b5d2-4cd59b8bb4c8', group: 'Resets', name: '/reset', description: 'Comando de chat para resetear.' },
  { id: '79f2c2c2-2e4c-4f4b-8a74-4227d1209d27', group: 'Resets', name: '/resetinfo', description: 'Muestra resets y el costo del proximo.' },
  { id: '5e0c2b7a-3d41-4f6b-9a28-7c1e4d9b0a53', group: 'Resets', name: '/autoreset', description: 'Resetea solo al llegar al nivel.' },
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891', group: 'Resets', name: '/resetstats', description: 'Devuelve los puntos de stats para repartirlos de nuevo.' },
  { id: '08953be6-dabf-49cc-a500-fdb9dc2c4d80', group: 'Resets', name: 'Reset con Leo the Helper', description: 'Resetear hablando con el NPC.' },

  { id: '042ec5c6-27c8-4e00-a48b-c5458edea0bc', group: 'Comandos de jugadores', name: '/add (servidor)', description: 'El cliente de Mu La Ronda ya resuelve /add solo; esto es la version del servidor.' },
  { id: '21b15d95-ba2f-40a3-ab7d-8bd886faeae5', group: 'Comandos de jugadores', name: '/addstr', description: 'Agrega puntos a fuerza.' },
  { id: '43156a52-03ee-42c0-88bf-ca9665dc8e1e', group: 'Comandos de jugadores', name: '/addagi', description: 'Agrega puntos a agilidad.' },
  { id: '370ce86c-e382-4e0f-93f4-ad75fa079129', group: 'Comandos de jugadores', name: '/addvit', description: 'Agrega puntos a vitalidad.' },
  { id: 'a597b6e7-9395-4cf4-8439-a1d60134b63e', group: 'Comandos de jugadores', name: '/addene', description: 'Agrega puntos a energia.' },
  { id: 'efe421fb-be79-4656-af39-d22a105d1455', group: 'Comandos de jugadores', name: '/addcmd', description: 'Agrega puntos a comando (Dark Lord).' },
  { id: '4564ae2b-4819-4155-b5b2-fe2ed0cf7a7f', group: 'Comandos de jugadores', name: '/move', description: 'Moverse a otro mapa.' },
  { id: 'ed2523c1-f66d-4b53-814e-d2fc0c1f46c0', group: 'Comandos de jugadores', name: '/post', description: 'Mensaje para todo el servidor.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c24', group: 'Comandos de jugadores', name: '/vip', description: 'Muestra el VIP de la cuenta.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c26', group: 'Comandos de jugadores', name: '/baul', description: 'Cambia de baul (baules extra del VIP).' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c2a', group: 'Comandos de jugadores', name: '/borraritem', description: 'Borra un item del inventario.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c2b', group: 'Comandos de jugadores', name: '/cambiarclave', description: 'Cambiar la contraseña de la cuenta.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c29', group: 'Comandos de jugadores', name: '/resetarbol', description: 'Reinicia el arbol de master skills.' },
  { id: 'a1c4e7f2-3b8d-4a09-8e5c-2d6f0b3a7e14', group: 'Comandos de jugadores', name: '/offlevel', description: 'Seguir leveleando desconectado.' },
  { id: 'eb97a8f6-f6bd-460a-bcbe-253bf679361a', group: 'Comandos de jugadores', name: '/pkclear', description: 'Limpia el PK pagando zen.' },
  { id: '12a6e159-0d5e-44de-8cf8-012a7278d42c', group: 'Comandos de jugadores', name: '/war', description: 'Guerra de guilds.' },
  { id: 'a456f032-ce7d-4ea5-8eb2-96c2b04c70d1', group: 'Comandos de jugadores', name: '/battlesoccer', description: 'Battle Soccer entre guilds.' },
  { id: '06870b25-3240-49cf-add4-f3060ea1fa7d', group: 'Comandos de jugadores', name: '/language', description: 'Idioma de los mensajes del servidor.' },
  { id: 'efe9399a-9a14-4b94-bbc1-20718584c4c2', group: 'Comandos de jugadores', name: '/help', description: 'Ayuda de un comando.' },
  { id: 'a5b0a3e5-bb2a-4287-821a-cd97714fe209', group: 'Comandos de jugadores', name: '/list', description: 'Lista los comandos disponibles.' },

  { id: 'abfe2440-e765-4f17-a588-bd9ae3799887', group: 'Comandos de Game Master', name: '/item', description: 'Crear items.' },
  { id: 'abfe2440-e765-4f17-a588-bd9ae3799886', group: 'Comandos de Game Master', name: '/teleport', description: 'Teletransportarse a unas coordenadas.' },
  { id: 'f22c989b-a2a1-4991-b6c2-658337cc19ce', group: 'Comandos de Game Master', name: '/trace', description: 'Ir a donde esta un jugador.' },
  { id: '7f12326a-9b84-4a56-a013-8c485d7b2ef6', group: 'Comandos de Game Master', name: '/track', description: 'Traer a un jugador.' },
  { id: '9163c3ea-6722-4e55-a109-20c163c05266', group: 'Comandos de Game Master', name: '/guildmove', description: 'Mover a toda una guild.' },
  { id: '7ce1ca66-c6b1-4840-9997-ef15c49fab49', group: 'Comandos de Game Master', name: '/hide', description: 'Hacerse invisible.' },
  { id: '0f0adac6-88c7-4ec0-94a2-a289173deda7', group: 'Comandos de Game Master', name: '/unhide', description: 'Volver a ser visible.' },
  { id: '6693aba3-7b35-4800-815b-096f3420e998', group: 'Comandos de Game Master', name: '/online', description: 'Cuantos jugadores hay conectados.' },
  { id: '0c7162bc-c74e-4a65-82e3-12811e4be170', group: 'Comandos de Game Master', name: '/charinfo', description: 'Datos de un personaje.' },
  { id: '2bfc9464-4b76-4d76-8ce1-69b712b65e6c', group: 'Comandos de Game Master', name: '/goldnotice', description: 'Aviso dorado para todo el servidor.' },
  { id: 'b5e0f108-9e55-48f6-a7a8-220bfaef2f3e', group: 'Comandos de Game Master', name: '/disconnect', description: 'Desconectar a un jugador.' },
  { id: 'f23262e6-0d7c-4b9c-8cd5-7e44af4ee469', group: 'Comandos de Game Master', name: '/guilddisconnect', description: 'Desconectar a toda una guild.' },
  { id: 'ef869270-847e-48d5-9012-f5d111d9c8eb', group: 'Comandos de Game Master', name: '/banacc', description: 'Banear una cuenta.' },
  { id: 'fcbc9cc0-3c8f-45e2-96df-9c55be30c5d9', group: 'Comandos de Game Master', name: '/unbanacc', description: 'Desbanear una cuenta.' },
  { id: '7ad1e5f4-4b07-4165-b9a4-188614f00f7c', group: 'Comandos de Game Master', name: '/banchar', description: 'Banear un personaje.' },
  { id: '2830b01b-57a4-4925-ab6b-242c242b96c9', group: 'Comandos de Game Master', name: '/unbanchar', description: 'Desbanear un personaje.' },
  { id: '287ae9a6-e434-4e52-a791-8aad267a8e05', group: 'Comandos de Game Master', name: '/chatban', description: 'Silenciar el chat de un personaje.' },
  { id: '82e74664-7700-433b-9428-90c17cc71350', group: 'Comandos de Game Master', name: '/chatunban', description: 'Devolverle el chat a un personaje.' },
  { id: '30b7eff0-33ee-4136-beb0-be503b748dc6', group: 'Comandos de Game Master', name: '/pk', description: 'Cambiar el nivel de PK de un personaje.' },
  { id: '4735cc2c-9e5d-457a-92cb-9d765f74fdfb', group: 'Comandos de Game Master', name: '/skin', description: 'Transformarse en un monstruo.' },
  { id: '658f7f9d-b8ff-4d52-a835-5b3d658b6b9f', group: 'Comandos de Game Master', name: '/fireworks', description: 'Fuegos artificiales.' },
  { id: '0e23e4ce-6e7b-4f29-92d8-04a1335ec722', group: 'Comandos de Game Master', name: '/xmasfireworks', description: 'Fuegos artificiales de navidad.' },
  { id: 'bf4da282-8cfe-4110-b1c5-a01d3f224fab', group: 'Comandos de Game Master', name: '/createmonster', description: 'Crear un monstruo.' },
  { id: 'b3de58f3-b604-4f59-9122-e686ad90be7b', group: 'Comandos de Game Master', name: '/movemonster', description: 'Mover un monstruo.' },
  { id: '1852fed5-8184-431e-8c5f-5131356d348f', group: 'Comandos de Game Master', name: '/walkmonster', description: 'Hacer caminar un monstruo.' },
  { id: '34faad0a-fca4-42e2-8f37-cef48783bd78', group: 'Comandos de Game Master', name: '/removenpc', description: 'Sacar un NPC o monstruo.' },
  { id: '498d0205-388f-410a-a7c7-49069a64d3a9', group: 'Comandos de Game Master', name: '/showids', description: 'Mostrar los ids de los NPCs cercanos.' },
  { id: 'd8ac2f15-ab30-4432-a042-a41aca1b274d', group: 'Comandos de Game Master', name: '/npc', description: 'Abrir la ventana de un NPC.' },
  { id: '62027b6b-d8e7-4ddb-a16b-7070d1bc4a56', group: 'Comandos de Game Master', name: '/openware', description: 'Abrir el baul desde cualquier lado.' },
  { id: '1e895a6f-3056-4a78-ba64-96e24363b8bc', group: 'Comandos de Game Master', name: '/clearinv', description: 'Vaciar el inventario.' },
  { id: '7177533a-f147-407e-97b0-c4d8e1ac1af4', group: 'Comandos de Game Master', name: '/startbc', description: 'Arrancar Blood Castle.' },
  { id: 'a990270e-b9c6-4445-bba9-56367a90d31d', group: 'Comandos de Game Master', name: '/startcc', description: 'Arrancar Chaos Castle.' },
  { id: '3684dc79-d81e-4033-ab2c-537334cf0bb6', group: 'Comandos de Game Master', name: '/startds', description: 'Arrancar Devil Square.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c27', group: 'Comandos de Game Master', name: '/startkanturu', description: 'Arrancar Kanturu.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c28', group: 'Comandos de Game Master', name: '/startgolden', description: 'Arrancar la invasion dorada.' },
  { id: '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c2c', group: 'Comandos de Game Master', name: '/startmedusa', description: 'Arrancar Medusa.' },
  { id: '9d5c8ffe-ec32-48ac-8b6f-bb361ad184e5', group: 'Comandos de Game Master', name: '/getlevel', description: 'Ver el nivel de un personaje.' },
  { id: '4be779c9-e6b6-47f2-bc23-2e71d82a6c1d', group: 'Comandos de Game Master', name: '/setlevel', description: 'Cambiar el nivel de un personaje.' },
  { id: '4ced4bf8-9d91-47f9-82de-51e2646f77c8', group: 'Comandos de Game Master', name: '/getmasterlevel', description: 'Ver el master level de un personaje.' },
  { id: 'e401ca16-7827-495b-9dd0-eabdff39901e', group: 'Comandos de Game Master', name: '/setmasterlevel', description: 'Cambiar el master level de un personaje.' },
  { id: 'e4d65354-ccd2-4960-bdca-d4582a57bbcb', group: 'Comandos de Game Master', name: '/getleveluppoints', description: 'Ver los puntos libres de un personaje.' },
  { id: '50ef670a-df7a-4fee-8e42-7c7a18a68941', group: 'Comandos de Game Master', name: '/setleveluppoints', description: 'Cambiar los puntos libres de un personaje.' },
  { id: '8accf267-f5f3-4003-b4c3-536accb5181d', group: 'Comandos de Game Master', name: '/getmasterleveluppoints', description: 'Ver los puntos master libres.' },
  { id: '69ac0b9e-1063-448e-abd6-c5837a1e8a4b', group: 'Comandos de Game Master', name: '/setmasterleveluppoints', description: 'Cambiar los puntos master libres.' },
  { id: 'f8caca47-d486-45ae-814f-c6218ad87652', group: 'Comandos de Game Master', name: '/get', description: 'Ver un stat de un personaje.' },
  { id: 'd074e8ab-9d6e-49a4-956f-1f4818188af1', group: 'Comandos de Game Master', name: '/set', description: 'Cambiar un stat de un personaje.' },
  { id: '207f5872-33ab-4764-b67f-95ab7c6313e3', group: 'Comandos de Game Master', name: '/getmoney', description: 'Ver el zen de un personaje.' },
  { id: '00aa4f0e-911d-49fe-8d88-114c7496d383', group: 'Comandos de Game Master', name: '/setmoney', description: 'Cambiar el zen de un personaje.' },
  { id: '26acf6a9-346a-49df-8583-ea610f6e3aea', group: 'Comandos de Game Master', name: '/getresets', description: 'Ver los resets de un personaje.' },
  { id: '47a8644c-b6c5-439e-bab0-c1a7ae72691c', group: 'Comandos de Game Master', name: '/setresets', description: 'Cambiar los resets de un personaje.' },

  { id: 'a95a8d2f-a0c3-442e-995c-005b5c1b42d2', group: 'Seguridad', name: 'Detector de speed hack', description: 'Banea cuentas que atacan "demasiado rapido". Con agilidad alta da falsos positivos.' },
];

function online(onlineAccounts: Set<string>, login: string | null): boolean {
  return !!login && onlineAccounts.has(login.toLowerCase());
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type OnlineEntry = {
  accountId: string;
  login: string;
  character: { id: string; name: string; class: string; level: number; resets: number; map: string | null } | null;
};

export async function dashboard(
  sql: Sql,
  onlineAccounts: Set<string>,
  inGame: { accountId: string; login: string; characterId: string | null; map: string | null }[] | null
) {
  const [counts] = await sql`
    SELECT (SELECT count(*) FROM data."Account")::int AS accounts,
           (SELECT count(*) FROM data."Character")::int AS characters,
           (SELECT count(*) FROM data."Account" WHERE "State" IN (4, 5))::int AS banned,
           (SELECT count(*) FROM data."Account" WHERE "RegistrationDate" > now() - interval '24 hours')::int AS "newAccounts"`;

  const top = await sql`
    SELECT c."Name" AS name, cc."Name" AS class,
           COALESCE(r."Value", 0)::int AS resets, COALESCE(l."Value", 0)::int AS level
      FROM data."Character" c
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
     ORDER BY resets DESC, level DESC LIMIT 8`;

  const recent = await sql`
    SELECT a."LoginName" AS login, a."RegistrationDate" AS "registeredAt"
      FROM data."Account" a ORDER BY a."RegistrationDate" DESC LIMIT 12`;

  // Mu La Ronda: who is playing, by the character in the game. OpenMU knows which one
  // (openmuApi.ts onlinePlayers); without it, the presence service's accounts alone.
  const logins = [...onlineAccounts];
  const fromGame = inGame?.filter(p => p.characterId) ?? [];
  const characters = fromGame.length
    ? await sql<{ id: string; name: string; class: string; level: number; resets: number; accountId: string; login: string }[]>`
        SELECT c."Id"::text AS id, c."Name" AS name, cc."Name" AS class,
               COALESCE(l."Value", 0)::int AS level, COALESCE(r."Value", 0)::int AS resets,
               a."Id"::text AS "accountId", a."LoginName" AS login
          FROM data."Character" c
          JOIN data."Account" a ON a."Id" = c."AccountId"
          JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
          LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
          LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
         WHERE c."Id" = ANY(${fromGame.map(p => p.characterId!)}::uuid[])
         ORDER BY resets DESC, level DESC, c."Name"`
    : [];
  const mapOf = new Map(fromGame.map(p => [p.characterId!.toLowerCase(), p.map]));
  const onlineList: OnlineEntry[] = characters.map(c => ({
    accountId: c.accountId,
    login: c.login,
    character: { id: c.id, name: c.name, class: c.class, level: c.level, resets: c.resets, map: mapOf.get(c.id.toLowerCase()) ?? null },
  }));
  // On the character list (logged in, no character yet), or OpenMU did not answer.
  const listed = new Set(onlineList.map(e => e.login.toLowerCase()));
  const waiting = inGame
    ? inGame.filter(p => !p.characterId && !listed.has(p.login.toLowerCase())).map(p => ({ accountId: p.accountId, login: p.login }))
    : logins.length
      ? await sql<{ accountId: string; login: string }[]>`
          SELECT "Id"::text AS "accountId", "LoginName" AS login FROM data."Account"
           WHERE lower("LoginName") IN ${sql(logins)} ORDER BY "LoginName"`
      : [];
  for (const w of waiting) onlineList.push({ accountId: w.accountId, login: w.login, character: null });

  const online = inGame ? inGame.length : onlineAccounts.size;
  // False when OpenMU did not answer: the list is then the accounts alone, without their characters.
  const gameData = inGame !== null;
  return { ...counts, online, onlineAccounts: logins, onlineList, gameData, top, recent };
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export async function listCharacters(sql: Sql, q: string, onlineAccounts: Set<string>) {
  const like = `%${q}%`;
  const rows = await sql`
    SELECT c."Id" AS id, c."Name" AS name, a."LoginName" AS account, cc."Name" AS class,
           COALESCE(l."Value", 0)::int AS level, COALESCE(m."Value", 0)::int AS "masterLevel",
           COALESCE(r."Value", 0)::int AS resets, c."CharacterStatus" AS status,
           gm."Name" AS map
      FROM data."Character" c
      LEFT JOIN data."Account" a ON a."Id" = c."AccountId"
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN config."GameMapDefinition" gm ON gm."Id" = c."CurrentMapId"
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
      LEFT JOIN data."StatAttribute" m ON m."CharacterId" = c."Id" AND m."DefinitionId" = ${STAT.masterLevel}::uuid
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
     WHERE ${q} = '' OR c."Name" ILIKE ${like} OR a."LoginName" ILIKE ${like}
     ORDER BY resets DESC, level DESC, c."Name"
     LIMIT 200`;
  return rows.map(row => ({ ...row, online: online(onlineAccounts, row.account) }));
}

export async function getCharacter(sql: Sql, id: string, onlineAccounts: Set<string>) {
  const [row] = await sql`
    SELECT c."Id" AS id, c."Name" AS name, a."Id" AS "accountId", a."LoginName" AS account,
           cc."Name" AS class, c."CharacterClassId"::text AS "classId", c."CharacterStatus" AS status, c."LevelUpPoints" AS points,
           c."MasterLevelUpPoints" AS "masterPoints", c."PlayerKillCount" AS kills, c."State" AS "heroState",
           c."CurrentMapId" AS "mapId", c."PositionX" AS x, c."PositionY" AS y,
           c."Experience"::text AS experience, c."CreateDate" AS "createdAt",
           COALESCE(s."Money", 0) AS money
      FROM data."Character" c
      LEFT JOIN data."Account" a ON a."Id" = c."AccountId"
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."ItemStorage" s ON s."Id" = c."InventoryId"
     WHERE c."Id" = ${id}::uuid`;
  if (!row) return null;

  const stats = await sql`
    SELECT "DefinitionId"::text AS def, "Value" AS value FROM data."StatAttribute"
     WHERE "CharacterId" = ${id}::uuid`;
  const byDef = new Map(stats.map(s => [s.def, Number(s.value)]));
  const values = Object.fromEntries(
    (Object.keys(STAT) as StatKey[]).map(key => [key, byDef.has(STAT[key]) ? Math.round(byDef.get(STAT[key])!) : null])
  );

  return { ...row, stats: values, online: online(onlineAccounts, row.account) };
}

export type CharacterPatch = Partial<Record<StatKey, number>> & {
  classId?: string;
  points?: number;
  masterPoints?: number;
  money?: number;
  status?: number;
  kills?: number;
  heroState?: number;
  mapId?: string;
  x?: number;
  y?: number;
};

const clampInt = (v: unknown, min: number, max: number): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
};

export async function updateCharacter(sql: Sql, id: string, patch: CharacterPatch) {
  await sql.begin(async tx => {
    const [character] = await tx`SELECT "InventoryId" AS inv FROM data."Character" WHERE "Id" = ${id}::uuid FOR UPDATE`;
    if (!character) throw new Error('Personaje inexistente');

    const statLimits: Record<StatKey, [number, number]> = {
      level: [1, 400],
      masterLevel: [0, 200],
      resets: [0, 100000],
      strength: [1, MAX_STAT],
      agility: [1, MAX_STAT],
      vitality: [1, MAX_STAT],
      energy: [1, MAX_STAT],
      leadership: [0, MAX_STAT],
    };

    let statsChanged = false;
    for (const key of Object.keys(STAT) as StatKey[]) {
      const value = clampInt(patch[key], ...statLimits[key]);
      if (value === undefined) continue;
      if (key !== 'resets') statsChanged = true;
      const def = STAT[key];
      const updated = await tx`
        UPDATE data."StatAttribute" SET "Value" = ${value}
         WHERE "CharacterId" = ${id}::uuid AND "DefinitionId" = ${def}::uuid RETURNING 1`;
      // Leadership only exists for the classes that have it (Dark Lord).
      if (!updated.length && key !== 'leadership') {
        await tx`
          INSERT INTO data."StatAttribute" ("Id", "CharacterId", "DefinitionId", "Value")
          VALUES (gen_random_uuid(), ${id}::uuid, ${def}::uuid, ${value})`;
      }
      // The level without its experience would take a hundred kills to move.
      if (key === 'level') {
        await tx`UPDATE data."Character" SET "Experience" = ${experienceForLevel(value)} WHERE "Id" = ${id}::uuid`;
      }
    }

    // OpenMU keeps the current health from the last session and only limits it
    // to the new maximum on entering (Player.SetReclaimableAttributesBeforeEnterGame):
    // after more vitality it would stay at the old value. Above any maximum, it
    // starts full.
    if (statsChanged) {
      await tx`
        UPDATE data."StatAttribute" SET "Value" = ${FULL_POOL}
         WHERE "CharacterId" = ${id}::uuid AND "DefinitionId" IN (${CURRENT_HEALTH}::uuid, ${CURRENT_MANA}::uuid)`;
    }

    const sets: Record<string, number | string> = {};
    const points = clampInt(patch.points, 0, 2_000_000_000);
    if (points !== undefined) sets.LevelUpPoints = points;
    const masterPoints = clampInt(patch.masterPoints, 0, 100_000);
    if (masterPoints !== undefined) sets.MasterLevelUpPoints = masterPoints;
    const kills = clampInt(patch.kills, 0, 1_000_000);
    if (kills !== undefined) sets.PlayerKillCount = kills;
    const heroState = clampInt(patch.heroState, 0, 6);
    if (heroState !== undefined) sets.State = heroState;
    if (patch.status !== undefined && (CHARACTER_STATUS as readonly number[]).includes(Number(patch.status))) {
      sets.CharacterStatus = Number(patch.status);
    }
    if (patch.classId) {
      const [cls] = await tx`SELECT 1 FROM config."CharacterClass" WHERE "Id" = ${patch.classId}::uuid`;
      if (!cls) throw new Error('Clase inexistente');
      // OpenMU adds the stats the new class has and the old one lacked (Comando)
      // when the character enters (Player.AddMissingStatAttributes).
      sets.CharacterClassId = patch.classId;
    }
    if (patch.mapId) {
      const [map] = await tx`SELECT 1 FROM config."GameMapDefinition" WHERE "Id" = ${patch.mapId}::uuid`;
      if (!map) throw new Error('Mapa inexistente');
      sets.CurrentMapId = patch.mapId;
    }
    const x = clampInt(patch.x, 0, 255);
    if (x !== undefined) sets.PositionX = x;
    const y = clampInt(patch.y, 0, 255);
    if (y !== undefined) sets.PositionY = y;

    if (Object.keys(sets).length) await tx`UPDATE data."Character" SET ${tx(sets)} WHERE "Id" = ${id}::uuid`;

    const money = clampInt(patch.money, 0, 2_000_000_000);
    if (money !== undefined && character.inv) {
      await tx`UPDATE data."ItemStorage" SET "Money" = ${money} WHERE "Id" = ${character.inv}::uuid`;
    }
  });
}

/** The classes a character can be, in OpenMU's order (DW, SM, GM, DK...). */
export async function listClasses(sql: Sql) {
  return sql`SELECT "Id"::text AS id, "Name" AS name, "Number" AS number FROM config."CharacterClass" ORDER BY "Number"`;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listAccounts(sql: Sql, q: string, onlineAccounts: Set<string>) {
  const like = `%${q}%`;
  const rows = await sql`
    SELECT a."Id" AS id, a."LoginName" AS login, a."EMail" AS email, a."State" AS state,
           a."RegistrationDate" AS "registeredAt", count(c."Id")::int AS characters
      FROM data."Account" a
      LEFT JOIN data."Character" c ON c."AccountId" = a."Id"
     WHERE (${q} = '' OR a."LoginName" ILIKE ${like} OR a."EMail" ILIKE ${like}) AND NOT a."IsTemplate"
     GROUP BY a."Id"
     ORDER BY a."RegistrationDate" DESC
     LIMIT 200`;
  return rows.map(row => ({ ...row, online: online(onlineAccounts, row.login) }));
}

export async function getAccount(sql: Sql, id: string, onlineAccounts: Set<string>) {
  const [row] = await sql`
    SELECT a."Id" AS id, a."LoginName" AS login, a."EMail" AS email, a."State" AS state,
           a."RegistrationDate" AS "registeredAt", a."ChatBanUntil" AS "chatBanUntil",
           (a."VaultPassword" IS NOT NULL AND a."VaultPassword" <> '') AS "hasVaultPin"
      FROM data."Account" a WHERE a."Id" = ${id}::uuid`;
  if (!row) return null;
  const characters = await sql`
    SELECT c."Id" AS id, c."Name" AS name, cc."Name" AS class,
           COALESCE(l."Value", 0)::int AS level, COALESCE(r."Value", 0)::int AS resets
      FROM data."Character" c
      JOIN config."CharacterClass" cc ON cc."Id" = c."CharacterClassId"
      LEFT JOIN data."StatAttribute" l ON l."CharacterId" = c."Id" AND l."DefinitionId" = ${STAT.level}::uuid
      LEFT JOIN data."StatAttribute" r ON r."CharacterId" = c."Id" AND r."DefinitionId" = ${STAT.resets}::uuid
     WHERE c."AccountId" = ${id}::uuid ORDER BY c."CharacterSlot"`;
  return { ...row, characters, online: online(onlineAccounts, row.login) };
}

/**
 * Deletes accounts with everything on them. OpenMU's foreign keys cascade from
 * the account to its characters and from those to skills, stats, quests,
 * letters and guild membership; the vault and the inventories point the other
 * way (Account.VaultId, Character.InventoryId), so they go afterwards, their
 * items cascading with them. Online accounts are refused: OpenMU would write
 * them back when they leave.
 */
export async function deleteAccounts(sql: Sql, ids: string[], onlineAccounts: Set<string>) {
  if (!ids.length) return { deleted: [] as string[] };
  return sql.begin(async tx => {
    const accounts = await tx`
      SELECT "Id" AS id, "LoginName" AS login, "VaultId" AS vault, "IsTemplate" AS template
        FROM data."Account" WHERE "Id" = ANY(${ids}::uuid[]) FOR UPDATE`;
    const busy = accounts.filter(a => online(onlineAccounts, a.login));
    if (busy.length) throw new Error(`Conectadas ahora: ${busy.map(a => a.login).join(', ')}. Que salgan primero.`);
    if (accounts.some(a => a.template)) throw new Error('Las cuentas plantilla de OpenMU no se borran');
    if (!accounts.length) return { deleted: [] as string[] };

    const accountIds = accounts.map(a => a.id);
    const inventories = await tx`
      SELECT "InventoryId" AS id FROM data."Character"
       WHERE "AccountId" = ANY(${accountIds}::uuid[]) AND "InventoryId" IS NOT NULL`;
    const storages = [...accounts.map(a => a.vault), ...inventories.map(i => i.id)].filter(Boolean);

    await tx`DELETE FROM data."Account" WHERE "Id" = ANY(${accountIds}::uuid[])`;
    if (storages.length) await tx`DELETE FROM data."ItemStorage" WHERE "Id" = ANY(${storages}::uuid[])`;
    return { deleted: accounts.map(a => a.login as string) };
  });
}

/**
 * Mu La Ronda: deletes one character, never while its account is in the game
 * (OpenMU would write it back on logout). Its own rows (skills, quests, letters,
 * attributes) cascade from data."Character"; the inventory storage, the friend
 * list entries both ways and the guild membership are not tied to it by a
 * foreign key, so they go by hand.
 */
export async function deleteCharacter(sql: Sql, id: string, onlineAccounts: Set<string>) {
  return sql.begin(async tx => {
    const [row] = await tx`
      SELECT c."Name" AS name, c."InventoryId" AS inventory, a."LoginName" AS login
        FROM data."Character" c LEFT JOIN data."Account" a ON a."Id" = c."AccountId"
       WHERE c."Id" = ${id}::uuid FOR UPDATE OF c`;
    if (!row) throw new Error('El personaje no existe');
    if (online(onlineAccounts, row.login)) throw new Error('La cuenta esta conectada: que salga primero.');
    // `GuildPosition.GuildMaster` (2): a guild without its master is left half broken.
    const [master] = await tx`SELECT 1 FROM guild."GuildMember" WHERE "Id" = ${id}::uuid AND "Status" = 2`;
    if (master) throw new Error('Es maestro de una guild: que la disuelva primero en el juego.');
    await tx`DELETE FROM friend."Friend" WHERE "CharacterId" = ${id}::uuid OR "FriendId" = ${id}::uuid`;
    await tx`DELETE FROM guild."GuildMember" WHERE "Id" = ${id}::uuid`;
    await tx`DELETE FROM data."Character" WHERE "Id" = ${id}::uuid`;
    if (row.inventory) await tx`DELETE FROM data."ItemStorage" WHERE "Id" = ${row.inventory}::uuid`;
    return { deleted: row.name as string };
  });
}

export async function updateAccount(
  sql: Sql,
  id: string,
  patch: { state?: number; email?: string; password?: string; clearVaultPin?: boolean; clearChatBan?: boolean }
) {
  const sets: Record<string, unknown> = {};
  if (patch.state !== undefined) {
    if (!(ACCOUNT_STATES as readonly number[]).includes(Number(patch.state))) throw new Error('Estado invalido');
    sets.State = Number(patch.state);
  }
  if (patch.email !== undefined) sets.EMail = String(patch.email).slice(0, 100);
  if (patch.password) {
    const password = String(patch.password);
    if (!/^[!-~]{4,10}$/.test(password)) throw new Error('La contraseña tiene que tener 4 a 10 caracteres, sin espacios');
    sets.PasswordHash = await bcrypt.hash(password, 11);
  }
  if (patch.clearVaultPin) sets.VaultPassword = '';
  if (patch.clearChatBan) sets.ChatBanUntil = null;
  if (!Object.keys(sets).length) return;
  await sql`UPDATE data."Account" SET ${sql(sets)} WHERE "Id" = ${id}::uuid`;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESET_TYPE = '6a9d585d-79d7-4674-b6ea-7e87392fa501';
/** Mu La Ronda's drop rates (marketplace/openmu/src/GameLogic/PlugIns/MlrDropRatesPlugIn.cs). */
export const DROP_RATES_TYPE = 'c3f1a2b4-5d6e-4f70-8192-a3b4c5d6e7f8';
/** Mu La Ronda's grand reset (marketplace/openmu/src/GameLogic/GrandReset/GrandReset.cs). */
export const GRAND_RESET_TYPE = 'e2b7c4d1-6a3f-4e58-9b0c-1d2e3f4a5b6c';
const GRAND_RESET_DEFAULTS = { RequiredLevel: 400, RequiredResets: 10, RequiredMoney: 0, CoinsPerGrandReset: 100 };

/**
 * The game rules the panel edits: config."GameConfiguration" (one row) and, for PvP,
 * config."GameServerDefinition" (every server). OpenMU reads them when it starts.
 */
const GAME_FIELDS: {
  key: string;
  table: 'GameConfiguration' | 'GameServerDefinition';
  column: string;
  kind: 'number' | 'boolean' | 'seconds';
  min?: number;
  max?: number;
}[] = [
  { key: 'experienceRate', table: 'GameConfiguration', column: 'ExperienceRate', kind: 'number', min: 1, max: 1_000_000 },
  { key: 'masterExperienceRate', table: 'GameConfiguration', column: 'MasterExperienceRate', kind: 'number', min: 1, max: 1_000_000 },
  { key: 'maximumLevel', table: 'GameConfiguration', column: 'MaximumLevel', kind: 'number', min: 1, max: 1000 },
  { key: 'maximumMasterLevel', table: 'GameConfiguration', column: 'MaximumMasterLevel', kind: 'number', min: 0, max: 1000 },
  { key: 'preventExperienceOverflow', table: 'GameConfiguration', column: 'PreventExperienceOverflow', kind: 'boolean' },
  { key: 'minimumMonsterLevelForMasterExperience', table: 'GameConfiguration', column: 'MinimumMonsterLevelForMasterExperience', kind: 'number', min: 0, max: 1000 },
  { key: 'shouldDropMoney', table: 'GameConfiguration', column: 'ShouldDropMoney', kind: 'boolean' },
  { key: 'itemDropDuration', table: 'GameConfiguration', column: 'ItemDropDuration', kind: 'seconds', min: 5, max: 3600 },
  { key: 'maximumItemOptionLevelDrop', table: 'GameConfiguration', column: 'MaximumItemOptionLevelDrop', kind: 'number', min: 1, max: 4 },
  { key: 'excellentItemDropLevelDelta', table: 'GameConfiguration', column: 'ExcellentItemDropLevelDelta', kind: 'number', min: 0, max: 255 },
  { key: 'maximumInventoryMoney', table: 'GameConfiguration', column: 'MaximumInventoryMoney', kind: 'number', min: 0, max: 2_147_483_647 },
  { key: 'maximumVaultMoney', table: 'GameConfiguration', column: 'MaximumVaultMoney', kind: 'number', min: 0, max: 2_147_483_647 },
  { key: 'maximumCharactersPerAccount', table: 'GameConfiguration', column: 'MaximumCharactersPerAccount', kind: 'number', min: 1, max: 5 },
  { key: 'maximumPartySize', table: 'GameConfiguration', column: 'MaximumPartySize', kind: 'number', min: 1, max: 5 },
  { key: 'areaSkillHitsPlayer', table: 'GameConfiguration', column: 'AreaSkillHitsPlayer', kind: 'boolean' },
  { key: 'maximumLetters', table: 'GameConfiguration', column: 'MaximumLetters', kind: 'number', min: 0, max: 1000 },
  { key: 'letterSendPrice', table: 'GameConfiguration', column: 'LetterSendPrice', kind: 'number', min: 0, max: 2_000_000_000 },
  { key: 'damagePerOneItemDurability', table: 'GameConfiguration', column: 'DamagePerOneItemDurability', kind: 'number', min: 1, max: 100_000_000 },
  { key: 'hitsPerOneItemDurability', table: 'GameConfiguration', column: 'HitsPerOneItemDurability', kind: 'number', min: 1, max: 100_000_000 },
  { key: 'pvpEnabled', table: 'GameServerDefinition', column: 'PvpEnabled', kind: 'boolean' },
];

let overridesReady = false;

/**
 * Keeps a value changed here over the deploys: deploy/config/99-admin-config.sql puts every
 * row of mlr.config_overrides back after the other .sql files (which set some of the same
 * fields) ran. `key` picks the row ([column, value]); without it, every row of the table.
 */
async function pin(sql: Sql, table: string, column: string, value: unknown, key?: [string, string]) {
  if (!overridesReady) {
    await sql`CREATE SCHEMA IF NOT EXISTS mlr`;
    await sql`
      CREATE TABLE IF NOT EXISTS mlr.config_overrides (
        "Table" text NOT NULL, "KeyColumn" text NOT NULL DEFAULT '', "Key" text NOT NULL DEFAULT '',
        "Column" text NOT NULL, "Value" text, "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("Table", "KeyColumn", "Key", "Column"))`;
    overridesReady = true;
  }
  const text = value === null || value === undefined ? null : String(value);
  await sql`
    INSERT INTO mlr.config_overrides ("Table", "KeyColumn", "Key", "Column", "Value")
    VALUES (${table}, ${key?.[0] ?? ''}, ${key?.[1].toLowerCase() ?? ''}, ${column}, ${text})
    ON CONFLICT ("Table", "KeyColumn", "Key", "Column") DO UPDATE SET "Value" = EXCLUDED."Value", "UpdatedAt" = now()`;
}

export async function getConfig(sql: Sql) {
  const [row] = await sql.unsafe(
    `SELECT ${GAME_FIELDS.filter(f => f.table === 'GameConfiguration')
      .map(f => (f.kind === 'seconds' ? `extract(epoch FROM "${f.column}")::int` : `"${f.column}"`) + ` AS "${f.key}"`)
      .join(', ')}
       FROM config."GameConfiguration" LIMIT 1`
  );
  const [server] = await sql`SELECT bool_and("PvpEnabled") AS "pvpEnabled" FROM config."GameServerDefinition"`;
  const game = { ...row, pvpEnabled: server?.pvpEnabled ?? true };

  const [reset] = await sql`
    SELECT "IsActive" AS active, "CustomConfiguration" AS config
      FROM config."PlugInConfiguration" WHERE "TypeId" = ${RESET_TYPE}::uuid`;

  const [rates] = await sql`SELECT "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${DROP_RATES_TYPE}::uuid`;
  const [grand] = await sql`
    SELECT "IsActive" AS active, "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${GRAND_RESET_TYPE}::uuid`;
  const rateConfig = safeJson(rates?.config);
  const rate = (k: string) => (Number.isFinite(Number(rateConfig[k])) ? Number(rateConfig[k]) : 100);

  const maps = await sql`
    SELECT "Id" AS id, "Number" AS number, "Name" AS name, "ExpMultiplier" AS "expMultiplier"
      FROM config."GameMapDefinition" ORDER BY "Number"`;

  const fast = await getFastSettings(sql);

  const plugins = await sql`
    SELECT "TypeId"::text AS id, "IsActive" AS active FROM config."PlugInConfiguration"
     WHERE "TypeId" = ANY(${PLUGINS.map(p => p.id)}::uuid[])`;
  const activeById = new Map(plugins.map(p => [p.id, p.active]));

  return {
    game,
    rates: { itemDropRate: rate('ItemDropRate'), excellentDropRate: rate('ExcellentDropRate'), zenDropRate: rate('ZenDropRate') },
    // No row: OpenMU runs a new plugin active, with its defaults.
    grandReset: { active: grand?.active ?? true, ...GRAND_RESET_DEFAULTS, ...pick(safeJson(grand?.config), Object.keys(GRAND_RESET_DEFAULTS)) },
    reset: { active: reset?.active ?? false, config: safeJson(reset?.config) },
    maps,
    fast,
    plugins: PLUGINS.map(p => ({ ...p, active: activeById.get(p.id) ?? null })),
  };
}

function safeJson(text: string | null | undefined): Record<string, unknown> {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/**
 * A plugin configuration as OpenMU reads it. OpenMU writes its own with reference metadata
 * ("$id") that it only accepts as the first property - anywhere else it does not start at all -
 * so the top one is left out: plain JSON reads the same. Nested "$ref"s (items of the
 * configuration) stay.
 */
function pluginJson(config: Record<string, unknown>): string {
  const { $id: _, ...plain } = config;
  return JSON.stringify(plain, null, 2);
}

export async function updateGameConfig(sql: Sql, patch: Record<string, unknown>) {
  for (const field of GAME_FIELDS) {
    if (!(field.key in patch)) continue;
    let value: number | boolean | string;
    if (field.kind === 'boolean') {
      if (typeof patch[field.key] !== 'boolean') continue;
      value = patch[field.key] as boolean;
    } else {
      const v = clampInt(patch[field.key], field.min ?? 0, field.max ?? 2_000_000_000);
      if (v === undefined) continue;
      value = field.kind === 'seconds' ? `${v} seconds` : v;
    }
    await sql.unsafe(`UPDATE config."${field.table}" SET "${field.column}" = $1`, [value as never]);
    await pin(sql, field.table, field.column, value);
  }

  if (Array.isArray(patch.maps)) {
    for (const map of patch.maps as { id: string; expMultiplier: number }[]) {
      const mult = Number(map.expMultiplier);
      if (!Number.isFinite(mult) || mult < 0 || mult > 100) continue;
      await sql`UPDATE config."GameMapDefinition" SET "ExpMultiplier" = ${mult} WHERE "Id" = ${map.id}::uuid`;
      await pin(sql, 'GameMapDefinition', 'ExpMultiplier', mult, ['Id', map.id]);
    }
  }
}

/** Writes a plugin's configuration (and keeps it over the deploys); the row is made when missing. */
async function writePluginConfig(sql: Sql, typeId: string, active: boolean, config: string | null) {
  const updated = config === null
    ? await sql`UPDATE config."PlugInConfiguration" SET "IsActive" = ${active} WHERE "TypeId" = ${typeId}::uuid RETURNING 1`
    : await sql`
        UPDATE config."PlugInConfiguration" SET "IsActive" = ${active}, "CustomConfiguration" = ${config}
         WHERE "TypeId" = ${typeId}::uuid RETURNING 1`;
  if (!updated.length) {
    await sql`
      INSERT INTO config."PlugInConfiguration" ("Id", "TypeId", "IsActive", "CustomConfiguration", "GameConfigurationId")
      SELECT gen_random_uuid(), ${typeId}::uuid, ${active}, ${config}, "Id" FROM config."GameConfiguration" LIMIT 1`;
  }
  await pin(sql, 'PlugInConfiguration', 'IsActive', active, ['TypeId', typeId]);
  if (config !== null) await pin(sql, 'PlugInConfiguration', 'CustomConfiguration', config, ['TypeId', typeId]);
}

const RESET_KEYS: Record<string, 'number' | 'boolean' | 'nullableNumber'> = {
  ResetLimit: 'nullableNumber',
  RequiredLevel: 'number',
  LevelAfterReset: 'number',
  RequiredMoney: 'number',
  MultiplyRequiredMoneyByResetCount: 'boolean',
  RequiredMoneyStepFrom: 'nullableNumber',
  RequiredMoneyStep: 'number',
  ResetStats: 'boolean',
  PointsPerReset: 'number',
  MultiplyPointsByResetCount: 'boolean',
  ReplacePointsPerReset: 'boolean',
  MoveHome: 'boolean',
  LogOut: 'boolean',
};

/** Returns what was written, for OpenMU (openmuApi.ts configurePluginInGame). */
export async function updateResetConfig(sql: Sql, patch: { active?: boolean; config?: Record<string, unknown> }) {
  const [row] = await sql`SELECT "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${RESET_TYPE}::uuid`;
  if (!row) throw new Error('El plugin de resets no existe en la base (corre el deploy primero)');
  const current = safeJson(row.config);

  for (const [key, kind] of Object.entries(RESET_KEYS)) {
    if (!patch.config || !(key in patch.config)) continue;
    const value = patch.config[key];
    if (kind === 'boolean') current[key] = !!value;
    else if (kind === 'nullableNumber' && (value === null || value === '')) current[key] = null;
    else {
      const num = clampInt(value, 0, 2_000_000_000);
      if (num !== undefined) current[key] = num;
    }
  }

  const config = pluginJson(current);
  const active = patch.active ?? true;
  await writePluginConfig(sql, RESET_TYPE, active, config);
  return { typeId: RESET_TYPE, active, config };
}

/** The drop rates, in percent (100 = as configured). Returns what was written, for OpenMU. */
export async function updateDropRates(sql: Sql, patch: Record<string, unknown>) {
  const [row] = await sql`SELECT "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${DROP_RATES_TYPE}::uuid`;
  const current = { ItemDropRate: 100, ExcellentDropRate: 100, ZenDropRate: 100, ...safeJson(row?.config) } as Record<string, unknown>;
  const set = (key: string, column: string) => {
    const v = clampInt(patch[key], 0, 100_000);
    if (v !== undefined) current[column] = v;
  };
  set('itemDropRate', 'ItemDropRate');
  set('excellentDropRate', 'ExcellentDropRate');
  set('zenDropRate', 'ZenDropRate');
  const config = pluginJson(current);
  await writePluginConfig(sql, DROP_RATES_TYPE, true, config);
  return { typeId: DROP_RATES_TYPE, active: true, config };
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) if (Number.isFinite(Number(source[key]))) out[key] = Number(source[key]);
  return out;
}

/** The grand reset: on or off, what it asks and the coins it gives. Returns what was written, for OpenMU. */
export async function updateGrandReset(sql: Sql, patch: Record<string, unknown>) {
  const [row] = await sql`
    SELECT "IsActive" AS active, "CustomConfiguration" AS config FROM config."PlugInConfiguration" WHERE "TypeId" = ${GRAND_RESET_TYPE}::uuid`;
  const current: Record<string, unknown> = { ...GRAND_RESET_DEFAULTS, ...safeJson(row?.config) };
  const limits: Record<string, [number, number]> = {
    RequiredLevel: [1, 1000],
    RequiredResets: [0, 100_000],
    RequiredMoney: [0, 2_000_000_000],
    CoinsPerGrandReset: [0, 1_000_000],
  };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const v = clampInt(patch[key], min, max);
    if (v !== undefined) current[key] = v;
  }
  const active = typeof patch.active === 'boolean' ? patch.active : (row?.active ?? true);
  const config = pluginJson(current);
  await writePluginConfig(sql, GRAND_RESET_TYPE, active, config);
  return { typeId: GRAND_RESET_TYPE, active, config };
}

export async function setPlugin(sql: Sql, id: string, active: boolean) {
  if (!PLUGINS.some(p => p.id === id)) throw new Error('Plugin desconocido');
  await writePluginConfig(sql, id, active, null);
}

// ---------------------------------------------------------------------------
// Server fast (deploy/config/02-fast.sql keeps the originals in mlr.*)
// ---------------------------------------------------------------------------

export async function getFastSettings(sql: Sql) {
  const [exists] = await sql`SELECT to_regclass('mlr.settings') IS NOT NULL AS ok`;
  if (!exists.ok) return { spawnFactor: 1, respawnSeconds: 5, available: false };
  const rows = await sql`SELECT key, value FROM mlr.settings`;
  const get = (k: string, d: number) => Number(rows.find(r => r.key === k)?.value ?? d);
  return { spawnFactor: get('spawn_factor', 1), respawnSeconds: get('respawn_seconds', 5), available: true };
}

export async function updateFastSettings(sql: Sql, patch: { spawnFactor?: number; respawnSeconds?: number }) {
  const factor = clampInt(patch.spawnFactor, 1, 10);
  const respawn = clampInt(patch.respawnSeconds, 1, 30);
  const [ready] = await sql`
    SELECT to_regclass('mlr.spawn_quantity') IS NOT NULL AND to_regclass('mlr.monster_respawn') IS NOT NULL AS ok`;
  if (!ready.ok) throw new Error('Faltan las tablas de 02-fast.sql: corre el deploy primero');

  await sql.begin(async tx => {
    await tx`CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL)`;
    if (factor !== undefined) {
      await tx`INSERT INTO mlr.settings VALUES ('spawn_factor', ${String(factor)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await tx`
        UPDATE config."MonsterSpawnArea" s
           SET "Quantity" = LEAST(b."Quantity" * ${factor}, 32767)
          FROM mlr.spawn_quantity b, config."MonsterDefinition" m
         WHERE b."Id" = s."Id" AND m."Id" = s."MonsterDefinitionId"
           AND m."ObjectKind" = 0 AND s."SpawnTrigger" = 0 AND b."Quantity" >= 2
           AND s."Id" NOT IN (SELECT "Id" FROM mlr.leveling_spawns)`;
    }
    if (respawn !== undefined) {
      await tx`INSERT INTO mlr.settings VALUES ('respawn_seconds', ${String(respawn)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      await tx`
        UPDATE config."MonsterDefinition" m
           SET "RespawnDelay" = LEAST(b."RespawnDelay", make_interval(secs => ${respawn}))
          FROM mlr.monster_respawn b
         WHERE b."Id" = m."Id" AND m."ObjectKind" = 0 AND b."RespawnDelay" <= interval '30 seconds'`;
    }
  });
}

export async function listMaps(sql: Sql) {
  return sql`SELECT "Id" AS id, "Number" AS number, "Name" AS name FROM config."GameMapDefinition" ORDER BY "Number"`;
}
