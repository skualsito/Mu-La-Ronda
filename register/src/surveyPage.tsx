import { useState } from 'react';
import {
  MAX_ACCOUNT_LENGTH,
  MAX_ACCOUNT_PASSWORD_LENGTH,
} from '../../src/common/registerRules';
import {
  GAME_QUESTIONS,
  STAFF_QUESTIONS,
  validateSurvey,
  type Question,
} from '../../src/common/surveyRules';

/**
 * Mu La Ronda's post-beta survey: sign in with the game account, answer once.
 * The questions live in `src/common/surveyRules.ts`, shared with the service
 * that stores them (`register/server/survey.ts`) and the admin's tally.
 */

const API = '/api/encuesta';

/** Under nginx's 4 KB `client_max_body_size` for /api/ on the register host. */
const MAX_BODY_BYTES = 3900;

/** The game: `register.<domain>` -> `<domain>/online`. */
function gameUrl(): string {
  const host = location.hostname.replace(/^register\./, '');
  return `${location.protocol}//${host}/online`;
}

type Values = Record<string, string | string[]>;

type Step =
  | { kind: 'login' }
  | { kind: 'form' }
  | { kind: 'already' }
  | { kind: 'done'; staff: boolean };

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/** The form's values as the answers the service checks: numbers as numbers, blanks left out. */
function toAnswers(questions: readonly Question[], values: Values): Record<string, string | string[] | number> {
  const out: Record<string, string | string[] | number> = {};
  for (const q of questions) {
    const value = values[q.key];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    out[q.key] = q.kind === 'number' && typeof value === 'string' ? Number(value) : value;
  }
  return out;
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const required = 'required' in question && question.required;
  const title = (
    <span className="sv-question">
      {question.label}
      {required && <em aria-hidden> *</em>}
      {question.kind === 'many' && question.hint && <small>{question.hint}</small>}
    </span>
  );

  switch (question.kind) {
    case 'one':
      return (
        <fieldset className="sv-field">
          <legend>{title}</legend>
          <div className="sv-options">
            {question.options.map(option => (
              <label key={option.value} className={`sv-option${value === option.value ? ' sv-picked' : ''}`}>
                <input
                  type="radio"
                  name={question.key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case 'many': {
      const picked = Array.isArray(value) ? value : [];
      return (
        <fieldset className="sv-field">
          <legend>{title}</legend>
          <div className="sv-options">
            {question.options.map(option => {
              const on = picked.includes(option.value);
              return (
                <label key={option.value} className={`sv-option${on ? ' sv-picked' : ''}`}>
                  <input
                    type="checkbox"
                    value={option.value}
                    checked={on}
                    onChange={() =>
                      onChange(on ? picked.filter(v => v !== option.value) : [...picked, option.value])
                    }
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case 'text': {
      const text = typeof value === 'string' ? value : '';
      return (
        <label className="sv-field">
          {title}
          {question.multiline ? (
            <textarea
              className="rg-input sv-textarea"
              maxLength={question.max}
              placeholder={question.placeholder}
              value={text}
              onChange={e => onChange(e.target.value)}
            />
          ) : (
            <input
              className="rg-input"
              maxLength={question.max}
              placeholder={question.placeholder}
              value={text}
              onChange={e => onChange(e.target.value)}
            />
          )}
          <small className="sv-count">
            {[...text].length}/{question.max}
          </small>
        </label>
      );
    }
    case 'number':
      return (
        <label className="sv-field">
          {title}
          <input
            className="rg-input sv-number"
            type="number"
            inputMode="numeric"
            min={question.min}
            max={question.max}
            value={typeof value === 'string' ? value : ''}
            onChange={e => onChange(e.target.value)}
          />
        </label>
      );
  }
}

export const SurveyPage = () => {
  const [step, setStep] = useState<Step>({ kind: 'login' });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [game, setGame] = useState<Values>({});
  const [staff, setStaff] = useState(false);
  const [staffValues, setStaffValues] = useState<Values>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  const signIn = async () => {
    if (busy) return;
    if (!username || !password) return fail('Completá usuario y contraseña.');
    setBusy(true);
    setError('');
    try {
      const { ok, status, data } = await post(`${API}/login`, { username, password });
      if (!ok) return fail(typeof data.error === 'string' ? data.error : `No se pudo entrar (error ${status}).`);
      setStep(data.done ? { kind: 'already' } : { kind: 'form' });
      setBusy(false);
    } catch {
      fail('No se pudo contactar con el servidor. Probá de nuevo en un rato.');
    }
  };

  const send = async () => {
    if (busy) return;
    const answers = {
      game: toAnswers(GAME_QUESTIONS, game),
      staff,
      staffAnswers: staff ? toAnswers(STAFF_QUESTIONS, staffValues) : null,
    };
    // The same check the service makes, so a missing answer is said here.
    const checked = validateSurvey(answers);
    if (!checked.ok) return fail(checked.error);
    // nginx takes at most 4 KB per request on this host (client_max_body_size).
    if (new TextEncoder().encode(JSON.stringify({ username, password, answers })).length > MAX_BODY_BYTES) {
      return fail('Las respuestas son muy largas: acortá un poco los textos (los emojis ocupan más).');
    }
    setBusy(true);
    setError('');
    try {
      const { ok, status, data } = await post(API, { username, password, answers });
      if (status === 409) {
        setStep({ kind: 'already' });
        setBusy(false);
        return;
      }
      if (!ok) return fail(typeof data.error === 'string' ? data.error : `No se pudo enviar (error ${status}).`);
      setPassword('');
      setStep({ kind: 'done', staff });
      setBusy(false);
    } catch {
      fail('No se pudo contactar con el servidor. Probá de nuevo en un rato.');
    }
  };

  return (
    <div className="rg-page sv-page">
      <div className="rg-glow" aria-hidden />

      <main className="rg-card sv-card">
        <img className="rg-logo" src="../la-ronda.png" alt="Mu La Ronda" />
        <p className="rg-kicker">Encuesta post-beta</p>

        {step.kind === 'login' && (
          <form
            className="rg-form"
            onSubmit={e => {
              e.preventDefault();
              void signIn();
            }}
            noValidate
          >
            <h1>¿Cómo querés el Mu?</h1>
            <p className="sv-intro">
              Estamos armando el server para cuando termine la beta y queremos saber qué preferís. Entrá con tu
              cuenta del juego: se completa <strong>una sola vez</strong> por cuenta.
            </p>
            <label className="rg-field">
              <span className="rg-label">Usuario</span>
              <input
                className="rg-input"
                name="username"
                autoFocus
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={MAX_ACCOUNT_LENGTH}
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setError('');
                }}
              />
            </label>
            <label className="rg-field">
              <span className="rg-label">Contraseña</span>
              <input
                className="rg-input"
                type="password"
                name="password"
                autoComplete="current-password"
                maxLength={MAX_ACCOUNT_PASSWORD_LENGTH}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
            </label>
            {error && (
              <p className="rg-error" role="alert">
                {error}
              </p>
            )}
            <button className="rg-button" type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {step.kind === 'form' && (
          <form
            className="rg-form sv-form"
            onSubmit={e => {
              e.preventDefault();
              void send();
            }}
            noValidate
          >
            <h1>Hola, {username}</h1>
            <p className="sv-intro">Las preguntas con * son obligatorias.</p>

            <h2 className="sv-section">El server después de la beta</h2>
            {GAME_QUESTIONS.map(q => (
              <QuestionField
                key={q.key}
                question={q}
                value={game[q.key]}
                onChange={value => {
                  setGame(current => ({ ...current, [q.key]: value }));
                  setError('');
                }}
              />
            ))}

            <h2 className="sv-section">Staff</h2>
            <p className="sv-intro">Buscamos GMs, creadores de spots y creadores de shops.</p>
            <label className={`sv-option sv-staff${staff ? ' sv-picked' : ''}`}>
              <input type="checkbox" checked={staff} onChange={e => setStaff(e.target.checked)} />
              <span>Me interesa sumarme al staff</span>
            </label>
            {staff &&
              STAFF_QUESTIONS.map(q => (
                <QuestionField
                  key={q.key}
                  question={q}
                  value={staffValues[q.key]}
                  onChange={value => {
                    setStaffValues(current => ({ ...current, [q.key]: value }));
                    setError('');
                  }}
                />
              ))}

            {error && (
              <p className="rg-error" role="alert">
                {error}
              </p>
            )}
            <button className="rg-button" type="submit" disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar respuestas'}
            </button>
          </form>
        )}

        {step.kind === 'already' && (
          <section className="rg-done">
            <h1>Ya respondiste</h1>
            <p>Esta cuenta ya completó la encuesta. ¡Gracias!</p>
            <a className="rg-button" href={gameUrl()}>
              Ir a jugar
            </a>
          </section>
        )}

        {step.kind === 'done' && (
          <section className="rg-done">
            <h1>¡Gracias!</h1>
            <p>
              Guardamos tus respuestas.
              {step.staff && ' Si te elegimos para el staff, te escribimos por Discord.'}
            </p>
            <a className="rg-button" href={gameUrl()}>
              Ir a jugar
            </a>
          </section>
        )}
      </main>

      <footer className="rg-footer">Mu La Ronda · Season 6 Episode 3</footer>
    </div>
  );
};
