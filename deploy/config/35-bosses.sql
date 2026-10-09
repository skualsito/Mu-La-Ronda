-- Mu La Ronda - jefes por horario: Skeleton King (700) con sus Skeleton Bone
-- (701) en Lorencia, Lord Silvester (702) en Vulcanus, Erohim (295) al final
-- de Kanturu Relics y Medusa (561) en el Swamp of Calmness.
--
-- OpenMU no tiene ni al Skeleton King ni a Lord Silvester (el cliente los
-- dibuja con los modelos de los esqueletos y del Dark Iron Knight): aca se
-- crean, solo si faltan, con los tiempos de un monstruo parecido. Los hacen
-- aparecer sus plugins (marketplace/openmu, PlugIns/InvasionEvents). Stats y
-- drops despues se ajustan desde el panel (Monstruos / Drops), y lo de ahi
-- gana sobre este archivo.
--
-- Drops (guide.elitemu.net), un item por muerte, sorteado por la chance de
-- cada grupo; si las chances suman menos de 1, el resto es nada. Nunca zen ni
-- los drops generales del mapa (DefaultDropGenerator, BossDropTables):
--   Skeleton King   50% anillo exc +4, 30% pendant exc +4, 20% Life/Creation
--                   (la guia dice +7, pero en OpenMU anillos y pendants llegan a +4)
--   Skeleton Bone   50% Bless, 25% Soul (25% nada)
--   Lord Silvester  100% item socket excelente
--   Erohim          50% item socket excelente, 50% item 380 excelente
--   Medusa          100% arma o escudo socket excelente
-- Idempotente (ids fijos).

BEGIN;

DO $$
DECLARE
  config_id uuid;
  m record;
  source uuid;
