import { useState } from 'react';
import { api, type Config } from '../api';
import { Card, Confirm, ErrorBox, Loading, NumberField, PageHeader, Toggle, formatNumber, useDraft, useLoad, useToast } from '../ui';

const TABS = [
  { id: 'juego', label: 'Juego' },
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
      const config = await api<Config>(path, { method: 'PATCH', body });
      setData(config);
      if (!config.live) setPending(true);
      toast(config.live ? `${done} (ya en el juego)` : done);
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

      {tab === 'juego' && (
        <GameTab
          config={data}
          onSave={body => save('/config/game', body, 'Juego guardado')}
          onSaveRates={body => save('/config/rates', body, 'Rates de drop guardados')}
        />
      )}
      {tab === 'resets' && (
        <ResetTab
          config={data}
          onSave={body => save('/config/reset', body, 'Resets guardados')}
          onSaveGrand={body => save('/config/grand-reset', body, 'Grand Reset guardado')}
        />
      )}
      {tab === 'fast' && <FastTab config={data} onSave={body => save('/config/fast', body, 'Server fast guardado')} />}
      {tab === 'mapas' && <MapsTab config={data} onSave={body => save('/config/game', body, 'Mapas guardados')} />}
      {tab === 'plugins' && (
        <PluginsTab config={data} onToggle={(id, active) => save(`/config/plugins/${id}`, { active }, active ? 'Activado' : 'Desactivado')} />
      )}

      <p className="muted small footnote">
        Lo que se cambia acá queda fijo: los deploys no lo pisan (<code>deploy/config/99-admin-config.sql</code>).
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

function GameTab({ config, onSave, onSaveRates }: { config: Config; onSave: (body: unknown) => void; onSaveRates: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(config.game, g => g);
  const draft = current ?? config.game;
  type Game = Config['game'];
  const set = <K extends keyof Game>(k: K, v: Game[K]) => update(() => ({ ...draft, [k]: v }));
  const num = <K extends keyof Game>(k: K, fallback: number) => (v: number | null) => set(k, (v ?? fallback) as Game[K]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(config.game);
  const save = <SaveRow dirty={dirty} onSave={() => onSave(draft)} onReset={reset} />;

  return (
    <>
      <div className="grid-2">
        <Card title="Experiencia y niveles">
          <div className="form-grid">
            <NumberField label="Rate de experiencia" value={draft.experienceRate} min={1} onChange={num('experienceRate', 1)} hint="Multiplicador global (9999 = beta)" />
            <NumberField label="Rate de experiencia master" value={draft.masterExperienceRate} min={1} onChange={num('masterExperienceRate', 1)} />
            <NumberField label="Nivel máximo" value={draft.maximumLevel} min={1} max={1000} onChange={num('maximumLevel', 400)} />
            <NumberField label="Master level máximo" value={draft.maximumMasterLevel} min={0} max={1000} onChange={num('maximumMasterLevel', 200)} />
            <NumberField
              label="Nivel mínimo del bicho para exp master"
              value={draft.minimumMonsterLevelForMasterExperience}
              min={0}
              max={1000}
              onChange={num('minimumMonsterLevelForMasterExperience', 95)}
            />
          </div>
          <Toggle
            label="Un nivel por bicho"
            hint="La experiencia que sobra al subir se descarta (PreventExperienceOverflow)."
            checked={draft.preventExperienceOverflow}
            onChange={v => set('preventExperienceOverflow', v)}
          />
          {save}
        </Card>
        <DropRatesCard rates={config.rates} onSave={onSaveRates} />
      </div>

      <div className="grid-2">
        <Card title="Drop">
          <div className="form-grid">
            <NumberField label="Segundos de los items en el piso" value={draft.itemDropDuration} min={5} max={3600} onChange={num('itemDropDuration', 60)} />
            <NumberField
              label="Opción máxima que sale en un drop"
              value={draft.maximumItemOptionLevelDrop}
              min={1}
              max={4}
              onChange={num('maximumItemOptionLevelDrop', 3)}
              hint={`Hasta +${draft.maximumItemOptionLevelDrop * 4}`}
            />
            <NumberField
              label="Niveles de diferencia para excelentes"
              value={draft.excellentItemDropLevelDelta}
              min={0}
              max={255}
              onChange={num('excellentItemDropLevelDelta', 25)}
              hint="Un excelente sale de bichos con este tanto de nivel más que el item"
            />
          </div>
          <Toggle label="Los bichos tiran zen" checked={draft.shouldDropMoney} onChange={v => set('shouldDropMoney', v)} />
          {save}
        </Card>

        <Card title="Personajes y cuentas">
          <div className="form-grid">
            <NumberField label="Personajes por cuenta" value={draft.maximumCharactersPerAccount} min={1} max={5} onChange={num('maximumCharactersPerAccount', 5)} />
            <NumberField label="Integrantes del party" value={draft.maximumPartySize} min={1} max={5} onChange={num('maximumPartySize', 5)} />
            <NumberField
              label="Zen máximo en el inventario"
              value={draft.maximumInventoryMoney}
              min={0}
              onChange={num('maximumInventoryMoney', 2_000_000_000)}
              hint={formatNumber(draft.maximumInventoryMoney)}
            />
            <NumberField
              label="Zen máximo en el baúl"
              value={draft.maximumVaultMoney}
              min={0}
              onChange={num('maximumVaultMoney', 2_000_000_000)}
              hint={formatNumber(draft.maximumVaultMoney)}
            />
            <NumberField label="Cartas guardadas" value={draft.maximumLetters} min={0} max={1000} onChange={num('maximumLetters', 50)} />
            <NumberField label="Precio de mandar una carta" value={draft.letterSendPrice} min={0} onChange={num('letterSendPrice', 1000)} />
          </div>
          {save}
        </Card>
      </div>

      <Card title="Combate y desgaste">
        <div className="form-grid">
          <NumberField
            label="Daño recibido por punto de durabilidad"
            value={draft.damagePerOneItemDurability}
            min={1}
            onChange={num('damagePerOneItemDurability', 2000)}
            hint="Más alto = la armadura se gasta más lento"
          />
          <NumberField
            label="Golpes por punto de durabilidad"
            value={draft.hitsPerOneItemDurability}
            min={1}
            onChange={num('hitsPerOneItemDurability', 10000)}
            hint="Más alto = las armas se gastan más lento"
          />
        </div>
        <Toggle label="PvP habilitado" checked={draft.pvpEnabled} onChange={v => set('pvpEnabled', v)} />
        <Toggle
          label="Los poderes de área pegan a otros jugadores"
          checked={draft.areaSkillHitsPlayer}
          onChange={v => set('areaSkillHitsPlayer', v)}
        />
        {save}
      </Card>
    </>
  );
}

function DropRatesCard({ rates, onSave }: { rates: Config['rates']; onSave: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(rates, r => r);
  const draft = current ?? rates;
  const dirty = JSON.stringify(draft) !== JSON.stringify(rates);
  const set = (k: keyof Config['rates']) => (v: number | null) => update(() => ({ ...draft, [k]: v ?? 100 }));
  return (
    <Card title="Rates de drop">
      <p className="muted small">En porcentaje: 100 es el drop como está configurado, 200 el doble. Se aplica en el juego al instante.</p>
      <div className="form-grid">
        <NumberField label="Items" value={draft.itemDropRate} min={0} max={100000} onChange={set('itemDropRate')} hint={`${draft.itemDropRate}%`} />
        <NumberField label="Excelentes y ancients" value={draft.excellentDropRate} min={0} max={100000} onChange={set('excellentDropRate')} hint={`${draft.excellentDropRate}%`} />
        <NumberField label="Zen" value={draft.zenDropRate} min={0} max={100000} onChange={set('zenDropRate')} hint={`${draft.zenDropRate}% de la cantidad`} />
      </div>
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
  RequiredMoneyStepFrom: number | null;
  RequiredMoneyStep: number;
  ResetStats: boolean;
  PointsPerReset: number;
  MultiplyPointsByResetCount: boolean;
  ReplacePointsPerReset: boolean;
  MoveHome: boolean;
  LogOut: boolean;
};

function ResetTab({ config, onSave, onSaveGrand }: { config: Config; onSave: (body: unknown) => void; onSaveGrand: (body: unknown) => void }) {
  type Draft = ResetConfig & { active: boolean };
  const initialOf = (r: Config['reset']) => ({ active: r.active, ...(r.config as Partial<ResetConfig>) }) as Draft;
  const initial = initialOf(config.reset);
  const [current, update, reset] = useDraft(config.reset, initialOf);
  const draft = current ?? initial;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => update(d => ({ ...d, [k]: v }));

  const example = (n: number) => {
    // As the server does (ResetProgressionCalculator): the step first, capped at what a character carries.
    const stepFrom = draft.RequiredMoneyStepFrom ?? 0;
    const money = stepFrom > 0
      ? Math.min(n <= stepFrom ? draft.RequiredMoney * n : draft.RequiredMoney * stepFrom + (draft.RequiredMoneyStep ?? 0) * (n - stepFrom), 2_147_483_647)
      : draft.MultiplyRequiredMoneyByResetCount
        ? draft.RequiredMoney * n
        : draft.RequiredMoney;
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
        <div className="form-grid">
          <NumberField
            label="Desde el reset"
            value={draft.RequiredMoneyStepFrom}
            min={0}
            onChange={v => set('RequiredMoneyStepFrom', v)}
            hint="Hasta este reset suma el zen requerido por reset; vacío = sin escalón"
          />
          <NumberField
            label="Zen extra por reset después"
            value={draft.RequiredMoneyStep}
            min={0}
            onChange={v => set('RequiredMoneyStep', v ?? 0)}
            hint={formatNumber(draft.RequiredMoneyStep)}
          />
        </div>
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
          <p>{example(2)}</p>
          <p>{example(10)}</p>
          <p>{example(11)}</p>
          <p>{example(12)}</p>
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
      <GrandResetCard grand={config.grandReset} onSave={onSaveGrand} />
    </div>
  );
}

function GrandResetCard({ grand, onSave }: { grand: Config['grandReset']; onSave: (body: unknown) => void }) {
  const [current, update, reset] = useDraft(grand, g => g);
  const draft = current ?? grand;
  const dirty = JSON.stringify(draft) !== JSON.stringify(grand);
  const set = <K extends keyof Config['grandReset']>(k: K, v: Config['grandReset'][K]) => update(() => ({ ...draft, [k]: v }));
  return (
    <Card title="Grand Reset" className="span-2">
      <p className="muted small">
        El NPC de Grand Reset (Lorencia, al lado de Leo) vuelve el personaje a nivel 1, sin resets y con los stats de su clase, y le da
        monedas para la <a href="#/tienda-gr">tienda Grand Reset</a>. Se aplica en el juego al instante.
      </p>
      <Toggle label="Grand Reset habilitado" checked={draft.active} onChange={v => set('active', v)} />
      <div className="form-grid">
        <NumberField label="Nivel requerido" value={draft.RequiredLevel} min={1} max={1000} onChange={v => set('RequiredLevel', v ?? 400)} />
        <NumberField label="Resets requeridos" value={draft.RequiredResets} min={0} onChange={v => set('RequiredResets', v ?? 0)} />
        <NumberField label="Zen requerido" value={draft.RequiredMoney} min={0} onChange={v => set('RequiredMoney', v ?? 0)} hint={formatNumber(draft.RequiredMoney)} />
        <NumberField label="Monedas por Grand Reset" value={draft.CoinsPerGrandReset} min={0} onChange={v => set('CoinsPerGrandReset', v ?? 0)} />
      </div>
      <SaveRow dirty={dirty} onSave={() => onSave(draft)} onReset={reset} />
    </Card>
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
        <p className="muted small">Los spots se editan en la pestaña Spots (mapa Arena); un deploy no los toca.</p>
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
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = config.plugins.filter(p => !query || `${p.name} ${p.description}`.toLowerCase().includes(query));
  const groups = [...new Set(shown.map(p => p.group))];
  return (
    <>
      <Card>
        <div className="toolbar">
          <input className="search" placeholder="Buscar comando… (ej. /move)" value={q} onChange={e => setQ(e.target.value)} />
          <span className="muted small">
            Se aplican en el juego al instante. {shown.filter(p => p.active).length} de {shown.length} activos.
          </span>
        </div>
      </Card>
      <div className="grid-2">
        {groups.map(group => (
          <Card key={group} title={group}>
            {shown
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
    </>
  );
}
