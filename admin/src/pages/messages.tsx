import { useState } from 'react';
import { api, type AutoMessage } from '../api';
import { Card, Confirm, ErrorBox, Loading, PageHeader, Toggle, useLoad, useToast } from '../ui';

/**
 * Automatic messages: the golden notice in the middle of the game screen,
 * repeated every N minutes. The proxy reads them every 15 seconds, so changes
 * reach the game without restarting anything.
 */

const TEXT_MAX = 200;
const INTERVALS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440];

const intervalLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** The banner as the game draws it: gold, centred, on a dark band. */
function Preview({ text }: { text: string }) {
  return (
    <div className="notice-preview">
      <span>{text || 'Así se ve en el juego'}</span>
    </div>
  );
}

function IntervalSelect({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const options = INTERVALS.includes(value) ? INTERVALS : [...INTERVALS, value].sort((a, b) => a - b);
  return (
    <select value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))}>
      {options.map(m => (
        <option key={m} value={m}>
          Cada {intervalLabel(m)}
        </option>
      ))}
    </select>
  );
}

function MessageRow({
  message,
  onChange,
  onSendNow,
  onDelete,
}: {
  message: AutoMessage;
  onChange: (patch: Partial<AutoMessage>) => Promise<void>;
  onSendNow: () => Promise<void>;
  onDelete: () => void;
}) {
  const [text, setText] = useState(message.text);
  const [source, setSource] = useState(message.text);
  // A save returns fresh rows: start over from the server's text.
  if (source !== message.text) {
    setSource(message.text);
    setText(message.text);
  }
  const dirty = text.trim() !== message.text;

  return (
    <div className={`message-row ${message.enabled ? '' : 'is-off'}`}>
      <Preview text={text.trim()} />
      <div className="message-edit">
        <input value={text} maxLength={TEXT_MAX} onChange={e => setText(e.target.value)} placeholder="Texto del mensaje" />
        <span className="muted small">
          {text.length}/{TEXT_MAX}
        </span>
      </div>
      <div className="message-actions">
        <IntervalSelect value={message.intervalMinutes} onChange={v => onChange({ intervalMinutes: v })} />
        <Toggle label="Activo" checked={message.enabled} onChange={v => onChange({ enabled: v })} />
        {dirty && (
          <button className="btn btn-primary btn-small" disabled={!text.trim()} onClick={() => onChange({ text })}>
            Guardar texto
          </button>
        )}
        <button className="btn btn-small" disabled={dirty} title="Lo manda una vez a todos los conectados" onClick={onSendNow}>
          Enviar ahora
        </button>
        <button className="btn btn-ghost btn-small" onClick={onDelete}>
          Borrar
        </button>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const toast = useToast();
  const { data, error, reload, setData } = useLoad(() => api<AutoMessage[]>('/messages'), []);
  const [text, setText] = useState('');
  const [interval, setIntervalMinutes] = useState(30);
  const [deleting, setDeleting] = useState<AutoMessage | null>(null);

  const run = async (call: Promise<AutoMessage[]>, done: string) => {
    try {
      setData(await call);
      toast(done);
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
      throw err;
    }
  };

  const create = () =>
    run(api('/messages', { method: 'POST', body: { text, intervalMinutes: interval } }), 'Mensaje creado').then(
      () => setText(''),
      () => {}
    );

  return (
    <>
      <PageHeader
        title="Mensajes automáticos"
        subtitle="El aviso dorado del centro de la pantalla, cada cierto tiempo, para todos los que están en el juego. Los cambios llegan en unos 15 segundos, sin reiniciar nada."
      />

      <Card title="Nuevo mensaje">
        <Preview text={text.trim()} />
        <div className="message-new">
          <input
            value={text}
            maxLength={TEXT_MAX}
            placeholder="Ej.: Bienvenidos a Mu La Ronda! Escribí /comandos para ver todos los comandos."
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && text.trim() && create()}
          />
          <IntervalSelect value={interval} onChange={setIntervalMinutes} />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={create}>
            Agregar
          </button>
        </div>
        <p className="muted small">
          {text.length}/{TEXT_MAX} caracteres. Los textos largos el juego los corta en dos renglones. Los acentos se ven bien; los emojis no.
        </p>
      </Card>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <Card title={`Programados (${data.filter(m => m.enabled).length} activos de ${data.length})`}>
          {data.length === 0 ? (
            <p className="muted">Todavía no hay mensajes.</p>
          ) : (
            <div className="message-list">
              {data.map(m => (
                <MessageRow
                  key={m.id}
                  message={m}
                  onChange={patch => run(api(`/messages/${m.id}`, { method: 'PATCH', body: patch }), 'Guardado').catch(() => {})}
                  onSendNow={() => run(api(`/messages/${m.id}/send`, { method: 'POST' }), 'Se manda en los próximos segundos').catch(() => {})}
                  onDelete={() => setDeleting(m)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {deleting && (
        <Confirm
          title="Borrar mensaje"
          text={`Se borra "${deleting.text}".`}
          confirmLabel="Borrar"
          danger
          onAnswer={yes => {
            const m = deleting;
            setDeleting(null);
            if (yes) void run(api(`/messages/${m.id}`, { method: 'DELETE' }), 'Mensaje borrado').catch(() => {});
          }}
        />
      )}
    </>
  );
}
