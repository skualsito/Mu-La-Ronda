import type { Sql } from 'postgres';
import type { SurveyAnswers } from '../../src/common/surveyRules';

/**
 * The post-beta survey's answers (`mlr.survey_responses`, written by the
 * register service: register/server/survey.ts). Read only: one row per account,
 * tallied by the panel's Encuesta page.
 */

export type SurveyResponse = {
  login: string;
  answers: SurveyAnswers;
  staff: boolean;
  createdAt: string;
};

/** Postgres `undefined_table`: the deploy that creates it has not run yet. */
const UNDEFINED_TABLE = '42P01';

export async function listResponses(sql: Sql): Promise<SurveyResponse[]> {
  try {
    const rows = await sql<{ login: string; answers: SurveyAnswers; staff: boolean; created_at: Date }[]>`
      SELECT login_name AS login, answers, wants_staff AS staff, created_at
        FROM mlr.survey_responses ORDER BY created_at DESC LIMIT 5000`;
    return rows.map(r => ({ login: r.login, answers: r.answers, staff: r.staff, createdAt: r.created_at.toISOString() }));
  } catch (err) {
    if ((err as { code?: string }).code === UNDEFINED_TABLE) return [];
    throw err;
  }
}
