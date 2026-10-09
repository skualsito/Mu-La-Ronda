import { useState } from 'react';
import { api, type MonsterDetail, type MonsterList } from '../api';
import { Badge, Card, ComboField, Confirm, ErrorBox, Loading, NumberField, PageHeader, TextField, formatNumber, useLoad, useToast } from '../ui';

/**
 * Monsters: each monster's stats (level, life, damage, defence, rates,
 * resistances) and timings (respawn, attack and move delays, ranges). What
 * is saved here stays: the deploys write it back last
 * (server/monsters.ts, deploy/config/99-admin-monsters.sql).
 */

type Kind = 'monsters' | 'npcs' | 'all';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'monsters', label: 'Monstruos' },
  { value: 'npcs', label: 'NPCs y trampas' },
  { value: 'all', label: 'Todos' },
];

export function MonstersPage({ monster }: { monster?: string }) {
  const list = useLoad(() => api<MonsterList>('/monster-stats'), []);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('monsters');
  const [editedOnly, setEditedOnly] = useState(false);

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = list.data.monsters.filter(m => {
    if (kind === 'monsters' && m.kind !== 0) return false;
    if (kind === 'npcs' && m.kind === 0) return false;
    if (editedOnly && !m.edited) return false;
    const text = `${m.number} ${m.name}`.toLowerCase();
    return words.every(w => text.includes(w));
  });

  return (
    <>
      <PageHeader
        title="Monstruos"
        subtitle="Vida, daño, defensa y tiempos de cada monstruo. Lo que guardes acá queda fijo: los deploys ya no lo cambian. Entra en el juego al reiniciar OpenMU (Servidor → Reiniciar)."
      />
      <div className="shops-layout">
        <Card title={`Monstruos (${shown.length})`} className="shops-list">
          <input className="search" placeholder="Buscar por nombre o número…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="drop-filters">
            <select value={kind} onChange={e => setKind(e.target.value as Kind)}>
              {KINDS.map(k => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <label className="drop-map">
              <input type="checkbox" checked={editedOnly} onChange={e => setEditedOnly(e.target.checked)} />
              <span>Solo editados</span>
            </label>
          </div>
          <div className="shop-rows">
            {shown.map(m => (
              <a key={m.id} href={`#/monstruos/${m.id}`} className={`shop-row ${m.id === monster ? 'active' : ''}`}>
                <span className="shop-name">
                  {m.name} <span className="muted small">#{m.number}</span> {m.edited && <Badge tone="accent">fijo</Badge>}
                </span>
                <span className="muted small">
                  {m.level != null ? `nivel ${m.level}` : 'sin nivel'}
                  {m.health != null ? ` · ${formatNumber(m.health)} de vida` : ''}
                  {m.minDamage != null ? ` · daño ${formatNumber(m.minDamage)}-${formatNumber(m.maxDamage)}` : ''}
                  {m.spots ? ` · ${m.spots} spot${m.spots === 1 ? '' : 's'}` : ''}
                </span>
              </a>
            ))}
            {!shown.length && <p className="muted">Nada con ese filtro.</p>}
          </div>
        </Card>

        {monster ? (
          <MonsterEditor key={monster} id={monster} list={list.data} onSaved={list.reload} />
        ) : (
          <Card>
            <p className="muted">Elegí un monstruo de la lista para ver y cambiar sus stats.</p>
          </Card>
        )}
      </div>
    </>
  );
}

type Draft = {
  name: string;
  respawnSeconds: number | null;
  attackDelayMs: number | null;
  moveDelayMs: number | null;
  moveRange: number | null;
  attackRange: number | null;
  viewRange: number | null;
  maxDrops: number | null;
  /** attributeId -> value, as typed. */
  attributes: Record<string, string>;
};

const draftOf = (m: MonsterDetail): Draft => ({
  name: m.name,
  respawnSeconds: Math.round(m.respawnSeconds),
  attackDelayMs: m.attackDelayMs,
  moveDelayMs: m.moveDelayMs,
  moveRange: m.moveRange,
  attackRange: m.attackRange,
  viewRange: m.viewRange,
  maxDrops: m.maxDrops,
  attributes: Object.fromEntries(m.attributes.map(a => [a.attributeId, String(Number(a.value.toPrecision(8)))])),
});

function MonsterEditor({ id, list, onSaved }: { id: string; list: MonsterList; onSaved: () => void }) {
  const toast = useToast();
  const detail = useLoad(() => api<MonsterDetail>(`/monster-stats/${id}`), [id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState(false);

  if (detail.error) return <ErrorBox error={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <Loading />;
  const m = detail.data;
  const d = draft ?? draftOf(m);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft({ ...d, [key]: value });
  const setAttr = (attributeId: string, value: string) => setDraft({ ...d, attributes: { ...d.attributes, [attributeId]: value } });

  const designationOf = new Map(list.attributes.map(a => [a.id, a.designation]));
  for (const a of m.attributes) designationOf.set(a.attributeId, a.designation);
  const labelOf = new Map(list.main.map(x => [x.designation, x]));
  const present = Object.keys(d.attributes);
  const main = list.main
    .map(x => present.find(id => designationOf.get(id) === x.designation))
    .filter((x): x is string => !!x);
  const others = present.filter(id => !main.includes(id)).sort((a, b) => (designationOf.get(a) ?? '').localeCompare(designationOf.get(b) ?? ''));
  const missing = list.attributes.filter(a => !present.includes(a.id));

  const badValue = Object.values(d.attributes).some(v => v.trim() === '' || !Number.isFinite(Number(v.replace(',', '.'))));

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        name: d.name,
        respawnSeconds: d.respawnSeconds,
        attackDelayMs: d.attackDelayMs,
        moveDelayMs: d.moveDelayMs,
        moveRange: d.moveRange,
        attackRange: d.attackRange,
        viewRange: d.viewRange,
        maxDrops: d.maxDrops,
        attributes: Object.fromEntries(Object.entries(d.attributes).map(([k, v]) => [k, Number(v.replace(',', '.'))])),
      };
      detail.setData(await api<MonsterDetail>(`/monster-stats/${id}`, { method: 'PATCH', body }));
      setDraft(null);
      onSaved();
      toast('Guardado. Entra en el juego al reiniciar OpenMU.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    setBusy(true);
    try {
      detail.setData(await api<MonsterDetail>(`/monster-stats/${id}/release`, { method: 'POST' }));
      onSaved();
      toast('Listo: el próximo deploy puede volver a cambiar este monstruo.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
      setConfirmRelease(false);
    }
  };

  const attrField = (attributeId: string) => {
    const designation = designationOf.get(attributeId) ?? attributeId;
    const known = labelOf.get(designation);
    return (
      <label key={attributeId} className="field">
        <span className="field-label" title={designation}>
          {known?.label ?? designation}
        </span>
        <input type="number" step="any" value={d.attributes[attributeId]} onChange={e => setAttr(attributeId, e.target.value)} />
        {known?.hint && <span className="field-hint">{known.hint}</span>}
      </label>
    );
  };

  return (
    <Card
      className="drop-editor"
      title={`${m.name} #${m.number}`}
      actions={m.edited ? <Badge tone="accent">fijo: los deploys no lo tocan</Badge> : undefined}
    >
      <p className="muted small">
        {m.spots ? `Aparece en: ${m.maps.join(', ')} (${m.spots} spot${m.spots === 1 ? '' : 's'}).` : 'No tiene spots: aparece por un evento o no aparece.'}
      </p>

      <div className="form-grid">
        <TextField label="Nombre" value={d.name} onChange={v => set('name', v)} />
      </div>

      <div className="field">
        <span className="field-label">Stats</span>
        <div className="form-grid">{main.map(attrField)}</div>
      </div>

      {others.length > 0 && (
        <div className="field">
          <span className="field-label">Otros atributos</span>
          <div className="form-grid">{others.map(attrField)}</div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="monster-add">
          <ComboField
            label="Agregar un atributo"
            value={adding}
            options={missing.map(a => ({ value: a.id, label: labelOf.get(a.designation)?.label ?? a.designation }))}
            onChange={setAdding}
          />
          <button
            type="button"
            className="btn btn-small"
            disabled={!adding}
            onClick={() => {
              if (!adding) return;
              setAttr(adding, '0');
              setAdding(null);
            }}
          >
            Agregar
          </button>
        </div>
      )}

      <div className="field">
        <span className="field-label">Tiempos y rangos</span>
        <div className="form-grid">
          <NumberField label="Respawn (segundos)" value={d.respawnSeconds} min={1} onChange={v => set('respawnSeconds', v)} hint={d.respawnSeconds && d.respawnSeconds >= 60 ? `${Math.round(d.respawnSeconds / 60)} min` : undefined} />
          <NumberField label="Tiempo entre ataques (ms)" value={d.attackDelayMs} min={100} onChange={v => set('attackDelayMs', v)} />
          <NumberField label="Tiempo entre pasos (ms)" value={d.moveDelayMs} min={0} onChange={v => set('moveDelayMs', v)} />
          <NumberField label="Rango de movimiento" value={d.moveRange} min={0} max={30} onChange={v => set('moveRange', v)} />
          <NumberField label="Rango de ataque" value={d.attackRange} min={0} max={30} onChange={v => set('attackRange', v)} />
          <NumberField label="Rango de visión" value={d.viewRange} min={0} max={30} onChange={v => set('viewRange', v)} />
          <NumberField label="Drops como máximo" value={d.maxDrops} min={0} max={50} onChange={v => set('maxDrops', v)} />
        </div>
      </div>

      <div className="row-actions">
        <button className="btn btn-primary" disabled={busy || badValue || !d.name.trim()} onClick={save}>
          Guardar
        </button>
        {draft && (
          <button className="btn" disabled={busy} onClick={() => setDraft(null)}>
            Descartar cambios
          </button>
        )}
        {m.edited && (
          <button className="btn" disabled={busy} onClick={() => setConfirmRelease(true)}>
            Dejar de fijar
          </button>
        )}
      </div>

      {confirmRelease && (
        <Confirm
          title="Dejar de fijar"
          text="El monstruo queda como está, pero el próximo deploy que lo configure puede volver a cambiarlo."
          confirmLabel="Dejar de fijar"
          onAnswer={yes => (yes ? void release() : setConfirmRelease(false))}
        />
      )}
    </Card>
  );
}
