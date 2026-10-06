-- Mu La Ronda - mensajes automaticos (el aviso dorado del centro de la pantalla).
--
-- Se editan desde el panel admin (Mensajes). El proxy lee esta tabla cada 15 s
-- y le manda a cada jugador en juego el mensaje cada interval_minutes; el boton
-- "Enviar ahora" del panel pone send_now_at y el proxy lo manda una vez.
-- OpenMU no tiene anuncios programados propios. Ver proxy/announce.ts.

CREATE SCHEMA IF NOT EXISTS mlr;

CREATE TABLE IF NOT EXISTS mlr.auto_messages (
  id               serial PRIMARY KEY,
  text             text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 30 CHECK (interval_minutes BETWEEN 1 AND 1440),
  enabled          boolean NOT NULL DEFAULT true,
  send_now_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
