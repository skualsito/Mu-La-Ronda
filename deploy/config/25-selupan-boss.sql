-- Mu La Ronda - Selupan (jefe de Raklion, monstruo 459): reaparece cada 1
-- hora (venia cada 10 segundos) y tira 9 o 10 items al morir, nunca zen,
-- como en los servers de siempre.
--
-- Armas, escudos y piezas de sets normales en +3, +4 o +5, y armas, escudos y
-- piezas excelentes. DefaultDropGenerator (BossDropTables) usa solo estos
-- grupos para Selupan y sortea uno por cada item; los grupos generales del
-- mapa (con el zen) no cuentan para el.
-- Idempotente (ids fijos).

BEGIN;

DO $$
DECLARE
  selupan uuid;
  config_id uuid;
  grp record;
BEGIN
  SELECT "Id" INTO selupan FROM config."MonsterDefinition" WHERE "Number" = 459;
  IF selupan IS NULL THEN
    RAISE NOTICE 'Selupan (459) no existe: drops omitidos';
    RETURN;
  END IF;
  SELECT "Id" INTO config_id FROM config."GameConfiguration" LIMIT 1;

  UPDATE config."MonsterDefinition"
     SET "NumberOfMaximumItemDrops" = 10, "RespawnDelay" = interval '1 hour'
   WHERE "Id" = selupan;

  -- Lo que tenia antes (grupos de OpenMU) deja de valer para el.
  DELETE FROM config."MonsterDefinitionDropItemGroup"
   WHERE "MonsterDefinitionId" = selupan
     AND "DropItemGroupId"::text NOT LIKE 'd0a1c459-%';

  -- ItemType: 0 = normal (de la lista), 2 = excelente (de la lista).
  FOR grp IN
    SELECT * FROM (VALUES
      ('d0a1c459-0000-4000-8000-000000000001'::uuid, 'Selupan: arma/escudo +3', 0, 3::smallint, 'weapons'),
      ('d0a1c459-0000-4000-8000-000000000002'::uuid, 'Selupan: arma/escudo +4', 0, 4::smallint, 'weapons'),
      ('d0a1c459-0000-4000-8000-000000000003'::uuid, 'Selupan: arma/escudo +5', 0, 5::smallint, 'weapons'),
      ('d0a1c459-0000-4000-8000-000000000004'::uuid, 'Selupan: set +3', 0, 3::smallint, 'sets'),
      ('d0a1c459-0000-4000-8000-000000000005'::uuid, 'Selupan: set +4', 0, 4::smallint, 'sets'),
      ('d0a1c459-0000-4000-8000-000000000006'::uuid, 'Selupan: set +5', 0, 5::smallint, 'sets'),
      ('d0a1c459-0000-4000-8000-000000000007'::uuid, 'Selupan: arma/escudo excelente', 2, NULL::smallint, 'excWeapons'),
      ('d0a1c459-0000-4000-8000-000000000008'::uuid, 'Selupan: set excelente', 2, NULL::smallint, 'excSets')
    ) AS t(id, descr, item_type, item_level, kind)
  LOOP
    INSERT INTO config."DropItemGroup" ("Id", "Chance", "Description", "GameConfigurationId", "ItemType", "ItemLevel")
    VALUES (grp.id, 1.0, grp.descr, config_id, grp.item_type, grp.item_level)
    ON CONFLICT ("Id") DO UPDATE
      SET "Chance" = EXCLUDED."Chance", "Description" = EXCLUDED."Description",
          "ItemType" = EXCLUDED."ItemType", "ItemLevel" = EXCLUDED."ItemLevel";

    DELETE FROM config."DropItemGroupItemDefinition" WHERE "DropItemGroupId" = grp.id;

    INSERT INTO config."DropItemGroupItemDefinition" ("DropItemGroupId", "ItemDefinitionId")
    SELECT grp.id, d."Id"
      FROM config."ItemDefinition" d
     WHERE d."GameConfigurationId" = config_id
       AND (d."Group", d."Number") IN (
         SELECT g, n FROM (VALUES
           -- Armas y escudos normales: Flamberge, Sword Breaker, Imperial Sword, Dark Stinger Bow,
           -- Absolute Scepter, Deadly Staff, Imperial Staff, Frost Mace, Crimson Glory,
           -- Salamander, Frost Barrier, Guardian Shield.
           ('weapons', 0, 26), ('weapons', 0, 27), ('weapons', 0, 28), ('weapons', 4, 23),
           ('weapons', 2, 17), ('weapons', 5, 30), ('weapons', 5, 31), ('weapons', 2, 16),
           ('weapons', 6, 17), ('weapons', 6, 18), ('weapons', 6, 19), ('weapons', 6, 20),
           -- Armas y escudos excelentes: Staff of Destruction, Dragon Soul (Grand Soul) Staff,
           -- Legendary Staff, Staff of Resurrection, Dragon Spear, Celestial Bow, Double Blade,
           -- Sword of Destruction, Rune Blade, Elemental Mace, Red Wing Stick, Book of Samut,
           -- Master Scepter, Great Scepter, Saint Crossbow, Aquagold Crossbow, Dragon Shield,
           -- Legendary Shield, Elemental Shield.
           ('excWeapons', 5, 8), ('excWeapons', 5, 9), ('excWeapons', 5, 5), ('excWeapons', 5, 6),
           ('excWeapons', 3, 10), ('excWeapons', 4, 17), ('excWeapons', 0, 13), ('excWeapons', 0, 16),
           ('excWeapons', 0, 31), ('excWeapons', 2, 7), ('excWeapons', 5, 16), ('excWeapons', 5, 21),
           ('excWeapons', 2, 9), ('excWeapons', 2, 10), ('excWeapons', 4, 16), ('excWeapons', 4, 14),
           ('excWeapons', 6, 13), ('excWeapons', 6, 14), ('excWeapons', 6, 16)
         ) AS w(k, g, n)
         WHERE w.k = grp.kind
         UNION ALL
         -- Sets normales: Titan, Brave, Destroy, Phantom, Seraphim, Divine (Faith), Royal
         -- (Paewang), Hades, Succubus (Queen) - las piezas que existen (Destroy y Phantom sin casco).
         SELECT g, n FROM generate_series(7, 11) AS g, generate_series(45, 53) AS n
         WHERE grp.kind = 'sets'
         UNION ALL
         -- Sets excelentes: Ashcrow, Eclipse, Iris, Valiant (sin casco), Glorious.
         SELECT g, n FROM generate_series(7, 11) AS g, generate_series(34, 38) AS n
         WHERE grp.kind = 'excSets'
       );

    INSERT INTO config."MonsterDefinitionDropItemGroup" ("MonsterDefinitionId", "DropItemGroupId")
    VALUES (selupan, grp.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

COMMIT;
