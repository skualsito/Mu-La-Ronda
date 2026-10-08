import bcrypt from 'bcryptjs';
import type postgres from 'postgres';
import { BurstLimit, bucketFor, clientIp } from '../../src/common/rateLimit';
import { validateSurvey } from '../../src/common/surveyRules';

/**
 * Mu La Ronda: the post-beta survey's endpoints. The player signs in with the
 * game account - checked against OpenMU's own hash, nothing is stored but the
 * account id and the answers - and may answer once (`mlr.survey_responses`,
 * keyed by account: deploy/config/24-survey.sql).
 *
 *   POST /api/encuesta/login   { username, password }            -> { ok, done }
 *   POST /api/encuesta         { username, password, answers }   -> { ok }
 *
 * No session: the page holds the two fields between the steps and sends them
 * again with the answers, so there is no token to steal or expire. Passwords
 * are tried at most a few times per network (`attempts`), which is what keeps
 * this from being a free password oracle for every account on the server.
 */

/** Requests per network: 20 in 10 minutes (sign-in and send both count). In memory: a restart forgets them, which costs nothing. */
const attempts = new BurstLimit(20, 10 * 60 * 1000);

/** Compared against when the account does not exist, so a miss costs the same time as a hit. */
const DUMMY_HASH = bcrypt.hashSync('no-such-account', 11);

type Sql = postgres.Sql;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The account id when the name and password are right, else null. */
async function signIn(sql: Sql, username: unknown, password: unknown): Promise<{ id: string; name: string } | null> {
  if (typeof username !== 'string' || typeof password !== 'string') return null;
  if (username.length < 1 || username.length > 10 || password.length < 1 || password.length > 10) return null;
  const rows = await sql<{ Id: string; LoginName: string; PasswordHash: string; State: number }[]>`
    SELECT "Id", "LoginName", "PasswordHash", "State" FROM data."Account"
     WHERE lower("LoginName") = lower(${username}) LIMIT 1
  `;
  const account = rows[0];
  const ok = await bcrypt.compare(password, account?.PasswordHash ?? DUMMY_HASH);
  if (!account || !ok) return null;
  return { id: account.Id, name: account.LoginName };
}

async function answered(sql: Sql, accountId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM mlr.survey_responses WHERE account_id = ${accountId} LIMIT 1`;
  return rows.length > 0;
}

/** The survey's response, or null when the request is not the survey's. */
export async function handleSurvey(
  req: Request,
  url: URL,
  sql: Sql,
  server: Parameters<typeof clientIp>[1]
): Promise<Response | null> {
  if (url.pathname !== '/api/encuesta' && url.pathname !== '/api/encuesta/login') return null;
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const bucket = bucketFor(clientIp(req, server));
  if (attempts.hammering(bucket)) {
    return json({ error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Pedido inválido.' }, 400);
  }

  try {
    const account = await signIn(sql, body.username, body.password);
    if (!account) return json({ error: 'Usuario o contraseña incorrectos.' }, 401);

    if (url.pathname === '/api/encuesta/login') {
      return json({ ok: true, done: await answered(sql, account.id) });
    }

    const result = validateSurvey(body.answers);
    if (!result.ok) return json({ error: result.error }, 400);

    const inserted = await sql`
      INSERT INTO mlr.survey_responses (account_id, login_name, answers, wants_staff)
      VALUES (${account.id}, ${account.name}, ${sql.json(result.answers as unknown as postgres.JSONValue)}, ${result.answers.staff})
      ON CONFLICT (account_id) DO NOTHING
      RETURNING 1
    `;
    if (inserted.length === 0) return json({ error: 'Esta cuenta ya completó la encuesta.' }, 409);

    console.log(`survey answered by ${account.name}${result.answers.staff ? ' (staff)' : ''}`);
    return json({ ok: true });
  } catch (err) {
    console.error('survey failed:', err);
    return json({ error: 'No se pudo guardar. Probá de nuevo en un rato.' }, 500);
  }
}
