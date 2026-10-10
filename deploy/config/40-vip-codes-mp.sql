-- Mu La Ronda - los codigos de descuento valen para todos los VIP: tambien
-- para Plata y Oro pagados con Mercado Pago (marketplace/server/vipPayments.ts).
-- Cada pago guarda el codigo y el porcentaje que uso. Idempotente.

ALTER TABLE mlr.vip_payments ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE mlr.vip_payments ADD COLUMN IF NOT EXISTS discount_percent integer;

-- Que fue cada pago: 'buy' (meses de un VIP) o 'upgrade' (de Plata a Oro, la
-- diferencia por los meses que le quedaban al Plata; mantiene el vencimiento).
ALTER TABLE mlr.vip_payments ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'buy';
