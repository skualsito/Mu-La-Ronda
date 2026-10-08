/**
 * Mu La Ronda: the post-beta survey - how the players want the server once the
 * beta is over, and who would join the staff.
 *
 * Three places read it: the page that asks (`register/encuesta`), the service
 * that stores the answers (`register/server/survey.ts`), which re-checks all of
 * it because anything can POST there, and the admin panel that tallies them.
 * Engine-free like `registerRules.ts`: nothing here may pull Babylon or a store
 * into a server process.
 */

export type Choice = { value: string; label: string };

export type Question =
  | { key: string; label: string; kind: 'one'; options: readonly Choice[]; required?: boolean }
  | { key: string; label: string; kind: 'many'; options: readonly Choice[]; hint?: string }
  | { key: string; label: string; kind: 'text'; max: number; required?: boolean; multiline?: boolean; placeholder?: string }
  | { key: string; label: string; kind: 'number'; min: number; max: number; required?: boolean };

const choices = (...pairs: [string, string][]): Choice[] => pairs.map(([value, label]) => ({ value, label }));

/** What the server should be like after the beta. */
export const GAME_QUESTIONS: readonly Question[] = [
  {
    key: 'speed',
    label: '¿Qué velocidad querés para el server?',
    kind: 'one',
    required: true,
    options: choices(
      ['superfast', 'Super fast (subir al toque, todo rápido)'],
      ['fast', 'Fast'],
      ['medium', 'Medium'],
      ['slow', 'Slow'],
      ['veryslow', 'Muy slow (estilo MU original)']
    ),
  },
  {
    key: 'drop',
    label: '¿Cuánto drop de items?',
    kind: 'one',
    required: true,
    options: choices(['high', 'Alto'], ['medium', 'Medio'], ['low', 'Bajo (los items valen más)'])
  },
  {
    key: 'resets',
    label: '¿Resets?',
    kind: 'one',
    required: true,
    options: choices(
      ['yes', 'Sí, con resets'],
      ['limited', 'Resets limitados'],
      ['no', 'Sin resets (solo nivel y master level)'],
      ['any', 'Me da igual']
    ),
  },
  {
    key: 'focus',
    label: '¿Qué te gusta más?',
    kind: 'one',
    required: true,
    options: choices(['pvp', 'PvP'], ['pvm', 'PvM (cazar, eventos)'], ['mixed', 'Las dos cosas'])
  },
  {
    key: 'events',
    label: '¿Qué eventos querés que haya?',
    kind: 'many',
    hint: 'Marcá todos los que quieras',
    options: choices(
      ['bc', 'Blood Castle'],
      ['ds', 'Devil Square'],
      ['cc', 'Chaos Castle'],
      ['invasions', 'Invasiones (Golden, Red Dragon, White Wizard)'],
      ['siege', 'Castle Siege'],
      ['kanturu', 'Kanturu'],
      ['it', 'Illusion Temple'],
      ['tournaments', 'Torneos PvP'],
      ['quiz', 'Eventos de GMs (escondidas, trivias)']
    ),
  },
  {
    key: 'often',
    label: '¿Cuánto jugarías?',
    kind: 'one',
    required: true,
    options: choices(['daily', 'Todos los días'], ['weekly', 'Algunos días por semana'], ['weekends', 'Fines de semana'], ['rarely', 'De vez en cuando'])
  },
  {
    key: 'hours',
    label: '¿En qué horario jugás?',
    kind: 'many',
    hint: 'Hora de Argentina',
    options: choices(['morning', 'Mañana'], ['afternoon', 'Tarde'], ['night', 'Noche'], ['late', 'Madrugada'])
  },
  {
    key: 'extra',
    label: '¿Algo más que quieras que agreguemos o cambiemos?',
    kind: 'text',
    multiline: true,
    max: 500,
    placeholder: 'Ideas, cosas que te molestaron en la beta, lo que quieras',
  },
];

