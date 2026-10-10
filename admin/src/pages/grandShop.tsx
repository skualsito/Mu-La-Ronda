import { useState } from 'react';
import { api, type GrandShopRow, type ItemDefinition } from '../api';
import { aliasName } from '../../server/itemAliases';
import { DefinitionIcon } from './inventory';
import { Badge, Card, Confirm, ErrorBox, Loading, NumberField, PageHeader, SelectField, Toggle, formatNumber, useLoad, useToast } from '../ui';

/**
 * Mu La Ronda: the grand reset shop. Its items are paid with grand reset coins only (the NPC
 * next to Leo in Lorencia gives them for each grand reset). The game reads the shop on every
 * purchase, so a change here counts at once.
 */

type Draft = {
  definition: ItemDefinition | null;
  level: number;
  skill: boolean;
  luck: boolean;
  optionLevel: number;
  excellent: number;
  price: number | null;
  sort: number;
  active: boolean;
};

const EMPTY: Draft = { definition: null, level: 0, skill: false, luck: false, optionLevel: 0, excellent: 0, price: 100, sort: 0, active: true };

const EXCELLENT_CHOICES = [
  { value: 0, label: 'No' },
  { value: 63, label: 'Full (las 6)' },
  { value: 7, label: '3 opciones' },
  { value: 1, label: '1 opción' },
];

function details(r: { level: number; skill: boolean; luck: boolean; optionLevel: number; excellent: number }) {
  const parts = [`+${r.level}`];
  if (r.skill) parts.push('skill');
  if (r.luck) parts.push('luck');
  if (r.optionLevel) parts.push(`opción +${r.optionLevel * 4}`);
  if (r.excellent) parts.push(r.excellent === 63 ? 'excelente full' : `excelente (${[1, 2, 4, 8, 16, 32].filter(b => r.excellent & b).length})`);
  return parts.join(' · ');
}

