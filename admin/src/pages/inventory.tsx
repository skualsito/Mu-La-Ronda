import { useEffect, useState } from 'react';
import { api, type DefinitionOption, type InventoryItem, type ItemDefinition } from '../api';
import { Card, Confirm, ErrorBox, Loading, NumberField, Toggle, useLoad, useToast } from '../ui';
import { MuGrid } from '../muGrid';

/** A character's inventory: the equipped slots, the 8x8 bag and an item editor. */

const BAG_FIRST = 12;
const COLUMNS = 8;
const ROWS = 8;
const CELL = 44;

const EQUIPMENT = ['Mano izq.', 'Mano der.', 'Casco', 'Armadura', 'Pantalones', 'Guantes', 'Botas', 'Alas', 'Pet', 'Collar', 'Anillo', 'Anillo'];

const OPTION_LABEL: Record<string, string> = {
  luck: 'Suerte',
  option: 'Opción',
  excellent: 'Excelente',
  wing: 'Alas',
  harmony: 'Harmony',
  ancient: 'Ancient',
  guardian: 'Guardian (380)',
  fenrir: 'Fenrir',
  other: 'Otras',
};

type Chosen = Record<string, number>; // optionId -> level (0 for on/off options)

function itemTitle(item: { name: string; level: number }, chosen?: { type: string }[]) {
  const exc = chosen?.some(o => o.type === 'excellent');
  return `${exc ? 'Excelente ' : ''}${item.name}${item.level ? ` +${item.level}` : ''}`;
}