BEGIN
  SELECT "Id" INTO config_id FROM config."GameConfiguration" LIMIT 1;

  -- Los monstruos nuevos: numero, nombre, de quien copia tiempos y rangos.
  FOR m IN
    SELECT * FROM (VALUES
      ('a1e5ad10-0000-4000-8000-000000000700'::uuid, 700, 'Skeleton King', 16),
      ('a1e5ad10-0000-4000-8000-000000000701'::uuid, 701, 'Skeleton Bone', 14),
      ('a1e5ad10-0000-4000-8000-000000000702'::uuid, 702, 'Lord Silvester', 459)
    ) AS t(id, number, name, copy_of)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM config."MonsterDefinition" WHERE "Number" = m.number);
    SELECT "Id" INTO source FROM config."MonsterDefinition" WHERE "Number" = m.copy_of;
    IF source IS NULL THEN
      RAISE NOTICE '%: falta el monstruo % para copiar sus tiempos; omitido', m.name, m.copy_of;
      CONTINUE;
    END IF;

    INSERT INTO config."MonsterDefinition"
      ("Id", "AttackSkillId", "MerchantStoreId", "GameConfigurationId", "Number", "Designation",
       "MoveRange", "AttackRange", "ViewRange", "MoveDelay", "AttackDelay", "RespawnDelay",
       "Attribute", "NumberOfMaximumItemDrops", "NpcWindow", "ObjectKind", "IntelligenceTypeName")
    SELECT m.id, NULL, NULL, s."GameConfigurationId", m.number, m.name,
           s."MoveRange", s."AttackRange", s."ViewRange", s."MoveDelay", s."AttackDelay", interval '1 hour',
           s."Attribute", 1, 0, 0, NULL
      FROM config."MonsterDefinition" s
     WHERE s."Id" = source;

    INSERT INTO config."MonsterAttribute" ("Id", "AttributeDefinitionId", "MonsterDefinitionId", "Value")
    SELECT gen_random_uuid(), d."Id", m.id, v.value
      FROM (VALUES
        (700, 'Level', 85), (700, 'Maximum Health', 120000),
        (700, 'Minimum Physical Base Damage', 520), (700, 'Maximum Physical Base Damage', 620),
        (700, 'Base Defense', 330), (700, 'Attack Rate (PvM)', 600), (700, 'Defense Rate (PvM)', 350),
        (701, 'Level', 45), (701, 'Maximum Health', 6000),
        (701, 'Minimum Physical Base Damage', 160), (701, 'Maximum Physical Base Damage', 200),
        (701, 'Base Defense', 90), (701, 'Attack Rate (PvM)', 250), (701, 'Defense Rate (PvM)', 70),
        (702, 'Level', 145), (702, 'Maximum Health', 4000000),
        (702, 'Minimum Physical Base Damage', 2400), (702, 'Maximum Physical Base Damage', 2900),
        (702, 'Base Defense', 1200), (702, 'Attack Rate (PvM)', 2200), (702, 'Defense Rate (PvM)', 1800),
        (702, 'Skill Damage Multiplier', 2),
        (702, 'Fire Resistance', 0.5882353), (702, 'Water Resistance', 0.5882353),
        (702, 'Ice Resistance', 0.5882353), (702, 'Poison Resistance', 0.99607843)
      ) AS v(number, name, value)
      -- Las mismas definiciones de atributo que usan los monstruos (un nombre se puede repetir).
      JOIN LATERAL (
        SELECT d."Id" FROM config."MonsterAttribute" sa
          JOIN config."AttributeDefinition" d ON d."Id" = sa."AttributeDefinitionId"
         WHERE sa."MonsterDefinitionId" = (SELECT "Id" FROM config."MonsterDefinition" WHERE "Number" = 459)
           AND d."Designation" = v.name
         LIMIT 1) d ON true
     WHERE v.number = m.number;
  END LOOP;

  -- Un item por muerte, nunca zen.
  UPDATE config."MonsterDefinition" SET "NumberOfMaximumItemDrops" = 1
   WHERE "Number" IN (295, 561, 700, 701, 702);

  -- Los grupos. ItemType: 0 = de la lista, 2 = excelente de la lista.
  CREATE TEMP TABLE boss_groups (id uuid, monster int, descr text, chance float8, item_type int, item_level smallint, kind text) ON COMMIT DROP;
  INSERT INTO boss_groups VALUES
    ('d0b055e5-0000-4000-8000-000000700001', 700, 'Skeleton King: anillo excelente +4', 0.5, 2, 4, 'rings'),
    ('d0b055e5-0000-4000-8000-000000700002', 700, 'Skeleton King: pendant excelente +4', 0.3, 2, 4, 'pendants'),
    ('d0b055e5-0000-4000-8000-000000700003', 700, 'Skeleton King: Jewel of Life / Creation', 0.2, 0, NULL, 'lifeCreation'),
    ('d0b055e5-0000-4000-8000-000000701001', 701, 'Skeleton Bone: Jewel of Bless', 0.5, 0, NULL, 'bless'),
    ('d0b055e5-0000-4000-8000-000000701002', 701, 'Skeleton Bone: Jewel of Soul', 0.25, 0, NULL, 'soul'),
    ('d0b055e5-0000-4000-8000-000000702001', 702, 'Lord Silvester: item socket excelente', 1.0, 2, NULL, 'socket'),
    ('d0b055e5-0000-4000-8000-000000295001', 295, 'Erohim: item socket excelente', 0.5, 2, NULL, 'socket'),
    ('d0b055e5-0000-4000-8000-000000295002', 295, 'Erohim: item 380 excelente', 0.5, 2, NULL, 'level380'),
    ('d0b055e5-0000-4000-8000-000000561001', 561, 'Medusa: arma o escudo socket excelente', 1.0, 2, NULL, 'socketWeapon');

  FOR m IN SELECT g.*, d."Id" AS monster_id FROM boss_groups g
             JOIN config."MonsterDefinition" d ON d."Number" = g.monster
  LOOP
    INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType", "ItemLevel")
    VALUES (m.id, m.chance, m.descr, config_id, m.item_type, m.item_level)
    ON CONFLICT ("Id") DO UPDATE
      SET "Chance" = EXCLUDED."Chance", "Description" = EXCLUDED."Description",
          "ItemType" = EXCLUDED."ItemType", "ItemLevel" = EXCLUDED."ItemLevel";

    DELETE FROM config."DropItemGroupItemDefinition" WHERE "DropItemGroupId" = m.id;
    INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
    SELECT m.id, d."Id"
      FROM config."ItemDefinition" d
     WHERE d."GameConfigurationId" = config_id
       AND CASE m.kind
         -- Ring of Ice, Poison, Fire, Earth, Wind, Magic.
         WHEN 'rings' THEN d."Group" = 13 AND d."Number" IN (8, 9, 21, 22, 23, 24)
         -- Pendant of Lighting, Fire, Ice, Wind, Water, Ability.
         WHEN 'pendants' THEN d."Group" = 13 AND d."Number" IN (12, 13, 25, 26, 27, 28)
         WHEN 'lifeCreation' THEN d."Group" = 14 AND d."Number" IN (16, 22)
         WHEN 'bless' THEN d."Group" = 14 AND d."Number" = 13
         WHEN 'soul' THEN d."Group" = 14 AND d."Number" = 14
         WHEN 'socket' THEN d."MaximumSockets" > 0
         WHEN 'socketWeapon' THEN d."MaximumSockets" > 0 AND d."Group" <= 6
         -- Los que admiten la opcion guardian (Jewel of Guardian).
         WHEN 'level380' THEN EXISTS (
           SELECT 1 FROM config."ItemDefinitionItemOptionDefinition" x
             JOIN config."ItemOptionDefinition" o ON o."Id" = x."ItemOptionDefinitionId"
            WHERE x."ItemDefinitionId" = d."Id" AND o."Name" LIKE 'Guardian Option%')
       END;

    -- Lo que tenia antes deja de valer para el.
    DELETE FROM config."MonsterDefinitionDropItemGroup"
     WHERE "MonsterDefinitionId" = m.monster_id
       AND "DropItemGroupId"::text NOT LIKE 'd0b055e5-%';
    INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
    VALUES (m.monster_id, m.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

COMMIT;
