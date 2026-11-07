import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BODY_EN, STUDIO_STYLES } from '../../data/constants';
import { DICT, LangCtx, initialLang, sizeLabel, useT } from '../../lib/i18n';
import { waitInfo } from '../../lib/queue';
import { flashName } from '../../lib/rules';
import type { Flash, Lang, PublicLive, Ticket, TicketStatus } from '../../lib/types';
import { brl, waLink } from '../../lib/util';
import { Logo, QR, Thumb, flashAlt, useToast } from '../../components/ui';
import { useBackend, usePublic, useTicket } from '../../store';
import { Catalog, ClientForm } from './ClientFlow';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => {
    setLangS(l);
    try {
      localStorage.setItem('a2-lang', l);
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  }, [lang]);
  return <LangCtx.Provider value={{ lang, t: DICT[lang], setLang }}>{children}</LangCtx.Provider>;
}

export function LangToggle() {
  const { lang, t, setLang } = useT();
  return (
    <button className="langbtn" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')} lang={lang === 'pt' ? 'en' : 'pt'} aria-label={lang === 'pt' ? 'Switch to English' : 'Mudar para português'}>
      {t.switchTo}
    </button>
  );
}

function ClientTop({ title, onBack }: { title?: string; onBack?: () => void }) {
  const { t } = useT();
  return (
    <header className="topbar">
      <div className="in" style={{ maxWidth: 1120 }}>
        {onBack ? <button className="iconbtn" onClick={onBack} aria-label={t.back}>←</button> : <Logo size={64} word={false} />}
        <h1 className="serif">{title || ''}</h1>
        <LangToggle />
      </div>
    </header>
  );
}

const MY = 'a2-my';
const readMy = (): { id: string; eventId: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(MY) || 'null');
  } catch {
    return null;
  }
};

/** Tela que abre no QR code. Sem login e sem instalar nada. */
export default function ClientePage() {
  return (
    <LangProvider>
      <ClienteInner />
    </LangProvider>
  );
}

function ClienteInner() {
  const { t } = useT();
  const b = useBackend();
  const pub = usePublic();
  const [my, setMy] = useState(readMy);
  const ticket = useTicket(my?.id || null);
  const [step, setStep] = useState<'home' | 'catalog' | 'form'>('home');
  const [pick, setPick] = useState<Flash | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (pub === undefined) return <Loading />;
  const active = ticket && pub && ticket.eventId === pub.eventId && ticket.status !== 'cancelado' && step === 'home';
  if (active) return <ClientStatus t={ticket} p={pub} onCatalog={() => setStep('catalog')} onNew={() => { localStorage.removeItem(MY); setMy(null); }} />;

  if (!pub || !pub.open)
    return (
      <>
        <ClientTop />
        <main className="page narrow" id="main">
          <div className="hero"><Logo size={170} /></div>
          <div className="card center" style={{ marginTop: 28 }}><p className="big">{t.noEvent}</p><p className="muted">{t.noEventSub}</p></div>
          <p className="center muted" style={{ marginTop: 24, letterSpacing: '.2em' }}>{t.tagline.toUpperCase()}</p>
        </main>
      </>
    );

  if (step === 'catalog')
    return (
      <>
        <ClientTop title={t.catalog} onBack={() => setStep('home')} />
        <main className="page" id="main"><Catalog pub={pub} onPick={(f) => { setPick(f); setStep('form'); }} /></main>
      </>
    );
  if (step === 'form' && pick)
    return (
      <>
        <ClientTop title={t.yourForm} onBack={() => setStep('catalog')} />
        <main className="page narrow" id="main">
          <ClientForm pick={pick} eventId={pub.eventId} onBack={() => setStep('catalog')} submit={(i) => b.submitTicket(i)}
            onDone={(r) => {
              const m = { id: r.id, eventId: pub.eventId };
              localStorage.setItem(MY, JSON.stringify(m));
              setMy(m);
              setPick(null);
              setStep('home');
            }} />
        </main>
      </>
    );
  return (
    <>
      <ClientTop />
      <main className="page narrow" id="main">
        <div className="hero"><Logo size={170} /></div>
        <p className="serif center" style={{ fontSize: 28, margin: '24px 0 4px' }}>{pub.name}</p>
        <p className="center muted" style={{ margin: 0 }}>{pub.venue} · {t.until} {pub.end}</p>
        <ol className="steps">
          <li><span><b>{t.step1}</b><br /><span className="muted">{t.step1sub}</span></span></li>
          <li><span><b>{t.step2}</b><br /><span className="muted">{t.step2sub}</span></span></li>
          <li><span><b>{t.step3}</b><br /><span className="muted">{t.step3sub}</span></span></li>
          <li><span><b>{t.step4}</b><br /><span className="muted">{t.step4sub} {t.queueNow(pub.waiting?.length || 0)}</span></span></li>
        </ol>
        <button className="btn block lg" onClick={() => setStep('catalog')}>{t.seeCatalog}</button>
        <p className="center muted" style={{ marginTop: 28, letterSpacing: '.2em' }}>{t.tagline.toUpperCase()}</p>
      </main>
    </>
  );
}

