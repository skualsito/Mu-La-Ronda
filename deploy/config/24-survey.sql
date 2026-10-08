-- Mu La Ronda - encuesta post-beta (register.<dominio>/encuesta/).
--
-- Una respuesta por cuenta: la clave es la cuenta de MU, asi no se puede
-- completar dos veces. La escribe el servicio de registro
-- (register/server/survey.ts) y la lee el panel admin (seccion Encuesta).
-- Las respuestas van en jsonb tal como las valida src/common/surveyRules.ts.

BEGIN;

CREATE SCHEMA IF NOT EXISTS mlr;

CREATE TABLE IF NOT EXISTS mlr.survey_responses (
  account_id  uuid PRIMARY KEY,
  login_name  text NOT NULL,
  answers     jsonb NOT NULL,
  wants_staff boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS survey_responses_created_at ON mlr.survey_responses (created_at DESC);

COMMIT;
