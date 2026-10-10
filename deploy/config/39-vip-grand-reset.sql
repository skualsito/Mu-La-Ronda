-- Mu La Ronda - VIP pagos con Mercado Pago, resets que se duplican y Grand Reset.
--
-- 1. Pagos de VIP (Plata y Oro, con Mercado Pago): cada compra queda en
--    mlr.vip_payments (marketplace/server/vipPayments.ts), tambien para darle
--    a cada cuenta, al salir a produccion, los VIP que pago en la beta. Los
--    precios (en pesos) estan en mlr.settings y se cambian desde el panel.
-- 2. Resets: 1.000.000 mas por reset hasta el 10 (el 10 sale 10.000.000) y
--    10.000.000 mas por cada uno desde el 11 (20.000.000, 30.000.000...), una
--    sola vez (marca 'reset_money_steps'); despues manda el panel.
-- 3. Grand Reset: dos atributos del personaje (cuantos hizo y sus monedas),
--    el NPC 760 en Lorencia al lado de Leo y la tienda mlr.grand_shop, que se
--    paga solo con esas monedas (marketplace/openmu/src/GameLogic/GrandReset).
-- Idempotente (ids fijos).

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;
CREATE TABLE IF NOT EXISTS mlr.settings (key text PRIMARY KEY, value text NOT NULL);

-- ─── 1. Pagos VIP ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mlr.vip_payments (
  id            uuid PRIMARY KEY,
  account_id    uuid NOT NULL,
  login         text NOT NULL,
  tier          smallint NOT NULL,
  months        smallint NOT NULL,
  amount        numeric(12, 2) NOT NULL,
  currency      text NOT NULL DEFAULT 'ARS',
  -- pending: esperando el pago; paid: pagado, falta darlo; granted: dado;
  -- rejected / cancelled: Mercado Pago no lo cobro.
  status        text NOT NULL DEFAULT 'pending',
  mp_preference text,
  mp_payment_id text,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz,
  granted_at    timestamptz);
CREATE INDEX IF NOT EXISTS vip_payments_account ON mlr.vip_payments (account_id);
CREATE INDEX IF NOT EXISTS vip_payments_status ON mlr.vip_payments (status, created_at);

-- Precios para probar: Plata $1, Oro $2 (pesos argentinos).
INSERT INTO mlr.settings (key, value) VALUES ('vip_price_2', '1'), ('vip_price_3', '2')
ON CONFLICT (key) DO NOTHING;

-- ─── 2. Resets: +1.000.000 hasta el 10, +10.000.000 despues ──────────────────
DO $$
DECLARE
  reset_type uuid := '6a9d585d-79d7-4674-b6ea-7e87392fa501';
  patch jsonb := '{"RequiredMoney": 1000000, "MultiplyRequiredMoneyByResetCount": true, "RequiredMoneyStepFrom": 10, "RequiredMoneyStep": 10000000}';
BEGIN
  IF EXISTS (SELECT 1 FROM mlr.settings WHERE key = 'reset_money_steps') THEN
    RETURN;
  END IF;

  -- Sin "$id": OpenMU lo acepta solo como primera propiedad, y jsonb reordena.
  UPDATE config."PlugInConfiguration"
     SET "CustomConfiguration" = jsonb_pretty((COALESCE("CustomConfiguration", '{}')::jsonb - '$id') || patch)
   WHERE "TypeId" = reset_type;

  -- Lo fijado desde el panel (00-admin-snapshot.sql) tambien, o 99-admin-config.sql lo volveria atras.
  IF to_regclass('mlr.config_overrides') IS NOT NULL THEN
    UPDATE mlr.config_overrides
       SET "Value" = jsonb_pretty((COALESCE("Value", '{}')::jsonb - '$id') || patch), "UpdatedAt" = now()
     WHERE "Table" = 'PlugInConfiguration' AND "Key" = reset_type::text AND "Column" = 'CustomConfiguration';
  END IF;

  INSERT INTO mlr.settings (key, value) VALUES ('reset_money_steps', now()::text);
END $$;

-- ─── 3. Grand Reset ─────────────────────────────────────────────────────────
INSERT INTO config."AttributeDefinition" ("Id", "Designation", "Description", "GameConfigurationId", "MaximumValue")
SELECT v.id, v.designation, v.description, g."Id", NULL
  FROM (VALUES
          ('4d1c7b2a-9e3f-4a58-8c61-2b7e0f9a3d51'::uuid, 'Mu La Ronda Grand Resets', 'How many grand resets the character did.'),
          ('4d1c7b2a-9e3f-4a58-8c61-2b7e0f9a3d52'::uuid, 'Mu La Ronda Grand Reset Coins', 'Coins of the grand reset shop.')
       ) AS v(id, designation, description)
 CROSS JOIN (SELECT "Id" FROM config."GameConfiguration" LIMIT 1) g
ON CONFLICT ("Id") DO NOTHING;

DO $$
DECLARE
  npc uuid := 'a1e5ad10-0000-4000-8000-000000000760';
  lorencia uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM config."MonsterDefinition" WHERE "Number" = 760) THEN
    -- Copia de Leo the Helper (un NPC que no se mueve ni pelea).
    INSERT INTO config."MonsterDefinition"
      ("Id", "AttackSkillId", "MerchantStoreId", "GameConfigurationId", "Number", "Designation",
       "MoveRange", "AttackRange", "ViewRange", "MoveDelay", "AttackDelay", "RespawnDelay",
       "Attribute", "NumberOfMaximumItemDrops", "NpcWindow", "ObjectKind", "IntelligenceTypeName")
    SELECT npc, NULL, NULL, s."GameConfigurationId", 760, 'Grand Reset',
           s."MoveRange", s."AttackRange", s."ViewRange", s."MoveDelay", s."AttackDelay", s."RespawnDelay",
           s."Attribute", 0, 0, s."ObjectKind", NULL
      FROM config."MonsterDefinition" s
     WHERE s."Number" = 371;
  END IF;

  SELECT "Id" INTO lorencia FROM config."GameMapDefinition" WHERE "Number" = 0;
  IF lorencia IS NOT NULL AND EXISTS (SELECT 1 FROM config."MonsterDefinition" WHERE "Id" = npc) THEN
    INSERT INTO config."MonsterSpawnArea"
      ("Id", "MonsterDefinitionId", "GameMapId", "X1", "Y1", "X2", "Y2", "Direction", "Quantity", "SpawnTrigger", "WaveNumber")
    VALUES ('a1e5ad10-0000-4000-8000-00000000a760', npc, lorencia, 134, 126, 134, 126, 4, 1, 0, 0)
    ON CONFLICT ("Id") DO NOTHING;
  END IF;
END $$;

-- La tienda: cada fila es un item (definicion, nivel, skill, luck, opcion
-- +4*N, excelentes como mascara de bits: 63 = todas) y su precio en monedas.
CREATE TABLE IF NOT EXISTS mlr.grand_shop (
  id            serial PRIMARY KEY,
  definition_id uuid NOT NULL,
  level         smallint NOT NULL DEFAULT 0,
  skill         boolean NOT NULL DEFAULT false,
  luck          boolean NOT NULL DEFAULT false,
  option_level  smallint NOT NULL DEFAULT 0,
  excellent     integer NOT NULL DEFAULT 0,
  price         integer NOT NULL CHECK (price > 0),
  sort          integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now());

COMMIT;
