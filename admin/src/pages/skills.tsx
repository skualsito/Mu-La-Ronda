import { useState } from 'react';
import { api, type CharacterSkills, type LearnedSkill } from '../api';
import { Badge, Card, Confirm, ErrorBox, Loading, useLoad, useToast } from '../ui';

/** A character's learned skills ("poderes"): learn, remove, and master skill levels. */

const SKILL_TYPES: Record<number, string> = {
  0: 'Ataque',
  1: 'Castle Siege',
  2: 'Castle Siege',
  3: 'Área',
  4: 'Área',
  5: 'Área',
  10: 'Buff',
  11: 'Curación',
  20: 'Pasiva',
  30: 'Invocación',
  40: 'Otra',
};

export function SkillsCard({ characterId, locked }: { characterId: string; locked: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<CharacterSkills>(`/characters/${characterId}/skills`), [characterId]);
  const [adding, setAdding] = useState('');
  const [addLevel, setAddLevel] = useState(1);
  const [removing, setRemoving] = useState<LearnedSkill | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const run = async (call: Promise<CharacterSkills>, done: string) => {
    setBusy(true);
    try {
      setData(await call);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const path = `/characters/${characterId}/skills`;
  const picked = data.available.find(s => s.skillId === adding);
  const normalLeft = data.available.filter(s => s.maxLevel === null).length;

  const add = () => {
    if (!picked) return;
    void run(
      api(path, { method: 'POST', body: { skillId: picked.skillId, level: picked.maxLevel === null ? undefined : addLevel } }),
      `${picked.name} aprendida`
    ).then(() => setAdding(''));
  };

  return (
    <Card
      title={`Poderes (${data.learned.length})`}
      actions={
        <button
          className="btn btn-small"
          disabled={locked || busy || normalLeft === 0}
          title="Todas las skills normales de la clase (no las master)"
          onClick={() => run(api(path, { method: 'POST', body: { all: true } }), 'Skills de la clase aprendidas')}
        >
          Aprender todas ({normalLeft})
        </button>
      }
    >
      {data.learned.length === 0 ? (
        <p className="muted">No tiene skills aprendidas. Las de las armas se agregan solas al equiparlas.</p>
      ) : (
        <div className="skill-list">
          {data.learned.map(s => (
            <div key={s.id} className="skill-row">
              <span className="skill-number">#{s.number}</span>
              <span className="skill-name">{s.name}</span>
              <Badge tone={s.maxLevel === null ? 'neutral' : 'accent'}>{s.maxLevel === null ? SKILL_TYPES[s.type] ?? 'Skill' : 'Master'}</Badge>
              {s.maxLevel !== null ? (
                <select
                  value={s.level}
                  disabled={locked || busy}
                  onChange={e =>
                    run(api(`${path}/${s.id}`, { method: 'PATCH', body: { level: Number(e.target.value) } }), `${s.name}: nivel ${e.target.value}`)
                  }
                >
                  {Array.from({ length: s.maxLevel }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      Nivel {n}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}
              <button className="btn btn-ghost btn-small" disabled={locked || busy} onClick={() => setRemoving(s)}>
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="skill-add">
        <select value={adding} disabled={locked || data.available.length === 0} onChange={e => setAdding(e.target.value)}>
          <option value="">{data.available.length ? 'Agregar una skill…' : 'Ya tiene todas las skills de su clase'}</option>
          {data.available.map(s => (
            <option key={s.skillId} value={s.skillId}>
              #{s.number} {s.name}
              {s.maxLevel !== null ? ' (master)' : ''}
            </option>
          ))}
        </select>
        {picked && picked.maxLevel !== null && (
          <select value={addLevel} onChange={e => setAddLevel(Number(e.target.value))}>
            {Array.from({ length: picked.maxLevel }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>
                Nivel {n}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary btn-small" disabled={locked || busy || !picked} onClick={add}>
          Aprender
        </button>
      </div>
      {locked && <p className="muted small">El personaje está conectado: no se pueden tocar sus skills.</p>}

      {removing && (
        <Confirm
          title="Quitar skill"
          text={`Se quita ${removing.name}. Se puede volver a agregar cuando quieras.`}
          confirmLabel="Quitar"
          danger
          onAnswer={yes => {
            const skill = removing;
            setRemoving(null);
            if (yes) void run(api(`${path}/${skill.id}`, { method: 'DELETE' }), `${skill.name} quitada`);
          }}
        />
      )}
    </Card>
  );
}
