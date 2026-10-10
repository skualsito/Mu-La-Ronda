import { useState } from 'react';
import { api, type VipPayments } from '../api';
import { Badge, Card, ErrorBox, Loading, NumberField, formatDate, formatNumber, useLoad, useToast } from '../ui';

/**
 * Mu La Ronda: VIP Plata and Oro paid with Mercado Pago (marketplace/server/vipPayments.ts). The
 * prices are pesos per month; every payment stays recorded, and the totals per account are what
 * to give again when the game goes to production.
 */

const TIER = ['', 'Bronce', 'Plata', 'Oro'];

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  pending: { label: 'esperando pago', tone: 'neutral' },
  paid: { label: 'pagado, sin acreditar', tone: 'warn' },
  granted: { label: 'acreditado', tone: 'ok' },
  rejected: { label: 'rechazado', tone: 'bad' },
  cancelled: { label: 'cancelado', tone: 'neutral' },
};

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function VipPaymentsSection() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<VipPayments>('/vip-payments'), []);
  const [prices, setPrices] = useState<{ silver: number | null; gold: number | null } | null>(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const draft = prices ?? data.prices;
  const dirty = draft.silver !== data.prices.silver || draft.gold !== data.prices.gold;

  return (
    <>
      <Card title="Precios con Mercado Pago">
        <p className="muted small">
          Plata y Oro se pagan con Mercado Pago desde la ventana VIP del juego (Bronce sigue con zen). Precio en pesos por mes.
        </p>
        <div className="form-grid">
          <NumberField label="VIP Plata ($ por mes)" value={draft.silver} min={1} onChange={v => setPrices({ ...draft, silver: v })} />
          <NumberField label="VIP Oro ($ por mes)" value={draft.gold} min={1} onChange={v => setPrices({ ...draft, gold: v })} />
        </div>
        <div className="row-actions">
          <button
            className="btn btn-primary"
            disabled={!dirty || !draft.silver || !draft.gold}
            onClick={async () => {
              try {
                setData(await api<VipPayments>('/vip-payments', { method: 'PATCH', body: draft }));
                setPrices(null);
                toast('Precios guardados');
              } catch (err) {
                toast(err instanceof Error ? err.message : String(err), 'error');
              }
            }}
          >
            Guardar
          </button>
        </div>
      </Card>

      <Card title={`Pagado en la beta (${data.totals.length} cuentas)`}>
        <p className="muted small">Lo que hay que devolverle a cada cuenta al salir a producción.</p>
        {data.totals.length === 0 ? (
          <p className="muted">Todavía nadie pagó.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Meses de Plata</th>
                <th>Meses de Oro</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.totals.map(t => (
                <tr key={t.login}>
                  <td>
                    <strong>{t.login}</strong>
                  </td>
                  <td>{t.silverMonths || '—'}</td>
                  <td>{t.goldMonths || '—'}</td>
                  <td>{pesos(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`Pagos (${formatNumber(data.payments.length)})`} actions={<button className="btn btn-small" onClick={reload}>Actualizar</button>}>
        {data.payments.length === 0 ? (
          <p className="muted">Todavía no hay pagos.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cuenta</th>
                <th>VIP</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map(p => {
                const s = STATUS[p.status] ?? { label: p.status, tone: 'neutral' as const };
                return (
                  <tr key={p.id}>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>{p.login}</td>
                    <td>
                      {p.kind === 'upgrade' ? 'Mejora Plata → Oro' : TIER[p.tier]} · {p.months} {p.months === 1 ? 'mes' : 'meses'}
                    </td>
                    <td>
                      {pesos(p.amount)}
                      {p.discountCode && <div className="muted small">{p.discountCode} (-{p.discountPercent}%)</div>}
                    </td>
                    <td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {p.note && <div className="muted small">{p.note}</div>}
                      {p.mpPaymentId && <div className="muted small">MP {p.mpPaymentId}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
