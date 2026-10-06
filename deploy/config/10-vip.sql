-- Mu La Ronda - VIP (bronce, plata, oro).
--
-- El VIP es de la cuenta y dura 30 dias. Se guarda en dos atributos de la
-- cuenta (data."StatAttribute" con AccountId) que usa solo el plugin VIP
-- (marketplace/openmu/src/GameLogic/VipSystem): el nivel (0 nada, 1 bronce,
-- 2 plata, 3 oro) y el vencimiento (dias desde 1970-01-01 UTC). En la beta se
-- compra con zen (/vip oro, o el boton VIP del menu Esc); el panel tambien
-- puede darlo. Los beneficios (+10/20/30% de experiencia y zen) los pone el
-- plugin al entrar al juego.
INSERT INTO config."AttributeDefinition" ("Id", "Designation", "Description", "GameConfigurationId", "MaximumValue")
SELECT v.id, v.designation, v.description, g."Id", NULL
  FROM (VALUES
          ('8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e81'::uuid, 'Mu La Ronda VIP Tier', '0 none, 1 bronze, 2 silver, 3 gold.'),
          ('8b6f3a1e-5c2d-4e7f-9a10-3d4c5b6a7e82'::uuid, 'Mu La Ronda VIP Expires', 'Days since 1970-01-01 UTC.')
       ) AS v(id, designation, description)
 CROSS JOIN (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) g
ON CONFLICT ("Id") DO NOTHING;

-- Los plugins nuevos arrancan activos; esto es por si alguien los apago.
UPDATE config."PlugInConfiguration" SET "IsActive" = true
 WHERE "TypeId" IN ('2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c24',   -- /vip
                    '2c7d9e41-6a8b-4f3c-b1d5-0e9f8a7b6c25');  -- bonus al entrar
