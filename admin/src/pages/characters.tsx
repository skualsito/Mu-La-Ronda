import { useEffect, useMemo, useState } from 'react';
import { api, type Character, type CharacterClassRow, type CharacterRow, type MapRow, type Stats } from '../api';
import { InventoryCard } from './inventory';
import { SkillsCard } from './skills';
import { VaultCard } from './accounts';
import {
  Badge,
  Boundary,
  CHARACTER_STATUS,
  Card,
  Confirm,
  ErrorBox,
  Loading,
  NumberField,
  PageHeader,
  SelectField,
  formatDate,
  formatNumber,
  useDraft,
  useLoad,
  useToast,
} from '../ui';

const MAX_STAT = 32767;
/** OpenMU CharacterStatus.GameMaster. */
const GM_STATUS = 32;

export function CharactersPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, reload } = useLoad(
    () => api<CharacterRow[]>(`/characters?q=${encodeURIComponent(query)}`),
    [query]
  );

  return (
    <>
      <PageHeader title="Personajes" subtitle="Buscá por nombre de personaje o de cuenta" />
      <Card>
        <div className="toolbar">
          <input className="search" placeholder="Buscar… (ej. Skual)" value={q} onChange={e => setQ(e.target.value)} autoFocus />
          <span className="muted small">{data ? `${data.length} resultados` : ''}</span>
        </div>
        {error && <ErrorBox error={error} onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (
          <div className="table-wrap">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Personaje</th>
                  <th>Cuenta</th>
                  <th>Clase</th>
                  <th className="num">Resets</th>
                  <th className="num">Nivel</th>
                  <th className="num">ML</th>
                  <th>Mapa</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id} onClick={() => (location.hash = `#/personajes/${row.id}`)}>
                    <td>
                      <strong>{row.name}</strong> {row.online && <Badge tone="ok">online</Badge>}
                    </td>
                    <td className="muted">{row.account ?? '—'}</td>
                    <td>{row.class}</td>
                    <td className="num accent">{row.resets}</td>
                    <td className="num">{row.level}</td>
                    <td className="num">{row.masterLevel}</td>
                    <td className="muted">{row.map ?? '—'}</td>
                    <td>
                      <Badge tone={CHARACTER_STATUS[row.status]?.tone}>{CHARACTER_STATUS[row.status]?.label ?? row.status}</Badge>
                    </td>
                  </tr>
                ))}
                {!data.length && (
                  <tr>
                    <td colSpan={8} className="empty">
                      Sin resultados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

type Draft = Stats & {
  classId: string;
  points: number;
  masterPoints: number;
  money: number;
  status: number;
  kills: number;
  heroState: number;
  mapId: string;
  x: number;
  y: number;
};

function draftOf(c: Character): Draft {
  return {
    ...c.stats,
    classId: c.classId,
    points: c.points,
    masterPoints: c.masterPoints,
    money: Number(c.money),
    status: c.status,
    kills: c.kills,
    heroState: c.heroState,
    mapId: c.mapId ?? '',
    x: c.x,
    y: c.y,
  };
}

/** Lorencia's town square, the safe place to send a stuck character. */
const LORENCIA = { number: 0, x: 135, y: 128 };

export function CharacterPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<Character>(`/characters/${id}`), [id]);
  const maps = useLoad(() => api<MapRow[]>('/maps'), []);
  const classes = useLoad(() => api<CharacterClassRow[]>('/classes'), []);
  const [draft, updateDraft, resetDraft] = useDraft(data, draftOf);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; text: string; run: () => void }>(null);

  const changes = useMemo(() => {
    if (!data || !draft) return {};
    const original = draftOf(data);
    return Object.fromEntries(
      Object.entries(draft).filter(([k, v]) => original[k as keyof Draft] !== v && v !== null)
    ) as Partial<Draft>;
  }, [data, draft]);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !draft) return <Loading />;

  const locked = data.online;
  const dirty = Object.keys(changes).length > 0;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => updateDraft(d => ({ ...d, [key]: value }));

  const save = async (patch: Partial<Draft> = changes) => {
    setSaving(true);
    try {
      const updated = await api<Character>(`/characters/${id}`, { method: 'PATCH', body: patch });
      setData(updated);
      toast(`${data.name} guardado`);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const quick = {
    fullStats: () =>
      save({
        level: 400,
        masterLevel: 200,
        strength: MAX_STAT,
        agility: MAX_STAT,
        vitality: MAX_STAT,
        energy: MAX_STAT,
        ...(data.stats.leadership !== null ? { leadership: MAX_STAT } : {}),
        points: 0,
        masterPoints: 200,
      }),
    clearPk: () => save({ kills: 0, heroState: 3 }),
    toLorencia: () => {
      const lorencia = maps.data?.find(m => m.number === LORENCIA.number);
      if (!lorencia) return toast('No encontré Lorencia', 'error');
      save({ mapId: lorencia.id, x: LORENCIA.x, y: LORENCIA.y });
    },
    money: () => save({ money: 2_000_000_000 }),
    toggleGm: () => save({ status: data.status === GM_STATUS ? 0 : GM_STATUS }),
  };
  const isGm = data.status === GM_STATUS;

  const ask = (title: string, text: string, run: () => void) => setConfirm({ title, text, run });

  return (
    <>
      <PageHeader
        title={data.name}
        subtitle={`${data.class} · cuenta ${data.account ?? '—'} · creado ${formatDate(data.createdAt)}`}
        actions={
          <>
            <a className="btn btn-ghost" href="#/personajes">
              ← Volver
            </a>
            {data.accountId && (
              <a className="btn btn-ghost" href={`#/cuentas/${data.accountId}`}>
                Ver cuenta
              </a>
            )}
          </>
        }
      />

      {locked && (
        <div className="notice notice-warn">
          <strong>El personaje está conectado.</strong> OpenMU guarda al salir y pisaría cualquier cambio: pedile que salga
          (o desconectalo) y tocá Actualizar.
          <button className="btn btn-ghost btn-small" onClick={reload}>
            Actualizar
          </button>
        </div>
      )}

      <Card title="Acciones rápidas">
        <div className="quick-actions">
          <button className="btn" disabled={locked || saving} onClick={() => ask('Full stats', `Deja a ${data.name} en nivel 400, ML 200 y 32767 en cada stat.`, quick.fullStats)}>
            ⚡ Full stats
          </button>
          <button className="btn" disabled={locked || saving} onClick={quick.money}>
            💰 2.000M de zen
          </button>
          <button className="btn" disabled={locked || saving} onClick={quick.clearPk}>
            🕊 Limpiar PK
          </button>
          <button className="btn" disabled={locked || saving} onClick={() => ask('Mover a Lorencia', `Manda a ${data.name} a la plaza de Lorencia (sirve si quedó trabado).`, quick.toLorencia)}>
            📍 Mover a Lorencia
          </button>
          <button
            className={`btn ${isGm ? '' : 'btn-primary'}`}
            disabled={locked || saving}
            onClick={() =>
              ask(
                isGm ? 'Quitar Game Master' : 'Hacer Game Master',
                isGm
                  ? `${data.name} vuelve a ser un personaje normal.`
                  : `${data.name} pasa a ser Game Master: logo GM sobre la cabeza y comandos /item, /move, /setlevel…`,
                quick.toggleGm
              )
            }
          >
            👑 {isGm ? 'Quitar GM' : 'Hacer GM'}
          </button>
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Nivel y progreso">
          <div className="form-grid">
            <NumberField label="Nivel" value={draft.level} min={1} max={400} disabled={locked} onChange={v => set('level', v)} hint="Ajusta la experiencia sola" />
            <NumberField label="Master level" value={draft.masterLevel} min={0} max={200} disabled={locked} onChange={v => set('masterLevel', v)} />
            <NumberField label="Resets" value={draft.resets} min={0} disabled={locked} onChange={v => set('resets', v)} />
            <NumberField label="Puntos libres" value={draft.points} min={0} disabled={locked} onChange={v => set('points', v ?? 0)} />
            <NumberField label="Puntos master" value={draft.masterPoints} min={0} disabled={locked} onChange={v => set('masterPoints', v ?? 0)} />
            <NumberField label="Zen" value={draft.money} min={0} max={2_000_000_000} disabled={locked} onChange={v => set('money', v ?? 0)} hint={formatNumber(draft.money)} />
          </div>
        </Card>

        <Card title="Stats">
          <div className="form-grid">
            <NumberField label="Fuerza" value={draft.strength} min={1} max={MAX_STAT} disabled={locked} onChange={v => set('strength', v)} />
            <NumberField label="Agilidad" value={draft.agility} min={1} max={MAX_STAT} disabled={locked} onChange={v => set('agility', v)} />
            <NumberField label="Vitalidad" value={draft.vitality} min={1} max={MAX_STAT} disabled={locked} onChange={v => set('vitality', v)} />
            <NumberField label="Energía" value={draft.energy} min={1} max={MAX_STAT} disabled={locked} onChange={v => set('energy', v)} />
            {draft.leadership !== null && (
              <NumberField label="Comando" value={draft.leadership} min={0} max={MAX_STAT} disabled={locked} onChange={v => set('leadership', v)} />
            )}
          </div>
          <p className="muted small">Máximo {formatNumber(MAX_STAT)} por stat.</p>
        </Card>

        <Card title="Ubicación">
          <div className="form-grid">
            <SelectField
              label="Mapa"
              value={draft.mapId}
              disabled={locked || !maps.data}
              options={(maps.data ?? []).map(m => ({ value: m.id, label: `${m.number} · ${m.name}` }))}
              onChange={v => set('mapId', v)}
            />
            <NumberField label="X" value={draft.x} min={0} max={255} disabled={locked} onChange={v => set('x', v ?? 0)} />
            <NumberField label="Y" value={draft.y} min={0} max={255} disabled={locked} onChange={v => set('y', v ?? 0)} />
          </div>
        </Card>

        <Card title="Estado">
          <div className="form-grid">
            <SelectField
              label="Clase"
              value={draft.classId}
              disabled={locked || !classes.data}
              options={(classes.data ?? []).map(c => ({ value: c.id, label: c.name }))}
              onChange={v => set('classId', v)}
              hint="Los poderes que no sean de la clase nueva quedan aprendidos pero no se usan"
            />
            <SelectField
              label="Estado del personaje"
              value={draft.status}
              disabled={locked}
              options={[
                { value: 0, label: 'Normal' },
                { value: 32, label: 'Game Master' },
                { value: 1, label: 'Baneado' },
              ]}
              onChange={v => set('status', v)}
              hint="Game Master habilita /item, /move, /setlevel…"
            />
            <NumberField label="Kills PK" value={draft.kills} min={0} disabled={locked} onChange={v => set('kills', v ?? 0)} />
            <SelectField
              label="Estado PK"
              value={draft.heroState}
              disabled={locked}
              options={[
                // OpenMU HeroState: New, Hero, LightHero, Normal, PK warning, PK 1, PK 2.
                { value: 3, label: 'Normal' },
                { value: 0, label: 'Nuevo' },
                { value: 1, label: 'Héroe' },
                { value: 2, label: 'Héroe leve' },
                { value: 4, label: 'PK advertencia' },
                { value: 5, label: 'PK nivel 1' },
                { value: 6, label: 'PK nivel 2' },
              ]}
              onChange={v => set('heroState', v)}
            />
          </div>
        </Card>
      </div>

      <Boundary resetKey={id}>
        <InventoryCard characterId={id} locked={locked} />
      </Boundary>

      <Boundary resetKey={id}>
        <SkillsCard characterId={id} locked={locked} />
      </Boundary>

      {data.accountId && (
        <Boundary resetKey={id}>
          <VaultCard accountId={data.accountId} online={!!data.online} />
        </Boundary>
      )}

      <div className={`savebar ${dirty ? 'is-visible' : ''}`}>
        <span>
          {Object.keys(changes).length === 1 ? '1 cambio sin guardar' : `${Object.keys(changes).length} cambios sin guardar`}
        </span>
        <button className="btn btn-ghost" onClick={resetDraft} disabled={saving}>
          Descartar
        </button>
        <button className="btn btn-primary" onClick={() => save()} disabled={saving || locked}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {confirm && (
        <Confirm
          title={confirm.title}
          text={confirm.text}
          onAnswer={yes => {
            const run = confirm.run;
            setConfirm(null);
            if (yes) run();
          }}
        />
      )}
    </>
  );
}
