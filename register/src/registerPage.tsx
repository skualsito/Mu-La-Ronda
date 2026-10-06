import { useState } from 'react';
import {
  MAX_ACCOUNT_LENGTH,
  MAX_ACCOUNT_PASSWORD_LENGTH,
  MIN_ACCOUNT_LENGTH,
  MIN_ACCOUNT_PASSWORD_LENGTH,
  validateSignup,
  type SignupProblem,
} from '../../src/common/registerRules';

/**
 * Mu La Ronda's account registration: a plain branded form with the logo, in
 * the same look as the client's loading screens. Upstream drew it with the
 * game's interface sprites (`login_back.OZT`, fetched cross-origin from the
 * client's Data/), which here rendered as an empty box - this page needs
 * nothing but its own bundle.
 */

/** Where the account actually gets created. See `register/server/main.ts`. */
const API = import.meta.env.VITE_REGISTER_API || '/api/register';

/** The game: `register.<domain>` -> `<domain>/online`. */
function gameUrl(): string {
  const host = location.hostname.replace(/^register\./, '');
  return `${location.protocol}//${host}/online`;
}

const ROWS = [
  {
    key: 'username',
    label: 'Usuario',
    type: 'text',
    hint: `${MIN_ACCOUNT_LENGTH}-${MAX_ACCOUNT_LENGTH} letras o números`,
    max: MAX_ACCOUNT_LENGTH,
    autoComplete: 'username',
  },
  {
    key: 'password',
    label: 'Contraseña',
    type: 'password',
    hint: `${MIN_ACCOUNT_PASSWORD_LENGTH}-${MAX_ACCOUNT_PASSWORD_LENGTH} caracteres`,
    max: MAX_ACCOUNT_PASSWORD_LENGTH,
    autoComplete: 'new-password',
  },
  {
    key: 'confirm',
    label: 'Repetir contraseña',
    type: 'password',
    hint: '',
    max: MAX_ACCOUNT_PASSWORD_LENGTH,
    autoComplete: 'new-password',
  },
] as const;

type Field = (typeof ROWS)[number]['key'];

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; username: string };

const EMPTY: Record<Field, string> = {
  username: '',
  password: '',
  confirm: '',
};

const PROBLEM_TEXT: Record<SignupProblem, string> = {
  empty: 'Completá todos los campos.',
  idShort: `El usuario tiene que tener al menos ${MIN_ACCOUNT_LENGTH} caracteres.`,
  idChars: 'El usuario solo puede tener letras y números.',
  passwordShort: `La contraseña tiene que tener al menos ${MIN_ACCOUNT_PASSWORD_LENGTH} caracteres.`,
  passwordChars:
    'La contraseña solo puede tener letras, números y símbolos básicos (sin espacios ni acentos).',
  mismatch: 'Las contraseñas no coinciden.',
};

/** The service answers in English; the common cases, said in Spanish. */
function serverError(message: string | undefined, status: number): string {
  if (!message) return `No se pudo crear la cuenta (error ${status}).`;
  if (/already taken/i.test(message)) return 'Ese usuario ya existe. Probá con otro.';
  if (/reserved/i.test(message)) return 'Ese usuario no está permitido. Probá con otro.';
  if (/already been created from this network/i.test(message))
    return 'Ya se crearon demasiadas cuentas desde tu conexión hoy. Probá de nuevo mañana.';
  if (/too many requests/i.test(message))
    return 'Demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (/ID must be/i.test(message))
    return `El usuario tiene que tener entre ${MIN_ACCOUNT_LENGTH} y ${MAX_ACCOUNT_LENGTH} caracteres.`;
  if (/Password must be/i.test(message))
    return `La contraseña tiene que tener entre ${MIN_ACCOUNT_PASSWORD_LENGTH} y ${MAX_ACCOUNT_PASSWORD_LENGTH} caracteres.`;
  if (/only letters and numbers/i.test(message)) return PROBLEM_TEXT.idChars;
  if (/basic symbols/i.test(message)) return PROBLEM_TEXT.passwordChars;
  if (/try again/i.test(message)) return 'No se pudo crear la cuenta. Probá de nuevo.';
  return message;
}

export const RegisterPage = () => {
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const set = (field: Field, value: string) => {
    setValues(current => ({ ...current, [field]: value }));
    if (status.kind === 'error') setStatus({ kind: 'idle' });
  };

  const submit = async () => {
    if (status.kind === 'sending') return;

    const problem = validateSignup(values);

    if (problem) {
      setStatus({ kind: 'error', message: PROBLEM_TEXT[problem] });
      return;
    }

    setStatus({ kind: 'sending' });

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ kind: 'error', message: serverError(body.error, response.status) });
        return;
      }

      setStatus({ kind: 'done', username: values.username });
      setValues(EMPTY);
    } catch {
      setStatus({
        kind: 'error',
        message: 'No se pudo contactar con el servidor. Probá de nuevo en un rato.',
      });
    }
  };

  return (
    <div className="rg-page">
      <div className="rg-glow" aria-hidden />

      <main className="rg-card">
        <img className="rg-logo" src="./la-ronda.png" alt="Mu La Ronda" />
        <p className="rg-kicker">MU Online · Season 6 Episode 3</p>

        {status.kind === 'done' ? (
          <section className="rg-done">
            <h1>¡Cuenta creada!</h1>
            <p>
              Ya podés entrar con el usuario <strong>{status.username}</strong>.
            </p>
            <a className="rg-button" href={gameUrl()}>
              Ir a jugar
            </a>
            <button
              type="button"
              className="rg-link"
              onClick={() => setStatus({ kind: 'idle' })}
            >
              Crear otra cuenta
            </button>
          </section>
        ) : (
          <form
            className="rg-form"
            onSubmit={e => {
              e.preventDefault();
              void submit();
            }}
            noValidate
          >
            <h1>Crear cuenta</h1>

            {ROWS.map((row, i) => (
              <label className="rg-field" key={row.key}>
                <span className="rg-label">
                  {row.label}
                  {row.hint && <small>{row.hint}</small>}
                </span>
                <input
                  className="rg-input"
                  type={row.type}
                  name={row.key}
                  autoFocus={i === 0}
                  autoComplete={row.autoComplete}
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={row.max}
                  value={values[row.key]}
                  onChange={e => set(row.key, e.target.value)}
                />
              </label>
            ))}

            {status.kind === 'error' && (
              <p className="rg-error" role="alert">
                {status.message}
              </p>
            )}

            <button className="rg-button" type="submit" disabled={status.kind === 'sending'}>
              {status.kind === 'sending' ? 'Creando…' : 'Crear cuenta'}
            </button>

            <a className="rg-link" href={gameUrl()}>
              Ya tengo cuenta, ir a jugar
            </a>
          </form>
        )}
      </main>

      <footer className="rg-footer">Servidor en beta · rates altos para que pruebes todo</footer>
    </div>
  );
};
