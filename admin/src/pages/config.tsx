import { useState } from 'react';
import { api, type Config } from '../api';
import { Card, Confirm, ErrorBox, Loading, NumberField, PageHeader, Toggle, formatNumber, useDraft, useLoad, useToast } from '../ui';

const TABS = [
  { id: 'juego', label: 'Experiencia' },
  { id: 'resets', label: 'Resets' },
  { id: 'fast', label: 'Server fast' },
  { id: 'mapas', label: 'Mapas' },
  { id: 'plugins', label: 'Comandos y plugins' },
];

/** After a config save: OpenMU only reads its configuration when it starts. */
function RestartHint({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="notice notice-info">
      <span>
        Los cambios de configuración se aplican cuando <strong>OpenMU se reinicia</strong> (desconecta a todos ~30 s).
      </span>
      <button className="btn btn-small" onClick={onRestart}>
        Reiniciar ahora
      </button>
    </div>
  );
}

export function ConfigPage({ tab = 'juego' }: { tab?: string }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<Config>('/config'), []);
  const [pending, setPending] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const save = async (path: string, body: unknown, done: string) => {
    try {
      setData(await api<Config>(path, { method: 'PATCH', body }));
      setPending(true);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const restart = async () => {
    try {
      await api('/server/restart', { method: 'POST' });
      setPending(false);
      toast('OpenMU se está reiniciando');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <>
      <PageHeader title="Configuración" subtitle="Reglas del juego, resets y rates" />
      <nav className="tabs">
        {TABS.map(t => (
          <a key={t.id} href={`#/config/${t.id}`} className={tab === t.id ? 'active' : ''}>
            {t.label}
          </a>
        ))}
      </nav>

      {pending && <RestartHint onRestart={() => setConfirmRestart(true)} />}

      {tab === 'juego' && <GameTab config={data} onSave={body => save('/config/game', body, 'Experiencia guardada')} />}
      {tab === 'resets' && <ResetTab config={data} onSave={body => save('/config/reset', body, 'Resets guardados')} />}
      {tab === 'fast' && <FastTab config={data} onSave={body => save('/config/fast', body, 'Server fast guardado')} />}
      {tab === 'mapas' && <MapsTab config={data} onSave={body => save('/config/game', body, 'Mapas guardados')} />}
      {tab === 'plugins' && (
        <PluginsTab config={data} onToggle={(id, active) => save(`/config/plugins/${id}`, { active }, active ? 'Activado' : 'Desactivado')} />
      )}

      <p className="muted small footnote">
        Ojo: si se modifica el archivo correspondiente en <code>deploy/config/*.sql</code> del repo, el próximo deploy lo
        vuelve a aplicar y pisa estos valores.
      </p>

      {confirmRestart && (
        <Confirm
          title="Reiniciar OpenMU"
          text="Se desconecta a todos los jugadores unos 30 segundos mientras el servidor vuelve a cargar la configuración."
          confirmLabel="Reiniciar"
          danger
          onAnswer={yes => {
            setConfirmRestart(false);
            if (yes) restart();
          }}
        />
      )}
    </>
  );
}

function SaveRow({ dirty, onSave, onReset }: { dirty: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <div className="row-actions">
      <button className="btn btn-primary" disabled={!dirty} onClick={onSave}>
        Guardar
      </button>
      <button className="btn btn-ghost" disabled={!dirty} onClick={onReset}>
        Descartar
      </button>
    </div>
  );
}

function GameTab({ config, onSave }: { config: Config; onSave: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(config.game, g => g);
  const draft = current ?? config.game;
  const setDraft = (next: Config['game']) => update(() => next);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config.game);

  return (
    <Card title="Experiencia y niveles">
      <div className="form-grid">
        <NumberField label="Rate de experiencia" value={draft.experienceRate} min={1} onChange={v => setDraft({ ...draft, experienceRate: v ?? 1 })} hint="Multiplicador global (9999 = beta)" />
        <NumberField label="Rate de experiencia master" value={draft.masterExperienceRate} min={1} onChange={v => setDraft({ ...draft, masterExperienceRate: v ?? 1 })} />
        <NumberField label="Nivel máximo" value={draft.maximumLevel} min={1} max={1000} onChange={v => setDraft({ ...draft, maximumLevel: v ?? 400 })} />
        <NumberField label="Master level máximo" value={draft.maximumMasterLevel} min={0} max={1000} onChange={v => setDraft({ ...draft, maximumMasterLevel: v ?? 200 })} />
      </div>
      <Toggle
        label="Un nivel por bicho"
        hint="La experiencia que sobra al subir se descarta (PreventExperienceOverflow)."
        checked={draft.preventExperienceOverflow}
        onChange={v => setDraft({ ...draft, preventExperienceOverflow: v })}
      />
      <SaveRow dirty={dirty} onSave={() => onSave(draft)} onReset={reset} />
    </Card>
  );
}

type ResetConfig = {
  ResetLimit: number | null;
  RequiredLevel: number;
  LevelAfterReset: number;
  RequiredMoney: number;
  MultiplyRequiredMoneyByResetCount: boolean;
  ResetStats: boolean;
  PointsPerReset: number;
  MultiplyPointsByResetCount: boolean;
  ReplacePointsPerReset: boolean;
  MoveHome: boolean;
  LogOut: boolean;
};

function ResetTab({ config, onSave }: { config: Config; onSave: (body: unknown) => void }) {
  type Draft = ResetConfig & { active: boolean };
  const initialOf = (r: Config['reset']) => ({ active: r.active, ...(r.config as Partial<ResetConfig>) }) as Draft;
  const initial = initialOf(config.reset);
  const [current, update, reset] = useDraft(config.reset, initialOf);
  const draft = current ?? initial;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => update(d => ({ ...d, [k]: v }));

  const example = (n: number) => {
    const money = draft.MultiplyRequiredMoneyByResetCount ? draft.RequiredMoney * n : draft.RequiredMoney;
    const points = draft.MultiplyPointsByResetCount ? draft.PointsPerReset * n : draft.PointsPerReset;
    return `Reset ${n}: cuesta ${formatNumber(money)} zen y deja ${formatNumber(points)} puntos${draft.ReplacePointsPerReset ? '' : ' extra'}.`;
  };

  return (
    <div className="grid-2">
      <Card title="Requisitos">
        <Toggle label="Resets habilitados" checked={draft.active} onChange={v => set('active', v)} />
        <div className="form-grid">
          <NumberField label="Nivel requerido" value={draft.RequiredLevel} min={1} max={1000} onChange={v => set('RequiredLevel', v ?? 400)} />
          <NumberField label="Nivel después del reset" value={draft.LevelAfterReset} min={1} max={1000} onChange={v => set('LevelAfterReset', v ?? 1)} />
          <NumberField label="Zen requerido" value={draft.RequiredMoney} min={0} onChange={v => set('RequiredMoney', v ?? 0)} hint={formatNumber(draft.RequiredMoney)} />
          <NumberField label="Límite de resets" value={draft.ResetLimit} min={0} onChange={v => set('ResetLimit', v)} hint="Vacío = sin límite" />
        </div>
        <Toggle label="El zen se multiplica por la cantidad de resets" checked={!!draft.MultiplyRequiredMoneyByResetCount} onChange={v => set('MultiplyRequiredMoneyByResetCount', v)} />
      </Card>
      <Card title="Recompensa">
        <div className="form-grid">
          <NumberField label="Puntos por reset" value={draft.PointsPerReset} min={0} onChange={v => set('PointsPerReset', v ?? 0)} />
        </div>
        <Toggle label="Los puntos se multiplican por la cantidad de resets" checked={!!draft.MultiplyPointsByResetCount} onChange={v => set('MultiplyPointsByResetCount', v)} />
        <Toggle label="Reemplazar puntos (en vez de sumarlos)" checked={!!draft.ReplacePointsPerReset} onChange={v => set('ReplacePointsPerReset', v)} />
        <Toggle label="Reiniciar stats a los de la clase" checked={!!draft.ResetStats} onChange={v => set('ResetStats', v)} />
        <Toggle label="Mandar a la ciudad" checked={!!draft.MoveHome} onChange={v => set('MoveHome', v)} />
        <Toggle label="Desconectar al resetear" checked={!!draft.LogOut} onChange={v => set('LogOut', v)} />
        <div className="examples">
          <p>{example(1)}</p>
          <p>{example(10)}</p>
        </div>
      </Card>
      <div className="span-2">
        <SaveRow
          dirty={dirty}
          onSave={() => {
            const { active, ...rest } = draft;
            onSave({ active, config: rest });
          }}
          onReset={reset}
        />
      </div>
    </div>
  );
}

function FastTab({ config, onSave }: { config: Config; onSave: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(config.fast, f => f);
  const draft = current ?? config.fast;
  const setDraft = (next: Config['fast']) => update(() => next);
  const dirty = draft.spawnFactor !== config.fast.spawnFactor || draft.respawnSeconds !== config.fast.respawnSeconds;
  const arena = config.maps.find(m => m.number === 6);

  return (
    <div className="grid-2">
      <Card title="Spots de todos los mapas">
        {!config.fast.available && <div className="notice notice-warn">Todavía no se aplicó 02-fast.sql: corré el deploy.</div>}
        <div className="form-grid">
          <NumberField label="Multiplicador de monstruos" value={draft.spawnFactor} min={1} max={10} onChange={v => setDraft({ ...draft, spawnFactor: v ?? 1 })} hint="x1 = original. Al arrancar, OpenMU reparte cada zona en spots de hasta 8 bichos" />
          <NumberField label="Respawn (segundos)" value={draft.respawnSeconds} min={1} max={30} onChange={v => setDraft({ ...draft, respawnSeconds: v ?? 3 })} hint="Solo bichos comunes; los bosses no se tocan" />
        </div>
        <SaveRow dirty={dirty} onSave={() => onSave(draft)} onReset={reset} />
      </Card>
      <Card title="Zona de leveleo (Arena)">
        <p className="muted">
          Cuatro spots en el norte de Arena (<code>/move arena</code>), cada uno da un nivel por bicho en su rango.
          Experiencia del mapa: <strong>x{arena?.expMultiplier ?? '?'}</strong>.
        </p>
        <ul className="list">
          <li><span>Spot 1 · oeste</span><span className="muted">niveles 1–230 · Assassin, Cyclops</span></li>
          <li><span>Spot 2 · centro</span><span className="muted">niveles 230–300 · Devil, Death Knight</span></li>
          <li><span>Spot 3 · este</span><span className="muted">niveles 300–385 · Dark Phoenix Shield</span></li>
          <li><span>Spot 4 · sureste</span><span className="muted">niveles 385–400 · Dark Elf, Soram</span></li>
        </ul>
        <p className="muted small">Definido en deploy/config/06-leveling.sql.</p>
      </Card>
    </div>
  );
}

function MapsTab({ config, onSave }: { config: Config; onSave: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(config.maps, maps =>
    Object.fromEntries(maps.map(m => [m.id, m.expMultiplier ?? 1])) as Record<string, number>
  );
  const draft = current ?? {};
  const setDraft = (next: Record<string, number>) => update(() => next);
  const [filter, setFilter] = useState('');
  const changed = config.maps.filter(m => draft[m.id] !== (m.expMultiplier ?? 1));

  return (
    <Card
      title="Experiencia por mapa"
      actions={<input className="search search-small" placeholder="Filtrar…" value={filter} onChange={e => setFilter(e.target.value)} />}
    >
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Mapa</th>
              <th className="num">Multiplicador</th>
            </tr>
          </thead>
          <tbody>
            {config.maps
              .filter(m => m.name.toLowerCase().includes(filter.toLowerCase()))
              .map(m => (
                <tr key={m.id}>
                  <td className="num muted">{m.number}</td>
                  <td>{m.name}</td>
                  <td className="num">
                    <input
                      className="inline-number"
                      type="number"
                      step="0.5"
                      min={0}
                      value={draft[m.id]}
                      onChange={e => setDraft({ ...draft, [m.id]: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <SaveRow
        dirty={changed.length > 0}
        onSave={() => onSave({ maps: changed.map(m => ({ id: m.id, expMultiplier: draft[m.id] })) })}
        onReset={reset}
      />
    </Card>
  );
}

function PluginsTab({ config, onToggle }: { config: Config; onToggle: (id: string, active: boolean) => void }) {
  const groups = [...new Set(config.plugins.map(p => p.group))];
  return (
    <div className="grid-2">
      {groups.map(group => (
        <Card key={group} title={group}>
          {config.plugins
            .filter(p => p.group === group)
            .map(p => (
              <Toggle
                key={p.id}
                label={p.name}
                hint={p.description + (p.active === null ? ' (OpenMU todavía no lo registró)' : '')}
                checked={!!p.active}
                onChange={v => onToggle(p.id, v)}
              />
            ))}
        </Card>
      ))}
    </div>
  );
}
