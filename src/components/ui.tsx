import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode,
} from 'react';
import QRCode from 'qrcode';
import { CELLS, SHEET_META, sheetUrl } from '../data/catalog';
import { IMG_H, IMG_W } from '../data/constants';
import type { Flash } from '../lib/types';

/* ---------- Logo (prancha da marca: “A2” serifado cortado por um traço fino) ---------- */
export function Logo({ size = 120, word = true, label = true }: { size?: number; word?: boolean; label?: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}
      role={label ? 'img' : undefined} aria-label={label ? 'A2 Tattoo Studio' : undefined} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size * 0.56} viewBox="0 0 250 140" aria-hidden="true" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.22" stopColor="currentColor" stopOpacity="1" />
            <stop offset="0.8" stopColor="currentColor" stopOpacity="1" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <text x="125" y="118" textAnchor="middle" fill="currentColor"
          style={{ fontFamily: 'var(--serif)', fontSize: 136, fontWeight: 500, letterSpacing: '-10px' }}>A2</text>
        <path d="M0 92 L250 85.5 L250 87.4 L0 94.6 Z" fill={`url(#${gid})`} />
      </svg>
      {word && (
        <span style={{ fontFamily: 'var(--sans)', fontSize: Math.max(16, size * 0.13), letterSpacing: size < 170 ? '0.2em' : '0.34em',
          paddingLeft: size < 170 ? '0.2em' : '0.34em', marginTop: size * 0.1, fontWeight: 400, whiteSpace: 'nowrap' }}>TATTOO STUDIO</span>
      )}
    </span>
  );
}

/* ---------- Ícones da navegação ---------- */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
export const ICON: Record<string, ReactNode> = {
  agenda: <svg viewBox="0 0 24 24" {...P}><rect x="3.5" y="5" width="17" height="15" rx="1" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  hoje: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></svg>,
  pos: <svg viewBox="0 0 24 24" {...P}><path d="M4 18l3-3h11a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" /><path d="M8.5 9.5l2 2 4-4" /></svg>,
  equipe: <svg viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14.5a5 5 0 0 1 3 4.5" /></svg>,
  ajustes: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></svg>,
  novo: <svg viewBox="0 0 24 24" {...P}><rect x="4" y="3.5" width="16" height="17" rx="1" /><path d="M12 8v8M8 12h8" /></svg>,
  mesa: <svg viewBox="0 0 24 24" {...P}><path d="M3 9h18M5 9v10M19 9v10M8 5h8l2 4H6z" /></svg>,
  telao: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></svg>,
  sair: <svg viewBox="0 0 24 24" {...P}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>,
};

/* ---------- Recorte de um desenho da prancha ---------- */
export function FlashCrop({ sheet, n, alt }: { sheet: number; n: number; alt?: string }) {
  const c = CELLS[sheet]?.[n - 1] || CELLS[sheet]?.[0] || [0, 0, 1, 1];
  const w = c[2] - c[0];
  const h = c[3] - c[1];
  const ar = (w * IMG_W) / (h * IMG_H);
  const bp = `${w >= 1 ? 0 : ((c[0] / (1 - w)) * 100).toFixed(2)}% ${h >= 1 ? 0 : ((c[1] / (1 - h)) * 100).toFixed(2)}%`;
  return (
    <span className="crop" role="img" aria-label={alt || `${SHEET_META[sheet]?.[0]} nº ${n}`}
      style={{
        [ar >= 1 ? 'width' : 'height']: '100%', aspectRatio: ar.toFixed(3),
        backgroundImage: `url(${sheetUrl(sheet)})`,
        backgroundSize: `${(100 / w).toFixed(2)}% ${(100 / h).toFixed(2)}%`, backgroundPosition: bp,
      }} />
  );
}
export function Thumb({ flash, size = 56, alt }: { flash?: Partial<Flash> | null; size?: number; alt?: string }) {
  if (!flash || flash.sheet == null) return null;
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      <FlashCrop sheet={flash.sheet} n={flash.n || 1} alt={alt} />
    </span>
  );
}
/** Texto alternativo: “Borboletas nº 05, traço fino, 5 a 8 cm”. */
export function flashAlt(sheet: number, n: number, size?: string, lang: 'pt' | 'en' = 'pt') {
  const meta = SHEET_META[sheet];
  const tier = meta?.[2] === 'D' ? (lang === 'en' ? 'detailed' : 'detalhada') : lang === 'en' ? 'fine line' : 'traço fino';
  const cm = size
    ? (lang === 'en' ? { P: 'up to 5 cm', M: '5 to 8 cm', G: '8 to 12 cm' } : { P: 'até 5 cm', M: '5 a 8 cm', G: '8 a 12 cm' })[size as 'P']
    : '';
  return `${meta?.[0]} nº ${String(n).padStart(2, '0')}, ${tier}${cm ? ', ' + cm : ''}`;
}

