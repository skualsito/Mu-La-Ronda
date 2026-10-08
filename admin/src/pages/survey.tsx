import { api, type SurveyResponse } from '../api';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, formatDate, formatNumber, useLoad } from '../ui';
import { GAME_QUESTIONS, STAFF_QUESTIONS, choiceLabel, type Question } from '../../../src/common/surveyRules';

/**
 * The post-beta survey (register.<domain>/encuesta/): the choices tallied,
 * the free-text ideas, and who wants to join the staff.
 */

type Section = Record<string, string | string[] | number> | null | undefined;

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return value === undefined || value === null || value === '' ? [] : [String(value)];
}

/** How many answered each option of a choice question, most picked first. */
function Tally({ question, answers }: { question: Question; answers: Section[] }) {
  if (question.kind !== 'one' && question.kind !== 'many') return null;
  const counts = new Map(question.options.map(o => [o.value, 0]));
  let answered = 0;
  for (const section of answers) {
    const picked = asList(section?.[question.key]);
    if (picked.length) answered++;
    for (const value of picked) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  return (
    <div className="survey-tally">
      <h4>
        {question.label}
        <span className="muted small"> · {answered} respuestas</span>
      </h4>
      {rows.map(([value, count]) => {
        const share = answered ? Math.round((count / answered) * 100) : 0;
        return (
          <div key={value} className="survey-row">
            <span className="survey-label">{choiceLabel(question, value)}</span>
            <span className="survey-bar">
              <span style={{ width: `${share}%` }} />
            </span>
            <span className="survey-count">
              {count} <span className="muted">({share}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function answerText(question: Question, value: unknown): string {
  const list = asList(value);
  if (!list.length) return '—';
  return list.map(v => choiceLabel(question, v)).join(', ');
}

/** Every answer as a spreadsheet: one row per account, one column per question. */
function downloadCsv(responses: SurveyResponse[]) {
  const columns: { title: string; read: (r: SurveyResponse) => unknown; question?: Question }[] = [
    { title: 'Cuenta', read: r => r.login },
    { title: 'Fecha', read: r => r.createdAt },
    ...GAME_QUESTIONS.map(q => ({ title: q.label, question: q, read: (r: SurveyResponse) => r.answers.game?.[q.key] })),
    { title: 'Quiere ser staff', read: r => (r.staff ? 'Sí' : 'No') },
    ...STAFF_QUESTIONS.map(q => ({ title: q.label, question: q, read: (r: SurveyResponse) => r.answers.staffAnswers?.[q.key] })),
  ];
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    columns.map(c => cell(c.title)).join(','),
    ...responses.map(r =>
      columns
        .map(c => {
          const value = c.read(r);
          return cell(c.question ? answerText(c.question, value).replace(/^—$/, '') : String(value ?? ''));
        })
        .join(',')
    ),
  ];
  // The BOM makes Excel read the accents right.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `encuesta-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function SurveyPage({ tab: route }: { tab?: string }) {
  const { data, error, reload } = useLoad(() => api<SurveyResponse[]>('/survey'), []);
  const tab = route === 'staff' || route === 'ideas' ? route : 'results';

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const staff = data.filter(r => r.staff);
  const ideas = data.filter(r => typeof r.answers.game?.extra === 'string');
  const choiceQuestions = GAME_QUESTIONS.filter(q => q.kind === 'one' || q.kind === 'many');
  const staffChoices = STAFF_QUESTIONS.filter(q => q.kind === 'one' || q.kind === 'many');

  return (
    <>
      <PageHeader
        title="Encuesta"
        subtitle="Cómo quieren el server después de la beta · register/encuesta"
        actions={
          <>
            <button className="btn btn-ghost" onClick={reload}>
              Actualizar
            </button>
            <button className="btn btn-ghost" onClick={() => downloadCsv(data)} disabled={!data.length}>
              Descargar CSV
            </button>
          </>
        }
      />

      <div className="stats-grid">
        <Stat label="Respuestas" value={formatNumber(data.length)} />
        <Stat label="Quieren ser staff" value={formatNumber(staff.length)} tone={staff.length ? 'ok' : undefined} />
        <Stat label="Con ideas" value={formatNumber(ideas.length)} />
        <Stat label="Última" value={data[0] ? formatDate(data[0].createdAt) : '—'} />
      </div>

      <nav className="tabs">
        <a href="#/encuesta" className={tab === 'results' ? 'active' : ''}>
          Resultados
        </a>
        <a href="#/encuesta/staff" className={tab === 'staff' ? 'active' : ''}>
          Staff ({staff.length})
        </a>
        <a href="#/encuesta/ideas" className={tab === 'ideas' ? 'active' : ''}>
          Ideas ({ideas.length})
        </a>
      </nav>

      {!data.length && <p className="empty">Todavía nadie respondió.</p>}

      {!!data.length && tab === 'results' && (
        <div className="grid-2">
          <Card title="El server después de la beta">
            {choiceQuestions.map(q => (
              <Tally key={q.key} question={q} answers={data.map(r => r.answers.game)} />
            ))}
          </Card>
          <Card title="Los que quieren ser staff">
            {staff.length ? (
              staffChoices.map(q => <Tally key={q.key} question={q} answers={staff.map(r => r.answers.staffAnswers)} />)
            ) : (
              <p className="empty">Nadie se anotó todavía.</p>
            )}
          </Card>
        </div>
      )}

      {!!data.length && tab === 'staff' && (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Discord</th>
                  <th>Quiere ayudar en</th>
                  <th>Sabe de MU</th>
                  <th>Versión</th>
                  <th className="num">Años</th>
                  <th>Experiencia</th>
                  <th>Horarios</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(r => {
                  const s = r.answers.staffAnswers ?? {};
                  const q = (key: string) => STAFF_QUESTIONS.find(x => x.key === key)!;
                  return (
                    <tr key={r.login}>
                      <td>
                        <strong>{r.login}</strong>
                        <div className="muted small">{formatDate(r.createdAt)}</div>
                      </td>
                      <td>
                        <Badge tone="accent">{String(s.discord ?? '—')}</Badge>
                      </td>
                      <td>{answerText(q('roles'), s.roles)}</td>
                      <td>{answerText(q('knowledge'), s.knowledge)}</td>
                      <td>{answerText(q('version'), s.version)}</td>
                      <td className="num">{s.years ?? '—'}</td>
                      <td className="survey-text">{String(s.experience ?? '—')}</td>
                      <td className="survey-text">{String(s.availability ?? '—')}</td>
                    </tr>
                  );
                })}
                {!staff.length && (
                  <tr>
                    <td colSpan={8} className="empty">
                      Nadie se anotó todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!!data.length && tab === 'ideas' && (
        <Card>
          {ideas.length ? (
            <ul className="list survey-ideas">
              {ideas.map(r => (
                <li key={r.login}>
                  <p className="survey-text">{String(r.answers.game.extra)}</p>
                  <span className="muted small">
                    {r.login} · {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nadie dejó ideas todavía.</p>
          )}
        </Card>
      )}
    </>
  );
}