function Loading() {
  return <main className="page narrow"><div className="hero" style={{ paddingTop: '28vh' }}><Logo size={150} /><p className="muted" style={{ marginTop: 24 }}>Carregando… · Loading…</p></div></main>;
}

export function statusText(t: Pick<Ticket, 'status' | 'table'>, d: (typeof DICT)['pt']) {
  const m: Record<TicketStatus, string> = {
    aguardando_pagamento: d.stPay, na_fila: d.stQueue, chamado: d.stCalled(t.table || 0), em_atendimento: d.stDoing, concluido: d.stDone, cancelado: d.stCancel,
  };
  return m[t.status];
}

let actx: AudioContext | null = null;
function beep(vol = 0.3) {
  try {
    actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = 880;
    o.connect(g);
    g.connect(actx.destination);
    const n = actx.currentTime;
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), n + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, n + 0.5);
    o.start(n);
    o.stop(n + 0.55);
  } catch {
    /* sem áudio */
  }
}

function ClientStatus({ t, p, onCatalog, onNew }: { t: Ticket; p: PublicLive; onCatalog: () => void; onNew: () => void }) {
  const { t: d, lang } = useT();
  const toast = useToast();
  const [alertsOn, setAlertsOn] = useState(false);
  const [dismissed, setDismissed] = useState<string>('');
  const lastCall = useRef('');
  const { pos, wait } = waitInfo(p, t.code);
  const order: TicketStatus[] = ['aguardando_pagamento', 'na_fila', 'chamado', 'em_atendimento', 'concluido'];
  const i = order.indexOf(t.status);
  const callKey = t.id + ':' + t.calledAt;

  useEffect(() => {
    if (t.status !== 'chamado') return;
    if (lastCall.current === callKey) return;
    const firstLoad = !lastCall.current;
    lastCall.current = callKey;
    if (firstLoad && Date.now() - (t.calledAt || 0) > 120000) return;
    beep();
    setTimeout(beep, 700);
    setTimeout(beep, 1400);
    try {
      navigator.vibrate?.([300, 150, 300, 150, 600]);
    } catch {
      /* ignore */
    }
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(d.notifTitle, { body: d.notifBody(t.table || 0, t.code) });
    } catch {
      /* ignore */
    }
  }, [t.status, callKey, t.calledAt, t.table, t.code, d]);

  const li = (k: TicketStatus, txt: string, sub?: string) => {
    const j = order.indexOf(k);
    return (
      <li className={j < i ? 'done' : j === i ? 'now' : ''} aria-current={j === i ? 'step' : undefined}>
        <i aria-hidden="true" />
        <span>{txt}{j === i && sub ? <><br /><span style={{ fontWeight: 400 }}>{sub}</span></> : null}</span>
      </li>
    );
  };
  const enable = async () => {
    setAlertsOn(true);
    beep(0.001);
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    } catch {
      /* ignore */
    }
    try {
      navigator.vibrate?.(60);
    } catch {
      /* ignore */
    }
    toast(d.ready);
  };

  return (
    <>
      <ClientTop />
      <main className="page narrow" id="main">
        <p className="center muted" style={{ margin: '24px 0 0' }}>{d.yourCode}</p>
        <div className="bigcode" aria-label={`${d.yourCode}: ${t.code.split('').join(' ')}`}>{t.code}</div>
        <p className="status-line" role="status" aria-live="assertive">{statusText(t, d)}</p>
        {t.status === 'chamado' && (
          <div className="card hi center" style={{ marginTop: 16 }}>
            <p className="serif" style={{ fontSize: 28, margin: 0 }}>{d.yourTurn}</p>
            <p className="big" style={{ margin: '4px 0 0' }}>{d.goTo} <b>{d.table(t.table || '')}</b>.</p>
          </div>
        )}
        <ul className="timeline">
          {li('aguardando_pagamento', d.tlSent, d.tlSentSub)}
          {li('na_fila', d.tlQueue, pos ? d.tlQueueSub(pos, wait) : d.tlUpdating)}
          {li('chamado', d.tlCalled, d.table(t.table || ''))}
          {li('em_atendimento', d.tlDoing)}
          {li('concluido', d.tlDone)}
        </ul>
        <div className="card row">
          <Thumb flash={t.flash} size={64} alt={flashAlt(t.flash.sheet, t.flash.n, t.flash.size, lang)} />
          <div className="grow"><b>{flashName(t.flash).replace(/· [PMG]$/, '· ' + sizeLabel(lang, t.flash.size))}</b><br />{brl(t.flash?.price)} · {lang === 'en' ? BODY_EN[t.bodyPart] || t.bodyPart : t.bodyPart}</div>
        </div>
        {['na_fila', 'aguardando_pagamento'].includes(t.status) && (
          <>
            <button className="btn ghost block" style={{ marginTop: 16 }} onClick={enable} aria-pressed={alertsOn}>{alertsOn ? d.alertsOn : d.alertsOff}</button>
            <p className="center muted">{d.keepOpen}</p>
          </>
        )}
        {t.status === 'concluido' && (
          <>
            <h2 className="h2">{d.careTitle}</h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>{d.care.map((c) => <li key={c} style={{ margin: '6px 0' }}>{c}</li>)}</ul>
            <p className="muted">{d.careWa}</p>
            <h2 className="h2">{d.nextTitle}</h2>
            {p.whatsapp ? (
              <div className="chips wrap">
                {STUDIO_STYLES.map((s) => (
                  <a key={s} className="chip" target="_blank" rel="noopener"
                    href={waLink(p.whatsapp, lang === 'en' ? `Hi! I got flash ${t.code} at ${p.name} and want a quote for a ${s.toLowerCase()} tattoo at the studio.` : `Oi! Fiz a flash ${t.code} no ${p.name} e quero orçar uma tattoo de ${s.toLowerCase()} no estúdio.`)}>
                    {s}
                  </a>
                ))}
              </div>
            ) : <p className="muted">{STUDIO_STYLES.join(' · ')}</p>}
            <p className="muted" style={{ marginTop: 16 }}>{d.another}</p>
          </>
        )}
        <p className="center" style={{ marginTop: 20 }}>
          <button className="link" onClick={onCatalog}>{d.seeCatalog}</button>
          {t.status === 'concluido' && <> · <button className="link" onClick={onNew}>{d.newOrder}</button></>}
        </p>
      </main>
      {t.status === 'chamado' && dismissed !== callKey && (
        <div className="callout" role="alertdialog" aria-modal="true" aria-labelledby="call-t">
          <Logo size={110} word={false} />
          <p className="t" id="call-t">{d.yourTurn}</p>
          <p style={{ fontSize: 24, margin: 0 }}>{d.goTo} <b>{d.table(t.table || '')}</b></p>
          <p className="code" style={{ fontSize: 48, margin: '8px 0' }}>{t.code}</p>
          <button className="btn lg" autoFocus onClick={() => setDismissed(callKey)}>{d.imGoing}</button>
        </div>
      )}
    </>
  );
}