/* ---------- QR code (gerado no próprio aparelho) ---------- */
export function QR({ text, size = 220, label }: { text: string; size?: number; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: '#0A0A0A', light: '#FFFFFF' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [text, size]);
  return (
    <span className="qr">
      {src ? <img src={src} width={size} height={size} alt={label} /> : <span style={{ color: '#0A0A0A' }}>…</span>}
    </span>
  );
}

/* ---------- Toast ---------- */
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!msg}>{msg}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hid = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const f = el?.querySelector<HTMLElement>('[autofocus], input, select, textarea, button:not([data-close])');
    (f || el)?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const items = el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]');
        if (!items.length) return;
        const a = items[0];
        const z = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={hid} ref={ref} tabIndex={-1}>
        <div className="row" style={{ marginBottom: 4 }}>
          <h2 id={hid} className="grow">{title}</h2>
          <button className="iconbtn" data-close onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Campos com rótulo visível e erro em texto ---------- */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (p: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId();
  const desc = [error ? id + 'e' : '', hint ? id + 'h' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label className="lbl" htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': desc })}
      {hint && <span className="hint" id={id + 'h'}>{hint}</span>}
      {error && <span className="err" id={id + 'e'}>{error}</span>}
    </div>
  );
}

/** Campo que salva ao sair (não a cada tecla). */
export function SaveInput({ label, value, onSave, type = 'text', hint, inputMode, placeholder, multiline, min, max }: {
  label: string; value: string | number | null | undefined; onSave: (v: string) => void; type?: string; hint?: string;
  inputMode?: 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'text'; placeholder?: string; multiline?: boolean; min?: number; max?: number;
}) {
  const [v, setV] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(value == null ? '' : String(value));
  }, [value]);
  const commit = () => {
    focused.current = false;
    if (v !== (value == null ? '' : String(value))) onSave(v);
  };
  return (
    <Field label={label} hint={hint}>
      {(p) =>
        multiline ? (
          <textarea className="inp" {...p} value={v} placeholder={placeholder} onFocus={() => (focused.current = true)}
            onChange={(e) => setV(e.target.value)} onBlur={commit} />
        ) : (
          <input className="inp" {...p} type={type} value={v} inputMode={inputMode} placeholder={placeholder} min={min} max={max}
            onFocus={() => (focused.current = true)} onChange={(e) => setV(e.target.value)} onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        )
      }
    </Field>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Chips<T extends string>({ options, value, onChange, label, labels, multi }: {
  options: T[]; value: T | T[]; onChange: (v: T) => void; label: string; labels?: Record<string, string>; multi?: boolean;
}) {
  const on = (o: T) => (multi ? (value as T[]).includes(o) : value === o);
  return (
    <div className="chips wrap" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o} className="chip" aria-pressed={on(o)} onClick={() => onChange(o)}>
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

/** Ação que pede um segundo toque para confirmar. */
export function useConfirm2() {
  const [armed, setArmed] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (key: string, msg: string) => {
    if (armed === key) {
      setArmed(null);
      return true;
    }
    setArmed(key);
    toast(msg);
    return false;
  };
}

export async function copyText(t: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(t);
    toast('Copiado.');
  } catch {
    toast('Não deu para copiar. Selecione o texto e copie.');
  }
}

export function TextModal({ title, text, note, phone, onClose }: { title: string; text: string; note?: string; phone?: string | null; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal title={title} onClose={onClose}>
      <Field label="Texto">{(p) => <textarea className="inp" {...p} style={{ minHeight: 280 }} readOnly value={text} />}</Field>
      {note && <p className="muted">{note}</p>}
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => copyText(text, toast)}>Copiar</button>
        {phone !== undefined && (
          <a className="btn ghost" target="_blank" rel="noopener"
            href={phone ? `https://wa.me/${phone.length <= 11 ? '55' + phone : phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`}>
            Enviar no WhatsApp
          </a>
        )}
      </div>
    </Modal>
  );
}
