import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';

/** Small building blocks shared by every page. */

// ---- toasts -----------------------------------------------------------------

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(list => [...list, { id, text, kind }]);
    setTimeout(() => setToasts(list => list.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---- data loading -------------------------------------------------------------

/** Loads `load()` and reloads when `deps` change; `reload` forces it. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    load().then(
      value => {
        if (!live) return;
        setData(value);
        setError(null);
      },
      err => live && setError(err instanceof Error ? err.message : String(err))
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, reload: () => setTick(t => t + 1), setData };
}

/**
 * An editable copy of `source` that starts over whenever `source` changes
 * (a save returns fresh data) - without an effect copying it across.
 */
export function useDraft<S, D>(source: S | null, make: (s: S) => D) {
  const [state, setState] = useState<{ source: S | null; draft: D | null }>({ source: null, draft: null });
  const draft = source === null ? null : state.source === source ? (state.draft as D) : make(source);
  const update = (fn: (d: D) => D) => {
    if (source === null) return;
    setState({ source, draft: fn(draft ?? make(source)) });
  };
  const reset = () => setState({ source: null, draft: null });
  return [draft, update, reset] as const;
}

// ---- layout pieces --------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Loading() {
  return <div className="loading">Cargando…</div>;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <span>{error}</span>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// ---- form fields ------------------------------------------------------------------

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  disabled,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={e => onChange(e.target.value)} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={e => {
          const raw = e.target.value;
          const match = options.find(o => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map(o => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Lower case, no accents: what the combo box compares. */
const folded = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A select you type into: the list filters as you write (by any part of the
 * label, accents aside), arrows move, Enter picks, Escape gives up. For lists
 * too long for a plain <select> - the monsters, the maps.
 */
export function ComboField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Escribí para buscar…',
  hint,
  emptyLabel,
  limit = 60,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
  placeholder?: string;
  hint?: string;
  /** Offers "none" as the first choice, with this text. */
  emptyLabel?: string;
  limit?: number;
}) {
  const current = options.find(o => o.value === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const open = query !== null;

  useEffect(() => {
    listRef.current?.querySelector('.combo-option.active')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const words = folded(query ?? '').split(/\s+/).filter(Boolean);
  const matches = options.filter(o => {
    const text = folded(o.label);
    return words.every(w => text.includes(w));
  });
  const shown = matches.slice(0, limit);
  const choices: { value: T | null; label: string }[] = emptyLabel && !words.length ? [{ value: null, label: emptyLabel }, ...shown] : shown;

  const pick = (choice: { value: T | null } | undefined) => {
    if (choice) onChange(choice.value);
    setQuery(null);
  };

  return (
    <label className="field combo">
      <span className="field-label">{label}</span>
      <input
        value={open ? query : current?.label ?? ''}
        placeholder={current ? current.label : placeholder}
        onFocus={e => {
          setQuery('');
          setCursor(0);
          e.target.select();
        }}
        onBlur={() => setQuery(null)}
        onChange={e => {
          setQuery(e.target.value);
          setCursor(0);
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') setCursor(c => Math.min(c + 1, choices.length - 1));
          else if (e.key === 'ArrowUp') setCursor(c => Math.max(c - 1, 0));
          else if (e.key === 'Enter') pick(choices[cursor]);
          else if (e.key === 'Escape') setQuery(null);
          else return;
          e.preventDefault();
          if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
      />
      {open && (
        <div className="combo-list" role="listbox" ref={listRef}>
          {choices.map((o, i) => (
            <button
              type="button"
              key={String(o.value)}
              className={`combo-option ${i === cursor ? 'active' : ''} ${o.value === value ? 'chosen' : ''}`}
              // Before the input's blur closes the list.
              onMouseDown={e => {
                e.preventDefault();
                pick(o);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              onMouseEnter={() => setCursor(i)}
            >
              {o.label}
            </button>
          ))}
          {!choices.length && <span className="combo-empty">Nada coincide</span>}
          {matches.length > shown.length && <span className="combo-empty">y {matches.length - shown.length} más: seguí escribiendo</span>}
        </div>
      )}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-text">
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden />
    </label>
  );
}

// ---- confirm dialog ---------------------------------------------------------------

export function Confirm({
  title,
  text,
  confirmLabel = 'Confirmar',
  danger,
  onAnswer,
}: {
  title: string;
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  onAnswer: (yes: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onAnswer(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <div className="modal-backdrop" onMouseDown={() => onAnswer(false)}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => onAnswer(false)}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onAnswer(true)} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const formatNumber = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-AR'));
export const formatDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const CHARACTER_STATUS: Record<number, { label: string; tone: 'neutral' | 'accent' | 'bad' }> = {
  0: { label: 'Normal', tone: 'neutral' },
  1: { label: 'Baneado', tone: 'bad' },
  32: { label: 'Game Master', tone: 'accent' },
};

export const ACCOUNT_STATE: Record<number, { label: string; tone: 'neutral' | 'accent' | 'bad' | 'warn' }> = {
  0: { label: 'Normal', tone: 'neutral' },
  1: { label: 'Espectador', tone: 'neutral' },
  2: { label: 'Game Master', tone: 'accent' },
  3: { label: 'GM invisible', tone: 'accent' },
  4: { label: 'Baneada', tone: 'bad' },
  5: { label: 'Baneo temporal', tone: 'warn' },
};

// ---- error boundary -----------------------------------------------------------------


/** A page or card that throws while rendering shows this instead of blanking the panel. */
export class Boundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('panel:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return <ErrorBox error={`Algo falló al mostrar esta sección: ${this.state.error.message}`} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
