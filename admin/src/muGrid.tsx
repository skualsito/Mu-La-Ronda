import { useState, type DragEvent } from 'react';
import type { InventoryItem } from './api';
import { itemIconUrl } from './itemIcon';

/**
 * An item grid drawn like the game's: dark stone squares in a gold frame,
 * the game's own item pictures on top. Items can be dragged to another
 * place; the server checks the move again, this only previews it.
 */

export const isExcellent = (item: InventoryItem) => item.options.some(o => o.type === 'excellent');

export function itemLabel(item: { name: string; level: number }, excellent = false) {
  return `${excellent ? 'Excelente ' : ''}${item.name}${item.level ? ` +${item.level}` : ''}`;
}

function ItemPicture({ item }: { item: InventoryItem }) {
  const [broken, setBroken] = useState(false);
  const url = broken ? null : itemIconUrl({ group: item.group, number: item.number, level: item.level, excellent: isExcellent(item) });
  if (!url) return <span className="mu-item-name">{item.name}</span>;
  return <img src={url} alt={item.name} draggable={false} onError={() => setBroken(true)} />;
}

export function MuGrid({
  items,
  first,
  columns,
  rows,
  cell = 40,
  selectedId,
  disabled,
  onSelect,
  onEmptyClick,
  onMove,
}: {
  items: InventoryItem[];
  first: number;
  columns: number;
  rows: number;
  cell?: number;
  selectedId?: string | null;
  disabled?: boolean;
  onSelect: (item: InventoryItem) => void;
  onEmptyClick?: (slot: number) => void;
  onMove?: (item: InventoryItem, slot: number) => void;
}) {
  const [dragging, setDragging] = useState<InventoryItem | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const inGrid = items.filter(i => i.slot >= first && i.slot < first + columns * rows);

  const occupied = (except?: string) => {
    const cells = new Array(columns * rows).fill(false);
    for (const item of inGrid) {
      if (item.id === except) continue;
      const c = item.slot - first;
      const x0 = c % columns;
      const y0 = Math.floor(c / columns);
      for (let y = y0; y < y0 + item.height && y < rows; y++) for (let x = x0; x < x0 + item.width && x < columns; x++) cells[y * columns + x] = true;
    }
    return cells;
  };

  const fits = (item: InventoryItem, slot: number) => {
    const c = slot - first;
    const x0 = c % columns;
    const y0 = Math.floor(c / columns);
    if (x0 + item.width > columns || y0 + item.height > rows) return false;
    const cells = occupied(item.id);
    for (let y = y0; y < y0 + item.height; y++) for (let x = x0; x < x0 + item.width; x++) if (cells[y * columns + x]) return false;
    return true;
  };

  const slotAt = (e: DragEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - box.left) / cell);
    const y = Math.floor((e.clientY - box.top) / cell);
    if (x < 0 || y < 0 || x >= columns || y >= rows) return null;
    return first + y * columns + x;
  };

  const cells = occupied();
  const preview = dragging && hover !== null ? { slot: hover, ok: fits(dragging, hover) } : null;

  return (
    <div className="mu-frame">
      <div
        className="mu-grid"
        style={{ width: columns * cell, height: rows * cell, backgroundSize: `${cell}px ${cell}px` }}
        onDragOver={e => {
          if (!dragging) return;
          e.preventDefault();
          setHover(slotAt(e));
        }}
        onDragLeave={() => setHover(null)}
        onDrop={e => {
          e.preventDefault();
          const slot = slotAt(e);
          if (dragging && slot !== null && slot !== dragging.slot && fits(dragging, slot)) onMove?.(dragging, slot);
          setDragging(null);
          setHover(null);
        }}
        onClick={e => {
          if (disabled || !onEmptyClick || e.target !== e.currentTarget) return;
          const box = e.currentTarget.getBoundingClientRect();
          const x = Math.floor((e.clientX - box.left) / cell);
          const y = Math.floor((e.clientY - box.top) / cell);
          if (!cells[y * columns + x]) onEmptyClick(first + y * columns + x);
        }}
      >
        {preview && dragging && (
          <div
            className={`mu-drop ${preview.ok ? 'ok' : 'bad'}`}
            style={{
              left: ((preview.slot - first) % columns) * cell,
              top: Math.floor((preview.slot - first) / columns) * cell,
              width: dragging.width * cell,
              height: dragging.height * cell,
            }}
          />
        )}
        {inGrid.map(item => {
          const c = item.slot - first;
          const exc = isExcellent(item);
          return (
            <button
              key={item.id}
              type="button"
              className={`mu-item ${exc ? 'exc' : ''} ${item.level >= 7 ? 'high' : ''} ${selectedId === item.id ? 'selected' : ''} ${dragging?.id === item.id ? 'dragging' : ''}`}
              title={itemLabel(item, exc)}
              draggable={!disabled && !!onMove}
              onDragStart={e => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
                setDragging(item);
              }}
              onDragEnd={() => {
                setDragging(null);
                setHover(null);
              }}
              style={{ left: (c % columns) * cell, top: Math.floor(c / columns) * cell, width: item.width * cell, height: item.height * cell }}
              onClick={() => onSelect(item)}
            >
              <ItemPicture item={item} />
              {item.level > 0 && <span className="mu-item-level">+{item.level}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
