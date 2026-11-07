import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Shell, TopBar } from '../../components/Shell';
import { Logo } from '../../components/ui';
import { DICT, LangCtx, useT } from '../../lib/i18n';
import type { DeskData, Flash } from '../../lib/types';
import { fmtDLong } from '../../lib/util';
import { getPin, setPin, useBackend, useDesk } from '../../store';
import { Catalog, ClientForm } from '../cliente/ClientFlow';
import { LangToggle } from '../cliente/ClientePage';
import { LiveBoard, MesaView } from '../live/Live';
import { deskSource, type LiveSource } from '../live/source';

const ITEMS = [
  { to: '/atendimento', label: 'Hoje', icon: 'hoje', end: true },
  { to: '/atendimento/novo', label: 'Novo cliente', icon: 'novo' },
  { to: '/atendimento/mesa', label: 'Mesa', icon: 'mesa' },
];

/** Acesso do atendimento: só o evento aberto hoje. Sem agenda, orçamento, contratos nem equipe. */
export default function Atendimento() {
  const b = useBackend();
  const nav = useNavigate();
  const pin = getPin();
  const data = useDesk(pin);
  if (!pin) return <Navigate to="/" replace />;
  const exit = () => {
    setPin(null);
    nav('/');
  };
  if (data === undefined) return <main className="page"><div className="hero" style={{ paddingTop: '28vh' }}><Logo size={150} /><p className="muted">Carregando…</p></div></main>;
  const src = deskSource(b, data, pin);
  return (
    <Shell items={ITEMS} badge="Atendimento" onExit={exit}>
      {!data ? (
        <>
          <TopBar title="Hoje" right={<button className="link" onClick={exit}>Sair</button>} />
          <main className="page narrow" id="main">
            <div className="card" style={{ marginTop: 20 }}>
              <p className="big">Nenhum evento aberto hoje.</p>
              <p className="muted">Peça para a gestão abrir o evento de hoje. Se o PIN mudou, saia e entre de novo.</p>
            </div>
          </main>
        </>
      ) : (
        <Routes>
          <Route index element={<DeskHoje src={src} d={data} exit={exit} />} />
          <Route path="novo" element={<DeskNovo src={src} d={data} />} />
          <Route path="mesa" element={<><TopBar title="Mesa" /><main className="page" id="main"><p className="muted" style={{ marginTop: 12 }}>{data.event.name}</p><MesaView src={src} /></main></>} />
          <Route path="*" element={<Navigate to="/atendimento" replace />} />
        </Routes>
      )}
    </Shell>
  );
}

function DeskHoje({ src, d, exit }: { src: LiveSource; d: DeskData; exit: () => void }) {
  return (
    <>
      <TopBar title="Hoje" right={<button className="link mobile-only" onClick={exit}>Sair</button>} />
      <main className="page" id="main">
        <p style={{ margin: '12px 0 0' }}><b>{d.event.name}</b> <span className="muted">· {fmtDLong(d.event.date)} · {d.event.start}–{d.event.end} · {d.event.venue}</span></p>
        <LiveBoard src={src} mesaHref="/atendimento/mesa" />
      </main>
    </>
  );
}

/** O atendente preenche a ficha completa pelo cliente, num tablet. */
function DeskNovo({ src, d }: { src: LiveSource; d: DeskData }) {
  const [lang, setLang] = useState<'pt' | 'en'>('pt');
  const [pick, setPick] = useState<Flash | null>(null);
  const [done, setDone] = useState<{ code: string } | null>(null);
  const [k, setK] = useState(0);
  const pub = { eventId: d.event.id, cats: d.event.cats, prices: d.settings.prices };
  const reset = () => {
    setPick(null);
    setDone(null);
    setK(k + 1);
    window.scrollTo(0, 0);
  };
  return (
    <LangCtx.Provider value={{ lang, t: DICT[lang], setLang }}>
      <TopBar title={pick && !done ? 'Ficha do cliente' : 'Novo cliente'} back={pick && !done ? () => setPick(null) : undefined} right={<LangToggle />} />
      <main className="page" id="main" key={k}>
        {done ? (
          <div className="card center" style={{ marginTop: 24, maxWidth: 560, marginInline: 'auto' }} role="status">
            <p className="muted">Código do cliente</p>
            <div className="bigcode">{done.code}</div>
            <p className="big">Ficha enviada. O pedido já aparece em Hoje.</p>
            <button className="btn block lg" style={{ marginTop: 16 }} onClick={reset}>Próximo cliente</button>
          </div>
        ) : !pick ? (
          <>
            <p className="note" style={{ marginTop: 12 }}>Para quem não usa celular: escolha o desenho com o cliente e preencha a ficha junto com ele.</p>
            <Catalog pub={pub} onPick={setPick} />
          </>
        ) : (
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <Hint />
            <ClientForm tablet pick={pick} eventId={d.event.id} onBack={() => setPick(null)} submit={(i) => src.submit(i)} onDone={(r) => setDone(r)} />
          </div>
        )}
      </main>
    </LangCtx.Provider>
  );
}
function Hint() {
  const { t } = useT();
  return <p className="tag quiet" style={{ marginTop: 12 }}>{t.fillForClient}</p>;
}