/** Telão do stand: chamadas e fila, sem dados pessoais. */
export function TelaoPage() {
  return (
    <LangProvider>
      <TelaoInner />
    </LangProvider>
  );
}
function TelaoInner() {
  const p = usePublic();
  const { t } = useT();
  const url = clientUrl();
  if (!p || !p.open)
    return (
      <div className="tv" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div><Logo size={260} /><p className="muted" style={{ marginTop: 28, letterSpacing: '.2em' }}>{t.tagline.toUpperCase()}</p></div>
      </div>
    );
  return (
    <div className="tv">
      <section aria-live="polite">
        <h2>{t.calling}</h2>
        {p.called.slice(0, 5).map((c) => (
          <div className="called" key={c.code + c.at}><span className="code">{c.code}</span><span className="tb">{t.table(c.table)}</span></div>
        ))}
        {!p.called.length && <p className="muted">{t.nobodyCalled}</p>}
      </section>
      <section>
        <h2>{t.next}</h2>
        <div className="wait">{p.waiting.slice(0, 18).map((c) => <span key={c}>{c}</span>)}{!p.waiting.length && <span style={{ border: 0, fontFamily: 'var(--sans)', fontSize: 20 }} className="muted">{t.freeQueue}</span>}</div>
        <div className="row" style={{ marginTop: 40, gap: 20 }}>
          <QRBlock url={url} />
          <div><p className="serif" style={{ fontSize: 28, margin: 0 }}>{t.step1}</p><p className="muted" style={{ margin: '4px 0 0' }}>{t.pointCamera}</p></div>
        </div>
        <div style={{ marginTop: 40, color: 'var(--c-white)' }}><Logo size={120} /></div>
      </section>
    </div>
  );
}
function QRBlock({ url }: { url: string }) {
  return <QR text={url} size={160} label="QR code do catálogo" />;
}
export function clientUrl(publicUrl?: string) {
  const base = (publicUrl || '').trim().replace(/\/+$/, '') || location.origin;
  return base + '/cliente';
}