/** Only for those who tick "I want to join the staff". */
export const STAFF_QUESTIONS: readonly Question[] = [
  {
    key: 'roles',
    label: '¿En qué te gustaría ayudar?',
    kind: 'many',
    options: choices(['gm', 'GM (moderar, hacer eventos)'], ['spots', 'Creador de spots'], ['shops', 'Creador de shops'], ['other', 'Otra cosa'])
  },
  {
    key: 'knowledge',
    label: '¿Cuánto sabés de MU?',
    kind: 'one',
    required: true,
    options: choices(
      ['1', 'Lo juego, nada más'],
      ['2', 'Conozco bien el juego (items, mapas, eventos)'],
      ['3', 'Sé de drops, spots y cómo se arma un server'],
      ['4', 'Ya configuré o administré servers'],
      ['5', 'Sé de archivos, base de datos o programación de servers']
    ),
  },
  {
    key: 'version',
    label: '¿Hasta qué versión conocés bien?',
    kind: 'one',
    required: true,
    options: choices(
      ['97d', '97d / 99b'],
      ['s1-2', 'Season 1 - 2'],
      ['s3-4', 'Season 3 - 4'],
      ['s6', 'Season 6'],
      ['s8-10', 'Season 8 - 10'],
      ['s12-15', 'Season 12 - 15'],
      ['s16', 'Season 16 o más nueva']
    ),
  },
  { key: 'years', label: '¿Cuántos años jugás MU?', kind: 'number', min: 0, max: 30, required: true },
  {
    key: 'experience',
    label: '¿Fuiste staff en otro server? Contanos',
    kind: 'text',
    multiline: true,
    max: 300,
    placeholder: 'Qué server, qué hacías, cuánto tiempo',
  },
  { key: 'availability', label: '¿Qué días y horarios tenés libres?', kind: 'text', max: 120 },
  { key: 'discord', label: 'Tu usuario de Discord, para contactarte', kind: 'text', max: 40, required: true },
];

export type SurveyAnswers = {
  staff: boolean;
  game: Record<string, string | string[] | number>;
  staffAnswers: Record<string, string | string[] | number> | null;
};

/** Control characters out, line breaks kept, ends trimmed. */
function cleanText(value: string, multiline: boolean): string {
  const lines = multiline ? value.replace(/\r\n?/g, '\n') : value.replace(/[\r\n]+/g, ' ');
  // eslint-disable-next-line no-control-regex
  return lines.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
}

function readSection(
  questions: readonly Question[],
  raw: unknown
): { ok: true; values: Record<string, string | string[] | number> } | { ok: false; error: string } {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const values: Record<string, string | string[] | number> = {};

  for (const q of questions) {
    const value = source[q.key];
    const missing = value === undefined || value === null || value === '';
    switch (q.kind) {
      case 'one': {
        if (missing) {
          if (q.required) return { ok: false, error: `Falta responder: ${q.label}` };
          break;
        }
        if (typeof value !== 'string' || !q.options.some(o => o.value === value)) {
          return { ok: false, error: `Respuesta inválida: ${q.label}` };
        }
        values[q.key] = value;
        break;
      }
      case 'many': {
        if (missing) break;
        if (!Array.isArray(value)) return { ok: false, error: `Respuesta inválida: ${q.label}` };
        const picked = q.options.map(o => o.value).filter(v => value.includes(v));
        if (picked.length !== new Set(value).size) return { ok: false, error: `Respuesta inválida: ${q.label}` };
        if (picked.length > 0) values[q.key] = picked;
        break;
      }
      case 'text': {
        if (missing) {
          if (q.required) return { ok: false, error: `Falta responder: ${q.label}` };
          break;
        }
        if (typeof value !== 'string') return { ok: false, error: `Respuesta inválida: ${q.label}` };
        const text = cleanText(value, q.multiline === true);
        if ([...text].length > q.max) return { ok: false, error: `Muy largo (máximo ${q.max}): ${q.label}` };
        if (text === '') {
          if (q.required) return { ok: false, error: `Falta responder: ${q.label}` };
          break;
        }
        values[q.key] = text;
        break;
      }
      case 'number': {
        if (missing) {
          if (q.required) return { ok: false, error: `Falta responder: ${q.label}` };
          break;
        }
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isInteger(n) || n < q.min || n > q.max) {
          return { ok: false, error: `Tiene que ser un número de ${q.min} a ${q.max}: ${q.label}` };
        }
        values[q.key] = n;
        break;
      }
    }
  }
  return { ok: true, values };
}

/** The answers as they may be stored, or why not. Unknown keys are dropped. */
export function validateSurvey(raw: unknown): { ok: true; answers: SurveyAnswers } | { ok: false; error: string } {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const game = readSection(GAME_QUESTIONS, source.game);
  if (!game.ok) return game;
  const staff = source.staff === true;
  if (!staff) return { ok: true, answers: { staff, game: game.values, staffAnswers: null } };
  const staffAnswers = readSection(STAFF_QUESTIONS, source.staffAnswers);
  if (!staffAnswers.ok) return staffAnswers;
  return { ok: true, answers: { staff, game: game.values, staffAnswers: staffAnswers.values } };
}

/** The label a stored value reads as, for the admin's tally. */
export function choiceLabel(question: Question, value: string): string {
  if (question.kind !== 'one' && question.kind !== 'many') return value;
  return question.options.find(o => o.value === value)?.label ?? value;
}
