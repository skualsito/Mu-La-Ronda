import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type MapInfo, type Monster, type Spawn } from '../api';
import { Badge, Card, Confirm, ErrorBox, Loading, NumberField, PageHeader, Toggle, useLoad, useToast } from '../ui';

/**
 * The spot editor: a map's walkable ground drawn from the client's terrain,
 * every monster spot on it, and a drag on the map to place or move one.
 */

const SIZE = 256;
const COLORS = { walk: [34, 52, 52], safe: [16, 92, 92], blocked: [8, 12, 12] } as const;

type Rect = { x1: number; y1: number; x2: number; y2: number };
type Draft = Rect & { id: string | null; monsterId: string; quantity: number };

const norm = (r: Rect): Rect => ({
  x1: Math.min(r.x1, r.x2),
  y1: Math.min(r.y1, r.y2),
  x2: Math.max(r.x1, r.x2),
  y2: Math.max(r.y1, r.y2),
});

function decode(cells: string): Uint8Array {
  const bin = atob(cells);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function SpotsPage({ map: mapParam }: { map?: string }) {
  const toast = useToast();
  const maps = useLoad(() => api<MapInfo[]>('/maps'), []);
  const monsters = useLoad(() => api<Monster[]>('/monsters'), []);
  const mapNumber = Number(mapParam ?? 0);
  const map = maps.data?.find(m => m.number === mapNumber);

  const spawns = useLoad(() => (map ? api<Spawn[]>(`/maps/${map.id}/spawns`) : Promise.resolve([])), [map?.id]);
  const terrain = useLoad(
    () => (map?.hasTerrain ? api<{ cells: string }>(`/maps/${mapNumber}/terrain`).then(t => decode(t.cells)) : Promise.resolve(null)),
    [mapNumber, map?.hasTerrain]
  );

  const [showNpcs, setShowNpcs] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => (spawns.data ?? []).filter(s => showNpcs || s.kind === 0), [spawns.data, showNpcs]);
  const selectedSpawn = spawns.data?.find(s => s.id === selected) ?? null;

  const select = (s: Spawn | null) => {
    setSelected(s?.id ?? null);
    setDraft(s ? { id: s.id, monsterId: s.monsterId, quantity: s.baseQuantity, x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 } : null);
  };

  const save = async () => {
    if (!draft || !map) return;
    setBusy(true);
    try {
      const body = { monsterId: draft.monsterId, quantity: draft.quantity, ...norm(draft) };
      if (draft.id) await api(`/spawns/${draft.id}`, { method: 'PATCH', body });
      else await api(`/maps/${map.id}/spawns`, { method: 'POST', body });
      toast(draft.id ? 'Spot guardado' : 'Spot creado');
      spawns.reload();
      if (!draft.id) setDraft(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    try {
      await api(`/spawns/${draft.id}`, { method: 'DELETE' });
      toast('Spot borrado');
      select(null);
      spawns.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  if (maps.error) return <ErrorBox error={maps.error} onRetry={maps.reload} />;
  if (!maps.data) return <Loading />;

  const monsterOptions = (monsters.data ?? []).filter(m => m.kind === 0 || m.id === draft?.monsterId);
  const readOnly = !!selectedSpawn?.leveling;

  return (
    <>
      <PageHeader
        title="Spots"
        subtitle="Dónde y cuántos monstruos aparecen en cada mapa. Arrastrá sobre el mapa para marcar un área."
        actions={
          <select
            className="map-select"
            value={mapNumber}
            onChange={e => {
              select(null);
              location.hash = `#/spots/${e.target.value}`;
            }}
          >
            {maps.data.map(m => (
              <option key={m.id} value={m.number}>
                {m.number} · {m.name}
                {m.hasTerrain ? '' : ' (sin vista)'}
              </option>
            ))}
          </select>
        }
      />

      <div className="spots-layout">
        <Card className="map-card">
          <MapCanvas
            terrain={terrain.data}
            spawns={visible}
            selected={selected}
            draft={draft}
            onHover={setHover}
            onPick={s => select(s)}
            onDraw={r => {
              if (readOnly) return;
              setDraft(d =>
                d
                  ? { ...d, ...r }
                  : { id: null, monsterId: monsterOptions[0]?.id ?? '', quantity: 10, ...r }
              );
            }}
          />
          <div className="map-legend">
            <span><i className="sw sw-walk" /> caminable</span>
            <span><i className="sw sw-safe" /> zona segura</span>
            <span><i className="sw sw-blocked" /> bloqueado</span>
            <span className="muted">{hover ? `x ${hover.x} · y ${hover.y}` : 'pasá el mouse para ver coordenadas'}</span>
          </div>
          {!map?.hasTerrain && <p className="muted small">No hay terreno del cliente para este mapa: los spots se ven sobre un fondo vacío.</p>}
        </Card>

        <div className="spots-side">
          <Card
            title={draft ? (draft.id ? 'Editar spot' : 'Nuevo spot') : 'Spot'}
            actions={
              <button
                className="btn btn-small"
                onClick={() => {
                  setSelected(null);
                  setDraft({ id: null, monsterId: monsterOptions[0]?.id ?? '', quantity: 10, x1: 120, y1: 120, x2: 130, y2: 130 });
                }}
              >
                + Nuevo
              </button>
            }
          >
            {!draft && <p className="muted">Elegí un spot de la lista o del mapa, o arrastrá sobre el mapa para crear uno.</p>}
            {draft && (
              <>
                {readOnly && (
                  <div className="notice notice-info">
                    Spot de la zona de leveleo: se define en <code>06-leveling.sql</code>.
                  </div>
                )}
                <label className="field">
                  <span className="field-label">Monstruo</span>
                  <select value={draft.monsterId} disabled={readOnly} onChange={e => setDraft({ ...draft, monsterId: e.target.value })}>
                    {monsterOptions.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.number} · {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <NumberField
                    label="Cantidad"
                    value={draft.quantity}
                    min={1}
                    max={500}
                    disabled={readOnly}
                    onChange={v => setDraft({ ...draft, quantity: v ?? 1 })}
                    hint={selectedSpawn && selectedSpawn.quantity !== selectedSpawn.baseQuantity ? `con server fast: ${selectedSpawn.quantity}` : 'base (server fast la multiplica)'}
                  />
                  <NumberField label="X1" value={draft.x1} min={0} max={255} disabled={readOnly} onChange={v => setDraft({ ...draft, x1: v ?? 0 })} />
                  <NumberField label="Y1" value={draft.y1} min={0} max={255} disabled={readOnly} onChange={v => setDraft({ ...draft, y1: v ?? 0 })} />
                  <NumberField label="X2" value={draft.x2} min={0} max={255} disabled={readOnly} onChange={v => setDraft({ ...draft, x2: v ?? 0 })} />
                  <NumberField label="Y2" value={draft.y2} min={0} max={255} disabled={readOnly} onChange={v => setDraft({ ...draft, y2: v ?? 0 })} />
                </div>
                <p className="muted small">Tip: con el spot elegido, arrastrá sobre el mapa para moverlo.</p>
                {!readOnly && (
                  <div className="row-actions">
                    <button className="btn btn-primary" disabled={busy || !draft.monsterId} onClick={save}>
                      {draft.id ? 'Guardar' : 'Crear spot'}
                    </button>
                    {draft.id && (
                      <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                        Borrar
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => select(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>

          <Card title={`Spots del mapa (${visible.length})`} actions={<Toggle label="NPCs" checked={showNpcs} onChange={setShowNpcs} />}>
            {spawns.error && <ErrorBox error={spawns.error} onRetry={spawns.reload} />}
            <div className="spawn-list">
              {visible.map(s => (
                <button key={s.id} className={`spawn-row ${s.id === selected ? 'active' : ''}`} onClick={() => select(s)}>
                  <span>
                    <strong>{s.monsterName}</strong> <span className="muted small">#{s.monsterNumber}</span>
                    {s.leveling && <Badge tone="accent">leveleo</Badge>}
                    {s.kind !== 0 && <Badge>NPC</Badge>}
                  </span>
                  <span className="muted small">
                    ×{s.quantity} · {s.x1},{s.y1} → {s.x2},{s.y2}
                  </span>
                </button>
              ))}
              {spawns.data && !visible.length && <p className="empty">Este mapa no tiene spots de monstruos.</p>}
            </div>
          </Card>
          <p className="muted small">Los cambios se aplican al reiniciar OpenMU (Servidor → Reiniciar).</p>
        </div>
      </div>

      {confirmDelete && (
        <Confirm
          title="Borrar spot"
          text={`Se borra el spot de ${selectedSpawn?.monsterName ?? 'este monstruo'}.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            setConfirmDelete(false);
            if (yes) remove();
          }}
        />
      )}
    </>
  );
}

function MapCanvas({
  terrain,
  spawns,
  selected,
  draft,
  onHover,
  onPick,
  onDraw,
}: {
  terrain: Uint8Array | null;
  spawns: Spawn[];
  selected: string | null;
  draft: Draft | null;
  onHover: (p: { x: number; y: number } | null) => void;
  onPick: (s: Spawn | null) => void;
  onDraw: (r: Rect) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const base = useMemo(() => {
    const img = new ImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
      const c = !terrain ? COLORS.walk : terrain[i] === 2 ? COLORS.blocked : terrain[i] === 1 ? COLORS.safe : COLORS.walk;
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    return img;
  }, [terrain]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = canvas.width / SIZE;

    const off = document.createElement('canvas');
    off.width = SIZE;
    off.height = SIZE;
    off.getContext('2d')!.putImageData(base, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, canvas.width, canvas.height);

    const box = (r: Rect, fill: string, stroke: string, width = 1) => {
      const n = norm(r);
      const x = n.x1 * scale;
      const y = n.y1 * scale;
      const w = (n.x2 - n.x1 + 1) * scale;
      const h = (n.y2 - n.y1 + 1) * scale;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    for (const s of spawns) {
      if (s.id === selected) continue;
      const color = s.leveling ? '25, 201, 199' : s.kind === 0 ? '240, 150, 70' : '120, 160, 255';
      box(s, `rgba(${color}, 0.22)`, `rgba(${color}, 0.9)`);
    }
    const current = drag ?? draft;
    if (current) box(current, 'rgba(255, 255, 255, 0.18)', '#ffffff', 2);
  }, [base, spawns, selected, draft, drag]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    return { x: Math.min(SIZE - 1, Math.max(0, x)), y: Math.min(SIZE - 1, Math.max(0, y)) };
  };

  return (
    <canvas
      ref={ref}
      className="map-canvas"
      width={768}
      height={768}
      onPointerDown={e => {
        const p = cellAt(e);
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      }}
      onPointerMove={e => {
        const p = cellAt(e);
        onHover(p);
        if (drag) setDrag({ ...drag, x2: p.x, y2: p.y });
      }}
      onPointerLeave={() => onHover(null)}
      onPointerUp={e => {
        const p = cellAt(e);
        if (!drag) return;
        const r = norm({ ...drag, x2: p.x, y2: p.y });
        setDrag(null);
        // A click (no drag) picks the spot under the cursor instead.
        if (r.x1 === r.x2 && r.y1 === r.y2) {
          const hit = [...spawns].reverse().find(s => p.x >= s.x1 && p.x <= s.x2 && p.y >= s.y1 && p.y <= s.y2);
          onPick(hit ?? null);
          return;
        }
        onDraw(r);
      }}
    />
  );
}
