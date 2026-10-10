import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type MapInfo, type NpcDefinition, type NpcPlace } from '../api';
import { Card, ComboField, Confirm, ErrorBox, Loading, NumberField, PageHeader, SelectField, useLoad, useToast } from '../ui';

/**
 * The NPC editor: every NPC standing on a map, drawn on its ground. A click on
 * the map places the NPC being edited there; a click on a dot picks that NPC.
 * The same NPC can stand on any number of maps, each place its own entry.
 */

const SIZE = 256;
const COLORS = { walk: [34, 52, 52], safe: [16, 92, 92], blocked: [8, 12, 12] } as const;

/** OpenMU's Direction. */
const DIRECTIONS = [
  { value: 0, label: 'Sin dirección' },
  { value: 1, label: 'Oeste' },
  { value: 2, label: 'Sudoeste' },
  { value: 3, label: 'Sur' },
  { value: 4, label: 'Sudeste' },
  { value: 5, label: 'Este' },
  { value: 6, label: 'Noreste' },
  { value: 7, label: 'Norte' },
  { value: 8, label: 'Noroeste' },
];

type Draft = { id: string | null; npcId: string; mapId: string; x: number; y: number; direction: number };
type Data = { definitions: NpcDefinition[]; places: NpcPlace[] };

function decode(cells: string): Uint8Array {
  const bin = atob(cells);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function NpcsPage({ map: mapParam }: { map?: string }) {
  const toast = useToast();
  const maps = useLoad(() => api<MapInfo[]>('/maps'), []);
  const data = useLoad(() => api<Data>('/npcs'), []);
  const mapNumber = Number(mapParam ?? 0);
  const map = maps.data?.find(m => m.number === mapNumber);
  const terrain = useLoad(
    () => (map?.hasTerrain ? api<{ cells: string }>(`/maps/${mapNumber}/terrain`).then(t => decode(t.cells)) : Promise.resolve(null)),
    [mapNumber, map?.hasTerrain]
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const places = useMemo(() => (data.data?.places ?? []).filter(p => p.mapNumber === mapNumber), [data.data, mapNumber]);
  const definitions = data.data?.definitions ?? [];
  const npcOptions = definitions.map(d => ({ value: d.id, label: `${d.number} · ${d.name}${d.shop ? ' (tienda)' : ''}` }));
  const searched = search ? (data.data?.places ?? []).filter(p => p.npcId === search) : [];
  const editing = draft?.id ? data.data?.places.find(p => p.id === draft.id) ?? null : null;

  const goTo = (number: number) => {
    location.hash = `#/npcs/${number}`;
  };

  const pick = (p: NpcPlace | null) => {
    setDraft(p ? { id: p.id, npcId: p.npcId, mapId: p.mapId, x: p.x, y: p.y, direction: p.direction } : null);
  };

  const startNew = (at?: { x: number; y: number }) => {
    if (!map) return;
    setDraft({ id: null, npcId: search ?? '', mapId: map.id, x: at?.x ?? 128, y: at?.y ?? 128, direction: 3 });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const body = { npcId: draft.npcId, mapId: draft.mapId, x: draft.x, y: draft.y, direction: draft.direction };
      if (draft.id) await api(`/npcs/places/${draft.id}`, { method: 'PATCH', body });
      else await api('/npcs/places', { method: 'POST', body });
      toast(draft.id ? 'NPC guardado' : 'NPC agregado');
      data.reload();
      const target = maps.data?.find(m => m.id === draft.mapId);
      if (target && target.number !== mapNumber) goTo(target.number);
      setDraft(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    try {
      await api(`/npcs/places/${draft.id}`, { method: 'DELETE' });
      toast('NPC sacado del mapa');
      setDraft(null);
      data.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  if (maps.error) return <ErrorBox error={maps.error} onRetry={maps.reload} />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  if (!maps.data || !data.data) return <Loading />;

  const mapOptions = maps.data.map(m => ({ value: m.id, label: `${m.number} · ${m.name}` }));
  const hoverNpc = hover ? places.find(p => p.x === hover.x && p.y === hover.y) : undefined;

  return (
    <>
      <PageHeader
        title="NPCs"
        subtitle="Dónde está cada NPC en cada mapa. Hacé click en el mapa para poner el NPC que estás editando, o en un punto para elegirlo."
        actions={
          <select
            className="map-select"
            value={mapNumber}
            onChange={e => {
              setDraft(null);
              goTo(Number(e.target.value));
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
          <NpcCanvas
            terrain={terrain.data}
            places={places}
            selected={draft?.id ?? null}
            draft={draft && draft.mapId === map?.id ? draft : null}
            highlight={search}
            onHover={setHover}
            onClick={(cell, hit) => {
              if (hit) pick(hit);
              else if (draft) setDraft({ ...draft, x: cell.x, y: cell.y, mapId: map?.id ?? draft.mapId });
              else startNew(cell);
            }}
          />
          <div className="map-legend">
            <span><i className="sw sw-walk" /> caminable</span>
            <span><i className="sw sw-safe" /> zona segura</span>
            <span><i className="sw sw-blocked" /> bloqueado</span>
            <span className="muted">
              {hover ? `x ${hover.x} · y ${hover.y}${hoverNpc ? ` · ${hoverNpc.name}` : ''}` : 'pasá el mouse para ver coordenadas'}
            </span>
          </div>
          {!map?.hasTerrain && <p className="muted small">No hay terreno del cliente para este mapa: los NPC se ven sobre un fondo vacío.</p>}
        </Card>

        <div className="spots-side">
          <Card
            title={draft ? (draft.id ? 'Editar NPC' : 'Agregar NPC') : 'NPC'}
            actions={
              <button className="btn btn-small" onClick={() => startNew()}>
                + Agregar
              </button>
            }
          >
            {!draft && <p className="muted">Elegí un NPC de la lista o del mapa, o hacé click en el mapa para agregar uno ahí.</p>}
            {draft && (
              <>
                <ComboField
                  label="NPC"
                  value={draft.npcId || null}
                  options={npcOptions}
                  onChange={v => v && setDraft({ ...draft, npcId: v })}
                  placeholder="Buscá por nombre o número…"
                />
                <ComboField
                  label="Mapa"
                  value={draft.mapId}
                  options={mapOptions}
                  onChange={v => v && setDraft({ ...draft, mapId: v })}
                  placeholder="Buscá el mapa…"
                />
                <div className="form-grid">
                  <NumberField label="X" value={draft.x} min={0} max={255} onChange={v => setDraft({ ...draft, x: v ?? 0 })} />
                  <NumberField label="Y" value={draft.y} min={0} max={255} onChange={v => setDraft({ ...draft, y: v ?? 0 })} />
                  <SelectField label="Mira hacia" value={draft.direction} options={DIRECTIONS} onChange={v => setDraft({ ...draft, direction: Number(v) })} />
                </div>
                {draft.mapId !== map?.id && <p className="muted small">Se va a guardar en otro mapa.</p>}
                <div className="row-actions">
                  <button className="btn btn-primary" disabled={busy || !draft.npcId} onClick={save}>
                    {draft.id ? 'Guardar' : 'Agregar NPC'}
                  </button>
                  {draft.id && (
                    <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                      Borrar
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => setDraft(null)}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </Card>

          <Card title={`NPCs de ${map?.name ?? 'este mapa'} (${places.length})`}>
            <div className="spawn-list">
              {places.map(p => (
                <button key={p.id} className={`spawn-row ${p.id === draft?.id ? 'active' : ''}`} onClick={() => pick(p)}>
                  <span>
                    <strong>{p.name}</strong> <span className="muted small">#{p.number}</span>
                  </span>
                  <span className="muted small">
                    {p.x}, {p.y} · {DIRECTIONS[p.direction]?.label ?? p.direction}
                  </span>
                </button>
              ))}
              {!places.length && <p className="empty">Este mapa no tiene NPCs.</p>}
            </div>
          </Card>

          <Card title="Buscar un NPC en todos los mapas">
            <ComboField label="NPC" value={search} options={npcOptions} onChange={v => setSearch(v)} placeholder="Buscá por nombre o número…" />
            {search && (
              <div className="spawn-list">
                {searched.map(p => (
                  <button
                    key={p.id}
                    className={`spawn-row ${p.id === draft?.id ? 'active' : ''}`}
                    onClick={() => {
                      if (p.mapNumber !== mapNumber) goTo(p.mapNumber);
                      pick(p);
                    }}
                  >
                    <span>
                      <strong>{p.mapName}</strong> <span className="muted small">mapa {p.mapNumber}</span>
                    </span>
                    <span className="muted small">
                      {p.x}, {p.y}
                    </span>
                  </button>
                ))}
                {!searched.length && <p className="empty">No está en ningún mapa.</p>}
                {map && (
                  <button className="btn btn-small" onClick={() => startNew()}>
                    Ponerlo en {map.name}
                  </button>
                )}
              </div>
            )}
          </Card>
          <p className="muted small">
            Los cambios se aplican al reiniciar OpenMU (Servidor → Reiniciar). Si un NPC tiene tienda, la tienda es la misma en todos los mapas donde
            esté.
          </p>
        </div>
      </div>

      {confirmDelete && (
        <Confirm
          title="Sacar NPC"
          text={`Se saca a ${editing?.name ?? 'este NPC'} de ${editing?.mapName ?? 'este mapa'} (${editing?.x}, ${editing?.y}). Sigue en los otros mapas donde esté.`}
          confirmLabel="Sacar"
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

function NpcCanvas({
  terrain,
  places,
  selected,
  draft,
  highlight,
  onHover,
  onClick,
}: {
  terrain: Uint8Array | null;
  places: NpcPlace[];
  selected: string | null;
  draft: Draft | null;
  highlight: string | null;
  onHover: (p: { x: number; y: number } | null) => void;
  onClick: (cell: { x: number; y: number }, hit: NpcPlace | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
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

    const dot = (x: number, y: number, fill: string, r: number) => {
      ctx.beginPath();
      ctx.arc((x + 0.5) * scale, (y + 0.5) * scale, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    for (const p of places) {
      if (p.id === selected) continue;
      dot(p.x, p.y, p.npcId === highlight ? '#ffd24a' : '#78a0ff', 5);
    }
    if (draft) dot(draft.x, draft.y, '#ffffff', 7);
  }, [base, places, selected, draft, highlight]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
    return { x: Math.min(SIZE - 1, Math.max(0, x)), y: Math.min(SIZE - 1, Math.max(0, y)) };
  };

  // A click on a dot (or next to it) picks that NPC.
  const hitAt = (c: { x: number; y: number }) =>
    places
      .map(p => ({ p, d: Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y)) }))
      .filter(h => h.d <= 1)
      .sort((a, b) => a.d - b.d)[0]?.p ?? null;

  return (
    <canvas
      ref={ref}
      className="map-canvas"
      width={768}
      height={768}
      onPointerMove={e => onHover(cellAt(e))}
      onPointerLeave={() => onHover(null)}
      onClick={e => {
        const c = cellAt(e as unknown as React.PointerEvent<HTMLCanvasElement>);
        onClick(c, hitAt(c));
      }}
    />
  );
}
