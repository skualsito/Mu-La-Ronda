import type { Sql } from 'postgres';

/**
 * A character's learned skills ("poderes"): data."SkillEntry" rows pointing at
 * config."Skill". What a class may learn is config."SkillCharacterClass".
 * Master skills (Skill.MasterDefinitionId set) carry a level up to their
 * definition's MaximumLevel; every other skill is level 0.
 *
 * Skills that come from a worn weapon are not entries - the game adds those
 * itself - so they are neither listed nor needed here. Only touched while the
 * character is offline (main.ts checks), like the inventory.
 */

export type SkillRow = {
  skillId: string;
  number: number;
  name: string;
  type: number;
  /** Null for a normal skill; the most a master skill goes up to. */
  maxLevel: number | null;
  rank: number | null;
};

export type LearnedSkill = SkillRow & { id: string; level: number };

const SKILL_COLUMNS = (sql: Sql) => sql`
  s."Id" AS "skillId", s."Number" AS number, s."Name" AS name, s."SkillType" AS type,
  m."MaximumLevel" AS "maxLevel", m."Rank" AS rank`;

async function classOf(sql: Sql, characterId: string): Promise<string> {
  const [row] = await sql`SELECT "CharacterClassId" AS id FROM data."Character" WHERE "Id" = ${characterId}::uuid`;
  if (!row?.id) throw new Error('El personaje no existe');
  return row.id;
}

export async function getSkills(sql: Sql, characterId: string) {
  const classId = await classOf(sql, characterId);
  const learned = await sql<LearnedSkill[]>`
    SELECT e."Id" AS id, e."Level" AS level, ${SKILL_COLUMNS(sql)}
      FROM data."SkillEntry" e
      JOIN config."Skill" s ON s."Id" = e."SkillId"
      LEFT JOIN config."MasterSkillDefinition" m ON m."Id" = s."MasterDefinitionId"
     WHERE e."CharacterId" = ${characterId}::uuid
     ORDER BY m."Rank" NULLS FIRST, s."Number"`;
  const available = await sql<SkillRow[]>`
    SELECT ${SKILL_COLUMNS(sql)}
      FROM config."Skill" s
      JOIN config."SkillCharacterClass" sc ON sc."SkillId" = s."Id" AND sc."CharacterClassId" = ${classId}::uuid
      LEFT JOIN config."MasterSkillDefinition" m ON m."Id" = s."MasterDefinitionId"
     WHERE NOT EXISTS (
       SELECT 1 FROM data."SkillEntry" e WHERE e."CharacterId" = ${characterId}::uuid AND e."SkillId" = s."Id")
     ORDER BY m."Rank" NULLS FIRST, s."Number"`;
  return { learned, available };
}

function masterLevel(level: unknown, max: number): number {
  const n = Number(level ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`El nivel tiene que estar entre 1 y ${max}`);
  return n;
}

export type SkillInput = { skillId?: string; level?: number; all?: boolean };

/** Learns one skill, or with `all` every normal (non-master) skill the class can still learn. */
export async function addSkill(sql: Sql, characterId: string, input: SkillInput): Promise<number> {
  const { available } = await getSkills(sql, characterId);

  if (input.all) {
    const normal = available.filter(s => s.maxLevel === null);
    for (const skill of normal) {
      await sql`
        INSERT INTO data."SkillEntry" ("Id", "CharacterId", "SkillId", "Level")
        VALUES (gen_random_uuid(), ${characterId}::uuid, ${skill.skillId}::uuid, 0)`;
    }
    return normal.length;
  }

  const skill = available.find(s => s.skillId === input.skillId);
  if (!skill) throw new Error('Esa skill no es de esta clase, o ya la tiene');
  const level = skill.maxLevel === null ? 0 : masterLevel(input.level, skill.maxLevel);
  await sql`
    INSERT INTO data."SkillEntry" ("Id", "CharacterId", "SkillId", "Level")
    VALUES (gen_random_uuid(), ${characterId}::uuid, ${skill.skillId}::uuid, ${level})`;
  return 1;
}

/** Only master skills have a level to change. */
export async function updateSkill(sql: Sql, characterId: string, entryId: string, input: SkillInput): Promise<void> {
  const [entry] = await sql<{ maxLevel: number | null }[]>`
    SELECT m."MaximumLevel" AS "maxLevel"
      FROM data."SkillEntry" e
      JOIN config."Skill" s ON s."Id" = e."SkillId"
      LEFT JOIN config."MasterSkillDefinition" m ON m."Id" = s."MasterDefinitionId"
     WHERE e."Id" = ${entryId}::uuid AND e."CharacterId" = ${characterId}::uuid`;
  if (!entry) throw new Error('Esa skill no es de este personaje');
  if (entry.maxLevel === null) throw new Error('Solo las master skills tienen nivel');
  const level = masterLevel(input.level, entry.maxLevel);
  await sql`UPDATE data."SkillEntry" SET "Level" = ${level} WHERE "Id" = ${entryId}::uuid`;
}

export async function deleteSkill(sql: Sql, characterId: string, entryId: string): Promise<void> {
  const result = await sql`
    DELETE FROM data."SkillEntry" WHERE "Id" = ${entryId}::uuid AND "CharacterId" = ${characterId}::uuid`;
  if (result.count === 0) throw new Error('Esa skill no es de este personaje');
}
