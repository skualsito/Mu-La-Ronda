import { useMemo, useState } from 'react';
import { api, type DropGroup, type DropList, type ItemDefinition, type MapRow, type Monster } from '../api';
import { Badge, Card, ComboField, Confirm, ErrorBox, Loading, NumberField, PageHeader, SelectField, TextField, useLoad, useToast } from '../ui';
import { DefinitionIcon } from './inventory';

/**
 * Drops: what the monsters leave. Each group drops with its chance on every
 * kill of the monsters it reaches - all of the maps it is on, or only the one
 * monster it is tied to - and gives one of its items (or, without items, a
 * random one of its kind). What is saved here stays: the deploys write it
 * back last (server/drops.ts, deploy/config/99-admin-drops.sql).
 */

type Filter = 'all' | 'maps' | 'monster' | 'other' | 'edited';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'maps', label: 'En mapas' },
  { value: 'monster', label: 'De un monstruo' },
  { value: 'other', label: 'Eventos y quests' },
  { value: 'edited', label: 'Editados acá' },
];

type Draft = {
  description: string;
  /** In percent, as typed. */
  chance: string;
  itemType: number;
  itemLevel: number | null;
  minMonsterLevel: number | null;
  maxMonsterLevel: number | null;
  monsterId: string | null;
  mapIds: string[];
  items: { id: string; group: number; number: number; name: string }[];
};

const percent = (chance: number) => {
  const p = chance * 100;
  return `${Number(p.toPrecision(4))} %`;
};

const draftOf = (g: DropGroup): Draft => ({
  description: g.description,
  chance: String(Number((g.chance * 100).toPrecision(6))),
  itemType: g.itemType,
  itemLevel: g.itemLevel,
  minMonsterLevel: g.minMonsterLevel,
  maxMonsterLevel: g.maxMonsterLevel,
  monsterId: g.monsterId,
  mapIds: g.mapIds,
  items: g.items,
});

const EMPTY: Draft = {
  description: '',
  chance: '1',
  itemType: 0,
  itemLevel: null,
  minMonsterLevel: null,
  maxMonsterLevel: null,
  monsterId: null,
  mapIds: [],
  items: [],
};

function whereLabel(g: DropGroup, maps: number) {
  if (g.monsterId && g.monsterName) return `solo ${g.monsterName}`;
  if (g.mapIds.length) return g.mapIds.length >= maps ? 'todos los mapas' : `${g.mapIds.length} mapa${g.mapIds.length === 1 ? '' : 's'}`;
  return g.inUse ?? 'sin ubicar';
}

