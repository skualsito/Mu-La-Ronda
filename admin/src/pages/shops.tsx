import { useState } from 'react';
import { api, type InventoryItem, type ShopList } from '../api';
import { MuGrid, isExcellent, itemLabel } from '../muGrid';
import { Card, Confirm, ErrorBox, Loading, PageHeader, useLoad, useToast } from '../ui';
import { ItemEditor } from './inventory';

/**
 * Shops: the NPCs that sell, each with its 8x15 store drawn like the game's.
 * Click an empty square to put an item there, click an item to edit it, drag
 * it to move it. OpenMU sets the prices and loads the stores when it starts.
 */

const COLUMNS = 8;
const ROWS = 15;

export function ShopsPage({ shop }: { shop?: string }) {
  const toast = useToast();
  const list = useLoad(() => api<ShopList>('/shops'), []);
  const [filter, setFilter] = useState('');
  const [newNpc, setNewNpc] = useState('');
  const [confirmIgc, setConfirmIgc] = useState(false);

  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data) return <Loading />;

  const selected = list.data.shops.find(s => s.id === shop) ?? null;
  const shown = list.data.shops.filter(s => !filter || `${s.name} ${s.number} ${s.maps.join(' ')}`.toLowerCase().includes(filter.toLowerCase()));

  const create = async () => {
    try {
      list.setData(await api<ShopList>('/shops', { method: 'POST', body: { monsterId: newNpc } }));
      location.hash = `#/shops/${newNpc}`;
      setNewNpc('');
      toast('Tienda creada');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Shops"
        subtitle="Lo que vende cada NPC. Los precios los calcula OpenMU según el item. Los cambios entran en el juego al reiniciar OpenMU (Servidor → Reiniciar)."
        actions={
          <button className="btn btn-small" onClick={() => setConfirmIgc(true)}>
            Cargar tiendas de IGC
          </button>
        }
      />
      {confirmIgc && (
        <Confirm
          title="Cargar tiendas de IGC"
          text="Vacía las tiendas del server IGC (Hanzo, Lumen, Pasi, Amy, Silvia, Rhea…) y las vuelve a llenar con lo de IGC. Lo que se haya cambiado a mano en esas tiendas se pierde. Entra en el juego al reiniciar OpenMU."
          confirmLabel="Cargar"
          onAnswer={async yes => {
            setConfirmIgc(false);
            if (!yes) return;
            try {
              const { shops } = await api<{ shops: { name: string; items: number }[] }>('/shops/igc', { method: 'POST' });
              list.reload();
              toast(`${shops.length} tiendas cargadas. Reiniciá OpenMU para que entren en el juego.`);
            } catch (err) {
              toast(err instanceof Error ? err.message : String(err), 'error');
            }
          }}
        />
      )}
      <div className="shops-layout">
        <Card title={`Tiendas (${list.data.shops.length})`} className="shops-list">
          <input className="search" placeholder="Buscar tienda o mapa…" value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="shop-rows">
            {shown.map(s => (
              <a key={s.id} href={`#/shops/${s.id}`} className={`shop-row ${s.id === shop ? 'active' : ''}`}>
                <span className="shop-name">{s.name}</span>
                <span className="muted small">
                  #{s.number} · {s.items} items{s.maps.length ? ` · ${s.maps.join(', ')}` : ' · sin ubicar'}
                </span>
              </a>
            ))}
          </div>
          <div className="shop-new">
            <select value={newNpc} onChange={e => setNewNpc(e.target.value)}>
              <option value="">Convertir un NPC en tienda…</option>
              {list.data.candidates.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name} (#{n.number})
                </option>
              ))}
            </select>
            <button className="btn btn-small" disabled={!newNpc} onClick={create}>
              Crear
            </button>
          </div>
          <p className="muted small">Para ponerlo en un mapa, agregalo como spot (cantidad 1) en Spots.</p>
        </Card>

        {selected ? (
          <ShopEditor key={selected.id} shopId={selected.id} name={selected.name} onChanged={list.reload} />
        ) : (
          <Card>
            <p className="muted">Elegí una tienda de la lista.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function ShopEditor({ shopId, name, onChanged }: { shopId: string; name: string; onChanged: () => void }) {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<InventoryItem[]>(`/shops/${shopId}/items`), [shopId]);
  const [editing, setEditing] = useState<InventoryItem | { slot: number } | 'new' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const path = `/shops/${shopId}/items`;
  const run = async (call: Promise<InventoryItem[]>, done: string) => {
    try {
      setData(await call);
      setEditing(null);
      onChanged();
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
  };

  const editingItem = editing && editing !== 'new' && 'id' in editing ? editing : null;
  const atSlot = editing && editing !== 'new' && !('id' in editing) ? editing.slot : undefined;

  return (
    <Card
      title={name}
      className="shop-editor"
      actions={
        <>
          <button className="btn btn-small btn-primary" onClick={() => setEditing('new')}>
            + Agregar item
          </button>
          <button className="btn btn-small btn-ghost" disabled={!data.length} onClick={() => setConfirmClear(true)}>
            Vaciar
          </button>
        </>
      }
    >
      <div className="shop-body">
        <MuGrid
          items={data}
          first={0}
          columns={COLUMNS}
          rows={ROWS}
          selectedId={editingItem?.id}
          onSelect={item => setEditing(item)}
          onEmptyClick={slot => setEditing({ slot })}
          onMove={(item, slot) => run(api(`${path}/${item.id}`, { method: 'PATCH', body: { slot } }), `${item.name} movido`)}
        />
        <div className="shop-side">
          <h3 className="subhead">En venta ({data.length})</h3>
          <ul className="shop-items">
            {data.map(item => (
              <li key={item.id}>
                <button className={`link ${isExcellent(item) ? 'exc' : ''}`} onClick={() => setEditing(item)}>
                  {itemLabel(item, isExcellent(item))}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small">Tocá un casillero vacío para poner un item ahí. Arrastrá un item para moverlo.</p>
        </div>
      </div>

      {editing && (
        <ItemEditor
          item={editingItem}
          locked={false}
          onClose={() => setEditing(null)}
          onSave={(body, item) =>
            run(
              item
                ? api(`${path}/${item.id}`, { method: 'PATCH', body })
                : api(path, { method: 'POST', body: atSlot === undefined ? body : { ...(body as object), slot: atSlot } }),
              item ? 'Item guardado' : 'Item agregado'
            )
          }
          onDelete={item => run(api(`${path}/${item.id}`, { method: 'DELETE' }), 'Item quitado de la tienda')}
          saveLabel={editingItem ? 'Guardar' : 'Agregar a la tienda'}
          deleteLabel="Quitar de la tienda"
        />
      )}

      {confirmClear && (
        <Confirm
          title="Vaciar tienda"
          text={`Se sacan los ${data.length} items de ${name}. El NPC sigue siendo una tienda.`}
          confirmLabel="Vaciar"
          danger
          onAnswer={yes => {
            setConfirmClear(false);
            if (yes) void run(api(`/shops/${shopId}/clear`, { method: 'POST' }), 'Tienda vaciada');
          }}
        />
      )}
    </Card>
  );
}
