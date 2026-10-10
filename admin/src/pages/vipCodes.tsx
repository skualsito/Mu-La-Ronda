import { useState } from 'react';
import { api, type VipCode } from '../api';
import { VipPaymentsSection } from './vipPayments';
import { Badge, Card, Confirm, ErrorBox, Loading, NumberField, PageHeader, TextField, Toggle, formatDate, useLoad, useToast } from '../ui';

/**
 * VIP discount codes. The game reads them on every purchase, so a code made,
 * changed or turned off here works at once. Players type it in the VIP window
 * (Esc → VIP) or after the command: /vip oro 3 CODIGO.
 */

type Draft = {
  code: string;
  percent: number | null;
  maxUses: number | null;
  oncePerAccount: boolean;
  active: boolean;
  expiresAt: string;
  note: string;
};

const EMPTY: Draft = { code: '', percent: 10, maxUses: null, oncePerAccount: true, active: true, expiresAt: '', note: '' };

/** `2026-10-31T23:59` for a datetime-local input, in local time. */
function localInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftOf(c: VipCode): Draft {
  return {
    code: c.code,
    percent: c.percent,
    maxUses: c.maxUses,
    oncePerAccount: c.oncePerAccount,
    active: c.active,
    expiresAt: localInput(c.expiresAt),
    note: c.note ?? '',
  };
}

const bodyOf = (d: Draft) => ({
  code: d.code,
  percent: d.percent,
  maxUses: d.maxUses,
  oncePerAccount: d.oncePerAccount,
  active: d.active,
  expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
  note: d.note,
});

function CodeForm({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  return (
    <>
      <div className="form-grid">
        <TextField label="Código" value={draft.code} placeholder="BETA10" onChange={v => onChange({ ...draft, code: v.toUpperCase() })} />
        <NumberField label="Descuento (%)" value={draft.percent} min={1} max={100} onChange={v => onChange({ ...draft, percent: v })} />
        <NumberField
          label="Usos máximos"
          value={draft.maxUses}
          min={1}
          hint="Vacío: sin límite"
          onChange={v => onChange({ ...draft, maxUses: v })}
        />
        <TextField label="Vence" type="datetime-local" value={draft.expiresAt} hint="Vacío: no vence" onChange={v => onChange({ ...draft, expiresAt: v })} />
      </div>
      <TextField label="Nota (solo se ve acá)" value={draft.note} placeholder="Ej.: sorteo de Discord" onChange={v => onChange({ ...draft, note: v })} />
      <Toggle label="Una vez por cuenta" hint="Cada cuenta lo puede usar una sola vez" checked={draft.oncePerAccount} onChange={v => onChange({ ...draft, oncePerAccount: v })} />
      <Toggle label="Activo" checked={draft.active} onChange={v => onChange({ ...draft, active: v })} />
    </>
  );
}

function status(c: VipCode): { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (!c.active) return { label: 'desactivado', tone: 'neutral' };
  if (c.expiresAt && new Date(c.expiresAt) <= new Date()) return { label: 'vencido', tone: 'bad' };
  if (c.maxUses !== null && c.uses >= c.maxUses) return { label: 'agotado', tone: 'warn' };
  return { label: 'activo', tone: 'ok' };
}

export function VipCodesPage() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<VipCode[]>('/vip-codes'), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<VipCode | null>(null);

  const run = async (call: Promise<VipCode[]>, done: string) => {
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
      <PageHeader title="VIP" subtitle="Pagos con Mercado Pago (Plata y Oro) y códigos de descuento para el Bronce, que se compra con zen." />

      <VipPaymentsSection />

      <h2 className="section-title">Códigos de descuento (Bronce)</h2>

      <Card title="Nuevo código">
        <CodeForm draft={draft} onChange={setDraft} />
        <div className="row-actions">
          <button
            className="btn btn-primary"
            disabled={!draft.code.trim() || !draft.percent}
            onClick={async () => {
              if (await run(api('/vip-codes', { method: 'POST', body: bodyOf(draft) }), 'Código creado')) setDraft(EMPTY);
            }}
          >
            Crear código
          </button>
        </div>
      </Card>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <Card title={`Códigos (${data.length})`}>
          {data.length === 0 ? (
            <p className="muted">Todavía no hay códigos.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Usos</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.map(c => {
                  const s = status(c);
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.code}</strong>
                        {c.note && <div className="muted small">{c.note}</div>}
                      </td>
                      <td>{c.percent}%</td>
                      <td>
                        {c.uses}
                        {c.maxUses !== null ? ` / ${c.maxUses}` : ''}
                        {c.oncePerAccount && <div className="muted small">una vez por cuenta</div>}
                      </td>
                      <td>{c.expiresAt ? formatDate(c.expiresAt) : '—'}</td>
                      <td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="row-actions">
                        <button className="btn btn-small" onClick={() => setEditing({ id: c.id, draft: draftOf(c) })}>
                          Editar
                        </button>
                        <button className="btn btn-ghost btn-small" onClick={() => setDeleting(c)}>
                          Borrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <div className="modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
            <h2>Editar código</h2>
            <CodeForm draft={editing.draft} onChange={d => setEditing({ ...editing, draft: d })} />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (await run(api(`/vip-codes/${editing.id}`, { method: 'PATCH', body: bodyOf(editing.draft) }), 'Guardado')) setEditing(null);
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
          title="Borrar código"
          text={`¿Borrar el código ${deleting.code}? Quien lo tenga ya no lo va a poder usar.`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            const code = deleting;
            setDeleting(null);
            if (yes) void run(api(`/vip-codes/${code.id}`, { method: 'DELETE' }), 'Código borrado');
          }}
        />
      )}
    </>
  );
}
