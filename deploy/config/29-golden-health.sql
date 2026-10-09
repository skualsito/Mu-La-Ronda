-- Mu La Ronda - mas vida para los dorados viejos de la invasion.
--
-- Con rates x9999 y personajes reseteados, los dorados que trae OpenMU (2.500 a
-- 32.000 de vida) morian de un solo golpe: "con 5 resets mate a todos de un
-- Decay". Quedan con 5 veces su vida original. Son valores fijos, no un
-- multiplicador, asi el archivo se puede correr en cada deploy. Los dorados
-- nuevos (493-502, 22-golden-monsters.sql) ya tienen la vida de MU y no se tocan.

BEGIN;

UPDATE config."MonsterAttribute" a
   SET "Value" = v.hp
  FROM config."MonsterDefinition" m,
       (VALUES
         (43::smallint, 12500::real),  -- Golden Budge Dragon (2.500)
         (78, 16000),                  -- Golden Goblin (3.200)
         (54, 25000),                  -- Golden Soldier (5.000)
         (53, 32500),                  -- Golden Titan (6.500)
         (81, 50000),                  -- Golden Vepar (10.000)
         (83, 75000),                  -- Golden Wheel (15.000)
         (79, 110000),                 -- Golden Dragon / Derkon (22.000)
         (80, 125000),                 -- Golden Lizard King (25.000)
         (82, 160000)                  -- Golden Tantallos (32.000)
       ) AS v(num, hp)
 WHERE a."MonsterDefinitionId" = m."Id"
   AND m."Number" = v.num
   AND a."AttributeDefinitionId" = 'a6c39a5c-295f-415e-a314-5e9f9a748d27'; -- MaximumHealth

COMMIT;