export function InventoryCard({ characterId, locked }: { characterId: string; locked: boolean }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<InventoryItem[]>(`/characters/${characterId}/inventory`), [characterId]);
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const equipped = data.filter(i => i.slot < BAG_FIRST);
  const bag = data.filter(i => i.slot >= BAG_FIRST && i.slot < BAG_FIRST + COLUMNS * ROWS);
  const others = data.filter(i => i.slot >= BAG_FIRST + COLUMNS * ROWS);

  const run = async (call: Promise<InventoryItem[]>, done: string) => {
    try {
      setData(await call);
      setEditing(null);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <Card
      title={`Inventario (${data.length} items)`}
      actions={
        <button className="btn btn-small" disabled={locked} onClick={() => setEditing('new')}>
          + Agregar item
        </button>
      }
    >
      <div className="inventory">
        <div>
          <h3 className="subhead">Equipado</h3>
          <div className="equipment">
            {EQUIPMENT.map((label, slot) => {
              const item = equipped.find(i => i.slot === slot);
              return (
                <button key={slot} className={`equip-slot ${item ? 'filled' : ''}`} disabled={!item} onClick={() => item && setEditing(item)}>
                  <span className="equip-label">{label}</span>
                  <span className="equip-item">{item ? itemTitle(item, item.options) : '—'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <h3 className="subhead">Bolsa</h3>
          <MuGrid
            items={bag}
            first={BAG_FIRST}
            columns={COLUMNS}
            rows={ROWS}
            cell={CELL}
            disabled={locked}
            selectedId={editing && editing !== 'new' ? editing.id : null}
            onSelect={item => setEditing(item)}
            onMove={(item, slot) =>
              run(api(`/characters/${characterId}/items/${item.id}`, { method: 'PATCH', body: { slot } }), `${item.name} movido`)
            }
          />
          {others.length > 0 && (
            <p className="muted small">
              + {others.length} items en otros espacios (tienda personal / extensiones):{' '}
              {others.map(i => itemTitle(i)).join(', ')}
            </p>
          )}
        </div>
      </div>

      {editing && (
        <ItemEditor
          item={editing === 'new' ? null : editing}
          locked={locked}
          onClose={() => setEditing(null)}
          onSave={(body, item) =>
            run(
              item
                ? api(`/characters/${characterId}/items/${item.id}`, { method: 'PATCH', body })
                : api(`/characters/${characterId}/inventory`, { method: 'POST', body }),
              item ? 'Item guardado' : 'Item agregado'
            )
          }
          onDelete={item => run(api(`/characters/${characterId}/items/${item.id}`, { method: 'DELETE' }), 'Item borrado')}
        />
      )}
    </Card>
  );
}

export function ItemEditor({
  item,
  locked,
  onClose,
  onSave,
  onDelete,
  saveLabel,
  deleteLabel = 'Borrar item',
}: {
  item: InventoryItem | null;
  locked: boolean;
  onClose: () => void;
  onSave: (body: unknown, item: InventoryItem | null) => void;
  onDelete: (item: InventoryItem) => void;
  saveLabel?: string;
  deleteLabel?: string;
}) {
  const [query, setQuery] = useState('');
  const [definition, setDefinition] = useState<ItemDefinition | null>(
    item
      ? { id: item.definitionId, name: item.name, group: item.group, number: item.number, width: item.width, height: item.height, durability: item.maxDurability, maxLevel: item.maxLevel, canSkill: item.canSkill }
      : null
  );
  const [level, setLevel] = useState(item?.level ?? 0);
  const [durability, setDurability] = useState<number | null>(item ? Math.round(item.durability) : null);
  const [hasSkill, setHasSkill] = useState(item?.hasSkill ?? false);
  const [chosen, setChosen] = useState<Chosen>(() => Object.fromEntries((item?.options ?? []).map(o => [o.optionId, o.level])));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const results = useLoad(
    () => (item ? Promise.resolve([] as ItemDefinition[]) : api<ItemDefinition[]>(`/item-definitions?q=${encodeURIComponent(query)}`)),
    [query, item]
  );
  // Tagged with the definition it belongs to, so a slow answer for the last
  // item never shows as this one's options.
  const loaded = useLoad(
    () =>
      definition
        ? api<DefinitionOption[]>(`/item-definitions/${definition.id}/options`).then(list => ({ id: definition.id, list }))
        : Promise.resolve(null),
    [definition?.id]
  );
  const options = { data: loaded.data && loaded.data.id === definition?.id ? loaded.data.list : null };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = new Map<string, DefinitionOption[]>();
  for (const o of options.data ?? []) groups.set(o.type, [...(groups.get(o.type) ?? []), o]);

  const toggle = (o: DefinitionOption, on: boolean, single: boolean) => {
    setChosen(c => {
      const next = { ...c };
      if (single) for (const other of groups.get(o.type) ?? []) delete next[other.optionId];
      if (on) next[o.optionId] = o.type === 'option' ? (c[o.optionId] || 1) : 0;
      else delete next[o.optionId];
      return next;
    });
  };

  const submit = () => {
    if (!definition) return;
    onSave(
      {
        definitionId: definition.id,
        level,
        hasSkill,
        ...(durability !== null ? { durability } : {}),
        options: Object.entries(chosen).map(([optionId, lvl]) => ({ optionId, level: lvl })),
      },
      item
    );
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <h2>{item ? itemTitle(item, item.options) : 'Agregar item'}</h2>

        {!item && (
          <>
            <input className="search" placeholder="Buscar item… (ej. Jewel of Bless, Dragon, Wings)" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
            <div className="def-results">
              {(results.data ?? []).map(d => (
                <button key={d.id} className={`def-row ${definition?.id === d.id ? 'active' : ''}`} onClick={() => { setDefinition(d); setChosen({}); setLevel(0); setDurability(null); }}>
                  <span>{d.name}</span>
                  <span className="muted small">
                    grupo {d.group} · #{d.number} · {d.width}×{d.height}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {definition && (
          <>
            <div className="form-grid">
              <NumberField label="Nivel (+)" value={level} min={0} max={definition.maxLevel || 15} onChange={v => setLevel(v ?? 0)} />
              <NumberField label="Durabilidad" value={durability} min={0} max={255} onChange={setDurability} hint={`máx. ${definition.durability}`} />
            </div>
            {definition.canSkill && <Toggle label="Con skill" checked={hasSkill} onChange={setHasSkill} />}

            {options.data && !options.data.length && <p className="muted small">Este item no admite opciones.</p>}
            {[...groups.entries()].map(([type, list]) => {
              const single = type !== 'excellent' && type !== 'wing' && type !== 'ancient';
              return (
                <div key={type} className="option-group">
                  <h3 className="subhead">{OPTION_LABEL[type] ?? type}</h3>
                  {list.map(o => (
                    <div key={o.optionId} className="option-row">
                      <label className="check">
                        <input type="checkbox" checked={o.optionId in chosen} onChange={e => toggle(o, e.target.checked, single)} />
                        <span>{o.name}</span>
                      </label>
                      {type === 'option' && o.optionId in chosen && (
                        <select value={chosen[o.optionId]} onChange={e => setChosen({ ...chosen, [o.optionId]: Number(e.target.value) })}>
                          {[1, 2, 3, 4, 5, 6, 7].map(n => (
                            <option key={n} value={n}>
                              +{n * 4}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        <div className="modal-actions">
          {item && (
            <button className="btn btn-danger" disabled={locked} onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
              {deleteLabel}
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={locked || !definition} onClick={submit}>
            {saveLabel ?? (item ? 'Guardar' : 'Agregar a la bolsa')}
          </button>
        </div>
        {locked && <p className="muted small">El personaje está conectado: no se puede tocar su inventario.</p>}
      </div>

      {confirmDelete && item && (
        <Confirm
          title="Borrar item"
          text={`Se borra ${itemTitle(item, item.options)} del inventario. No se puede deshacer.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            setConfirmDelete(false);
            if (yes) onDelete(item);
          }}
        />
      )}
    </div>
  );
}