function ItemForm({ draft, onChange, fixedItem }: { draft: Draft; onChange: (d: Draft) => void; fixedItem?: string }) {
  const [query, setQuery] = useState('');
  const results = useLoad(
    () => (fixedItem || query.trim().length < 2 ? Promise.resolve([] as ItemDefinition[]) : api<ItemDefinition[]>(`/item-definitions?q=${encodeURIComponent(query)}`)),
    [query, fixedItem]
  );
  return (
    <>
      {fixedItem ? (
        <p>
          <strong>{fixedItem}</strong>
        </p>
      ) : (
        <>
          <input
            className="search"
            placeholder="Buscar item… (ej. Box of Kundun, Dragon, Wings, Jewel)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {draft.definition && (
            <div className="def-row active">
              <DefinitionIcon group={draft.definition.group} number={draft.definition.number} level={draft.level} className="def-icon" />
              <span className="def-name">{aliasName(draft.definition.group, draft.definition.number, draft.level) ?? draft.definition.name}</span>
              <span className="muted small">elegido</span>
            </div>
          )}
          {!!results.data?.length && (
            <div className="def-results">
              {results.data.map(d => (
                <button
                  key={`${d.id}-${d.presetLevel ?? ''}`}
                  className="def-row"
                  onClick={() => {
                    onChange({ ...draft, definition: d, level: d.presetLevel ?? Math.min(draft.level, d.maxLevel || 15) });
                    setQuery('');
                  }}
                >
                  <DefinitionIcon group={d.group} number={d.number} level={d.presetLevel} className="def-icon" />
                  <span className="def-name">{d.name}</span>
                  <span className="muted small">
                    grupo {d.group} · #{d.number}
                    {d.presetLevel !== undefined ? ` · +${d.presetLevel}` : ''} · {d.width}×{d.height}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className="form-grid">
        <NumberField label="Precio (monedas)" value={draft.price} min={1} onChange={v => onChange({ ...draft, price: v })} />
        <NumberField label="Nivel" value={draft.level} min={0} max={15} onChange={v => onChange({ ...draft, level: v ?? 0 })} />
        <NumberField label="Opción (+4 por nivel)" value={draft.optionLevel} min={0} max={7} hint={`+${draft.optionLevel * 4}`} onChange={v => onChange({ ...draft, optionLevel: v ?? 0 })} />
        <SelectField label="Excelente" value={draft.excellent} options={EXCELLENT_CHOICES} onChange={v => onChange({ ...draft, excellent: v })} />
        <NumberField label="Orden" value={draft.sort} hint="Menor = más arriba" onChange={v => onChange({ ...draft, sort: v ?? 0 })} />
      </div>
      <Toggle label="Skill" checked={draft.skill} onChange={v => onChange({ ...draft, skill: v })} />
      <Toggle label="Luck" checked={draft.luck} onChange={v => onChange({ ...draft, luck: v })} />
      <Toggle label="A la venta" checked={draft.active} onChange={v => onChange({ ...draft, active: v })} />
    </>
  );
}

const bodyOf = (d: Draft) => ({
  definitionId: d.definition?.id,
  level: d.level,
  skill: d.skill,
  luck: d.luck,
  optionLevel: d.optionLevel,
  excellent: d.excellent,
  price: d.price,
  sort: d.sort,
  active: d.active,
});

export function GrandShopPage() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<GrandShopRow[]>('/grand-shop'), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<{ row: GrandShopRow; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<GrandShopRow | null>(null);

  const run = async (call: Promise<GrandShopRow[]>, done: string) => {
    try {
      setData(await call);
      toast(done);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
      return false;
    }
  };

  return (
    <>
      <PageHeader title="Tienda Grand Reset" subtitle="Se paga solo con monedas de Grand Reset. Los cambios se ven en el juego al instante." />
      <Card title="Agregar item">
        <ItemForm draft={draft} onChange={setDraft} />
        <div className="row-actions">
          <button
            className="btn btn-primary"
            disabled={!draft.definition || !draft.price}
            onClick={async () => {
              if (await run(api('/grand-shop', { method: 'POST', body: bodyOf(draft) }), 'Item agregado')) setDraft(EMPTY);
            }}
          >
            Agregar
          </button>
        </div>
      </Card>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <Card title={`Items (${data.length})`}>
          {data.length === 0 ? (
            <p className="muted">La tienda todavía no tiene items.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DefinitionIcon group={row.group} number={row.number} level={row.level} excellent={row.excellent > 0} className="def-icon" />
                        <span>
                          <strong>{aliasName(row.group, row.number, row.level) ?? row.name}</strong>
                          <div className="muted small">{details(row)}</div>
                        </span>
                      </div>
                    </td>
                    <td>{formatNumber(row.price)} monedas</td>
                    <td>
                      <Badge tone={row.active ? 'ok' : 'neutral'}>{row.active ? 'a la venta' : 'oculto'}</Badge>
                    </td>
                    <td className="row-actions">
                      <button
                        className="btn btn-small"
                        onClick={() =>
                          setEditing({
                            row,
                            draft: { ...EMPTY, ...row, definition: null, price: row.price },
                          })
                        }
                      >
                        Editar
                      </button>
                      <button className="btn btn-ghost btn-small" onClick={() => setDeleting(row)}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <div className="modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <h2>Editar item</h2>
            <ItemForm draft={editing.draft} fixedItem={aliasName(editing.row.group, editing.row.number, editing.row.level) ?? editing.row.name} onChange={d => setEditing({ ...editing, draft: d })} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (await run(api(`/grand-shop/${editing.row.id}`, { method: 'PATCH', body: bodyOf(editing.draft) }), 'Guardado')) setEditing(null);
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <Confirm
          title="Borrar item"
          text={`¿Sacar ${deleting.name} de la tienda?`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            const row = deleting;
            setDeleting(null);
            if (yes) void run(api(`/grand-shop/${row.id}`, { method: 'DELETE' }), 'Item borrado');
          }}
        />
      )}
    </>
  );
}