export function DropsPage({ group }: { group?: string }) {
  const toast = useToast();
  const list = useLoad(() => api<DropList>('/drops'), []);
  const maps = useLoad(() => api<MapRow[]>('/maps'), []);
  const monsters = useLoad(() => api<Monster[]>('/monsters'), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [mapFilter, setMapFilter] = useState<string | null>(null);

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data || !maps.data) return <Loading />;

  const mapCount = maps.data.length;
  const isNew = group === 'nuevo';
  const selected = list.data.groups.find(g => g.id === group) ?? null;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = list.data.groups.filter(g => {
    if (filter === 'maps' && !(g.mapIds.length && !g.monsterId)) return false;
    if (filter === 'monster' && !g.monsterId) return false;
    if (filter === 'other' && (g.mapIds.length || g.monsterId)) return false;
    if (filter === 'edited' && !g.edited) return false;
    if (mapFilter && !g.mapIds.includes(mapFilter)) return false;
    const text = `${g.description} ${g.monsterName ?? ''} ${g.items.map(i => i.name).join(' ')}`.toLowerCase();
    return words.every(w => text.includes(w));
  });

  return (
    <>
      <PageHeader
        title="Drops"
        subtitle="Qué tiran los monstruos y con qué chance. Lo que guardes acá queda fijo: los deploys ya no lo cambian. Entra en el juego al reiniciar OpenMU (Servidor → Reiniciar)."
        actions={
          <a className="btn btn-primary" href="#/drops/nuevo">
            + Nuevo drop
          </a>
        }
      />
      <div className="shops-layout">
        <Card title={`Grupos (${shown.length} de ${list.data.groups.length})`} className="shops-list">
          <input className="search" placeholder="Buscar drop, ítem o monstruo…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="drop-filters">
            <select value={filter} onChange={e => setFilter(e.target.value as Filter)}>
              {FILTERS.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <ComboField
              label=""
              value={mapFilter}
              options={maps.data.map(m => ({ value: m.id, label: `${m.number} · ${m.name}` }))}
              onChange={setMapFilter}
              emptyLabel="Cualquier mapa"
              placeholder="Filtrar por mapa…"
            />
          </div>
          <div className="shop-rows">
            {shown.map(g => (
              <a key={g.id} href={`#/drops/${g.id}`} className={`shop-row ${g.id === group ? 'active' : ''}`}>
                <span className="shop-name">
                  {g.description} {g.edited && <Badge tone="accent">fijo</Badge>}
                </span>
                <span className="muted small">
                  {percent(g.chance)} · {whereLabel(g, mapCount)}
                  {g.items.length ? ` · ${g.items.length} ítem${g.items.length === 1 ? '' : 's'}` : ''}
                </span>
              </a>
            ))}
            {!shown.length && <p className="muted">Nada con ese filtro.</p>}
          </div>
        </Card>

        {isNew || selected ? (
          <DropEditor
            key={group}
            group={selected}
            types={list.data.types}
            maps={maps.data}
            monsters={monsters.data ?? []}
            onSaved={(next, id) => {
              list.setData(next);
              if (id) location.hash = `#/drops/${id}`;
            }}
            onDeleted={next => {
              list.setData(next);
              location.hash = '#/drops';
              toast('Drop borrado');
            }}
          />
        ) : (
          <Card>
            <p className="muted">Elegí un grupo de la lista para ver y cambiar qué tira, dónde y con qué chance.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function DropEditor({
  group,
  types,
  maps,
  monsters,
  onSaved,
  onDeleted,
}: {
  group: DropGroup | null;
  types: { value: number; label: string }[];
  maps: MapRow[];
  monsters: Monster[];
  onSaved: (list: DropList, id?: string) => void;
  onDeleted: (list: DropList) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => (group ? draftOf(group) : EMPTY));
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'delete' | 'release' | null>(null);
  const [mapQuery, setMapQuery] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const results = useLoad(
    () => (itemQuery.trim().length < 2 ? Promise.resolve([] as ItemDefinition[]) : api<ItemDefinition[]>(`/item-definitions?q=${encodeURIComponent(itemQuery)}`)),
    [itemQuery]
  );


  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }));
  const chance = Number(draft.chance.replace(',', '.'));
  const chanceOk = draft.chance.trim() !== '' && Number.isFinite(chance) && chance >= 0 && chance <= 100;
  const mapSet = useMemo(() => new Set(draft.mapIds), [draft.mapIds]);
  const shownMaps = maps.filter(m => `${m.number} ${m.name}`.toLowerCase().includes(mapQuery.toLowerCase()));
  const needsItems = draft.itemType === 0 || draft.itemType === 6;

  const save = async () => {
    if (!chanceOk) return;
    setBusy(true);
    try {
      const body = {
        description: draft.description,
        chance: chance / 100,
        itemType: draft.itemType,
        itemLevel: draft.itemLevel,
        minMonsterLevel: draft.minMonsterLevel,
        maxMonsterLevel: draft.maxMonsterLevel,
        monsterId: draft.monsterId,
        mapIds: draft.mapIds,
        itemIds: draft.items.map(i => i.id),
      };
      if (group) {
        onSaved(await api<DropList>(`/drops/${group.id}`, { method: 'PATCH', body }));
        toast('Drop guardado. Entra en el juego al reiniciar OpenMU.');
      } else {
        const created = await api<DropList & { id: string }>('/drops', { method: 'POST', body });
        onSaved(created, created.id);
        toast('Drop creado. Entra en el juego al reiniciar OpenMU.');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group) return;
    setBusy(true);
    try {
      onDeleted(await api<DropList>(`/drops/${group.id}`, { method: 'DELETE' }));
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const release = async () => {
    if (!group) return;
    setBusy(true);
    try {
      onSaved(await api<DropList>(`/drops/${group.id}/release`, { method: 'POST' }));
      toast('Listo: el próximo deploy puede volver a cambiar este drop.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Card
      className="drop-editor"
      title={group ? group.description : 'Nuevo drop'}
      actions={group?.edited ? <Badge tone="accent">fijo: los deploys no lo tocan</Badge> : undefined}
    >
      {group?.inUse && (
        <div className="notice notice-info">Lo usa {group.inUse}: se puede cambiar, pero no borrar.</div>
      )}

      <div className="form-grid">
        <TextField label="Nombre" value={draft.description} onChange={v => set('description', v)} placeholder="Ej. Joyas en Kalima" />
        <label className="field">
          <span className="field-label">Chance por kill (%)</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            max={100}
            value={draft.chance}
            onChange={e => set('chance', e.target.value)}
            className={chanceOk ? '' : 'invalid'}
          />
          <span className="field-hint">{chanceOk ? `1 cada ${chance > 0 ? Math.round(100 / chance).toLocaleString('es-AR') : '∞'} kills` : 'de 0 a 100'}</span>
        </label>
        <SelectField label="Qué tira" value={draft.itemType} options={types} onChange={v => set('itemType', v)} />
        <NumberField label="Nivel del ítem (+)" value={draft.itemLevel} min={0} max={15} onChange={v => set('itemLevel', v)} hint="vacío: el que toque" />
        <NumberField label="Nivel mínimo del monstruo" value={draft.minMonsterLevel} min={0} max={255} onChange={v => set('minMonsterLevel', v)} hint="vacío: sin mínimo" />
        <NumberField label="Nivel máximo del monstruo" value={draft.maxMonsterLevel} min={0} max={255} onChange={v => set('maxMonsterLevel', v)} hint="vacío: sin máximo" />
      </div>

      <ComboField
        label="Monstruo"
        value={draft.monsterId}
        options={monsters.map(m => ({ value: m.id, label: `${m.number} · ${m.name}` }))}
        onChange={v => set('monsterId', v)}
        emptyLabel="Ninguno: cae de los monstruos de los mapas elegidos"
        placeholder="Ninguno: cae de los monstruos de los mapas elegidos"
        hint="Si elegís uno, lo tira solo ese monstruo (en cualquier mapa)."
      />

      <div className="field">
        <span className="field-label">
          Mapas ({draft.mapIds.length} de {maps.length})
        </span>
        <div className="drop-maps-tools">
          <input className="search-small" placeholder="Buscar mapa…" value={mapQuery} onChange={e => setMapQuery(e.target.value)} />
          <button type="button" className="btn btn-small" onClick={() => set('mapIds', maps.map(m => m.id))}>
            Todos
          </button>
          <button type="button" className="btn btn-small" onClick={() => set('mapIds', [])}>
            Ninguno
          </button>
        </div>
        {draft.mapIds.length > 0 && draft.mapIds.length < maps.length && (
          <div className="drop-chosen">
            {maps
              .filter(m => mapSet.has(m.id))
              .map(m => (
                <button
                  type="button"
                  key={m.id}
                  className="chip"
                  title="Sacar este mapa"
                  onClick={() => set('mapIds', draft.mapIds.filter(id => id !== m.id))}
                >
                  {m.name} ×
                </button>
              ))}
          </div>
        )}
        <div className="drop-maps">
          {shownMaps.map(m => (
            <label key={m.id} className="drop-map">
              <input
                type="checkbox"
                checked={mapSet.has(m.id)}
                onChange={e => set('mapIds', e.target.checked ? [...draft.mapIds, m.id] : draft.mapIds.filter(id => id !== m.id))}
              />
              <span>
                {m.number} · {m.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Ítems ({draft.items.length})</span>
        {!needsItems && <span className="field-hint">Con este tipo, sin ítems tira uno al azar de su clase; con ítems, uno de la lista.</span>}
        <div className="drop-items">
          {draft.items.map(item => (
            <div key={item.id} className="drop-item">
              <DefinitionIcon group={item.group} number={item.number} className="def-icon" />
              <span className="def-name">{item.name}</span>
              <span className="muted small">
                {item.group},{item.number}
              </span>
              <button type="button" className="btn btn-small btn-danger" onClick={() => set('items', draft.items.filter(i => i.id !== item.id))}>
                Quitar
              </button>
            </div>
          ))}
          {!draft.items.length && <p className="muted small">Sin ítems.</p>}
        </div>
        <input className="search" placeholder="Agregar ítem… (ej. Jewel of Bless, Moonstone)" value={itemQuery} onChange={e => setItemQuery(e.target.value)} />
        {(results.data ?? []).length > 0 && (
          <div className="def-results">
            {(results.data ?? []).map(d => {
              const already = draft.items.some(i => i.id === d.id);
              return (
                <button
                  type="button"
                  key={d.id}
                  className="def-row"
                  disabled={already}
                  onClick={() => set('items', [...draft.items, { id: d.id, group: d.group, number: d.number, name: d.name }])}
                >
                  <DefinitionIcon group={d.group} number={d.number} className="def-icon" />
                  <span className="def-name">{d.name}</span>
                  <span className="muted small">{already ? 'ya está' : `${d.group},${d.number}`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="row-actions">
        <button className="btn btn-primary" disabled={busy || !chanceOk || !draft.description.trim()} onClick={save}>
          {group ? 'Guardar' : 'Crear drop'}
        </button>
        {group?.edited && (
          <button className="btn" disabled={busy} onClick={() => setConfirm('release')}>
            Dejar de fijar
          </button>
        )}
        {group && (
          <button className="btn btn-danger" disabled={busy || !!group.inUse} title={group.inUse ? `Lo usa ${group.inUse}` : undefined} onClick={() => setConfirm('delete')}>
            Borrar
          </button>
        )}
      </div>

      {confirm === 'delete' && (
        <Confirm
          title="Borrar drop"
          text={`Se borra "${group?.description}". Los deploys no lo vuelven a crear.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => (yes ? void remove() : setConfirm(null))}
        />
      )}
      {confirm === 'release' && (
        <Confirm
          title="Dejar de fijar"
          text="El drop queda como está, pero el próximo deploy que lo configure puede volver a cambiarlo."
          confirmLabel="Dejar de fijar"
          onAnswer={yes => (yes ? void release() : setConfirm(null))}
        />
      )}
    </Card>
  );
}
