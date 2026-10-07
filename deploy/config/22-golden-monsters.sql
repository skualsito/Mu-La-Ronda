-- Mu La Ronda - los dorados de Season 4 en adelante para la invasion dorada.
--
-- OpenMU solo trae los dorados viejos (Budge Dragon, Goblin, Soldier, Titan,
-- Golden Dragon/Derkon, Vepar, Lizard King, Wheel, Tantallos). Estos son los
-- nuevos, con los numeros del cliente (que ya tiene sus modelos) y los stats de
-- MU (guiamuonline.com, Golden Invasion). Se copian del Golden Dragon (79) -
-- velocidades, rango, skill de ataque - y se les ponen nivel, vida, dano,
-- defensa y rates propios. La invasion (GoldenInvasion.cs) dice donde sale
-- cada uno y que caja tira segun el mapa.
--
--   493 Golden Knight        Dungeon
--   494 Golden Devil         Lost Tower
--   495 Golden Stone Golem   Aida
--   496 Golden Crust         Icarus
--   497 Golden Satyros       Kanturu
--   498 Golden Twin Tail     Kanturu Relics
--   499 Golden Iron Knight   La Cleon
--   500 Golden Napin         Swamp of Peace
--   501 Golden Great Dragon  La Cleon, Kanturu
--   502 Golden Rabbit        Elbeland

BEGIN;

DO $$
DECLARE
  base config."MonsterDefinition"%ROWTYPE;
  g record;
  def uuid;
BEGIN
  SELECT * INTO base FROM config."MonsterDefinition" WHERE "Number" = 79 LIMIT 1;
  IF NOT FOUND THEN
    RAISE NOTICE 'Golden Dragon (79) no existe: dorados nuevos omitidos';
    RETURN;
  END IF;

  FOR g IN
    SELECT * FROM (VALUES
      -- numero, nombre, nivel, vida, dano min, dano max, defensa, attack rate, defense rate
      (493::smallint, 'Golden Knight',        60::real,   5000::real,  180::real,  195::real, 115::real,  300::real,  88::real),
      (494::smallint, 'Golden Devil',         72,        10000,        250,        280,       190,        365,       120),
      (495::smallint, 'Golden Stone Golem',   84,        25000,        375,        425,       275,        530,       190),
      (496::smallint, 'Golden Crust',         92,        34500,        489,        540,       360,        620,       240),
      (497::smallint, 'Golden Satyros',      108,        95000,        950,       1000,       600,        900,       350),
      (498::smallint, 'Golden Twin Tail',    130,       145000,       1040,       1085,       865,       1080,       440),
      (499::smallint, 'Golden Iron Knight',  145,       200000,       1743,       2092,       650,       1940,       840),
      (500::smallint, 'Golden Napin',        112,        77000,       1441,       2017,       585,       1350,       840),
      (501::smallint, 'Golden Great Dragon', 142,        95000,       1917,       2301,       660,       2000,       800),
      (502::smallint, 'Golden Rabbit',        40,         3000,        130,        135,        60,        200,        47)
    ) AS t(num, name, lvl, hp, dmin, dmax, def, ar, dr)
  LOOP
    def := ('a1e5ad10-0000-4000-8000-0000000' || lpad(g.num::text, 5, '0'))::uuid;

    INSERT INTO config."MonsterDefinition"
      ("Id", "AttackDelay", "AttackRange", "AttackSkillId", "Attribute", "Designation",
       "GameConfigurationId", "IntelligenceTypeName", "MerchantStoreId", "MoveDelay", "MoveRange",
       "NpcWindow", "Number", "NumberOfMaximumItemDrops", "ObjectKind", "RespawnDelay", "ViewRange")
    VALUES
      (def, base."AttackDelay", base."AttackRange", base."AttackSkillId", base."Attribute", g.name,
       base."GameConfigurationId", base."IntelligenceTypeName", NULL, base."MoveDelay", base."MoveRange",
       base."NpcWindow", g.num, base."NumberOfMaximumItemDrops", base."ObjectKind", base."RespawnDelay", base."ViewRange")
    ON CONFLICT ("Id") DO UPDATE SET "Designation" = EXCLUDED."Designation";

    -- Los atributos del Golden Dragon (resistencias y demas), solo la primera vez...
    IF NOT EXISTS (SELECT 1 FROM config."MonsterAttribute" WHERE "MonsterDefinitionId" = def) THEN
      INSERT INTO config."MonsterAttribute" ("Id", "AttributeDefinitionId", "MonsterDefinitionId", "Value")
      SELECT gen_random_uuid(), a."AttributeDefinitionId", def, a."Value"
        FROM config."MonsterAttribute" a
       WHERE a."MonsterDefinitionId" = base."Id";
    END IF;

    -- ...y los stats propios, siempre.
    UPDATE config."MonsterAttribute" a
       SET "Value" = v.value
      FROM (VALUES
        ('560931ad-0901-4342-b7f4-fd2e2fcc0563'::uuid, g.lvl),   -- Level
        ('a6c39a5c-295f-415e-a314-5e9f9a748d27'::uuid, g.hp),    -- MaximumHealth
        ('3e8d6a02-e973-4ae4-9df3-cddc3d3183b3'::uuid, g.dmin),  -- MinimumPhysBaseDmg
        ('8a918ea2-893a-48b2-a684-3e71526ca71f'::uuid, g.dmax),  -- MaximumPhysBaseDmg
        ('eb098c46-60d4-4ca6-bbd4-5b6270a1407b'::uuid, g.def),   -- DefenseBase
        ('1129442a-e1c7-4240-8866-b781c2838c25'::uuid, g.ar),    -- AttackRatePvm
        ('c520dd2d-1b06-4392-95ee-3c41f33e68da'::uuid, g.dr)     -- DefenseRatePvm
      ) AS v(attribute, value)
     WHERE a."MonsterDefinitionId" = def
       AND a."AttributeDefinitionId" = v.attribute;
  END LOOP;
END $$;

COMMIT;
