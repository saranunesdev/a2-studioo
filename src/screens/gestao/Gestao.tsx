import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Shell, TopBar } from '../../components/Shell';
import {
  Chips, Field, Logo, Modal, QR, SaveInput, Thumb, copyText, useConfirm2, useToast,
} from '../../components/ui';
import {
  CARE_DAYS, EVENT_TYPES, LANGS, LEVELS, ROLES, STAGE_L, STEPS, STUDIO_STYLES, TYPE_CATS, WDL,
} from '../../data/constants';
import { careDue, careMsg, estTattoos, evProgress, makeChecklist, nextCare, teamCount } from '../../lib/rules';
import { queueOf } from '../../lib/queue';
import type { AllData, Artist, EventDoc, Role } from '../../lib/types';
import {
  addDays, diffDays, digits, fmtD, fmtDLong, fmtPhone, parseBlocked, parseD, pad, today, tsKey, uid, waLink, wdOf,
} from '../../lib/util';
import { authErrorText } from '../../lib/authErrors';
import { useAll, useBackend } from '../../store';
import { SEED_PIN } from '../../store/seed';
import { clientUrl } from '../cliente/ClientePage';
import { LiveBoard, MesaView } from '../live/Live';
import { ownerSource } from '../live/source';
import EventoPage from './Evento';
import { nest, useOps } from './ops';

const ITEMS = [
  { to: '/painel', label: 'Agenda', icon: 'agenda', end: true },
  { to: '/painel/hoje', label: 'Hoje', icon: 'hoje' },
  { to: '/painel/pos', label: 'Pós', icon: 'pos' },
  { to: '/painel/equipe', label: 'Equipe', icon: 'equipe' },
  { to: '/painel/ajustes', label: 'Ajustes', icon: 'ajustes' },
];

export default function Gestao() {
  const b = useBackend();
  const nav = useNavigate();
  const [ok, setOk] = useState<boolean | null>(null);
  const all = useAll();
  useEffect(() => {
    b.ownerSignedIn().then(setOk);
  }, [b]);
  if (ok === false) return <Navigate to="/" replace />;
  if (ok === null || all === undefined)
    return <main className="page"><div className="hero" style={{ paddingTop: '28vh' }}><Logo size={150} /><p className="muted">Carregando…</p></div></main>;
  if (all === null)
    return (
      <main className="page narrow"><div className="card" style={{ marginTop: 40 }}>
        <p className="big">Não deu para carregar os dados.</p>
        <p className="muted">Confira a internet. Se o seu e-mail não estiver liberado na gestão, peça para a dona do estúdio incluir.</p>
        <button className="btn" onClick={() => b.signOut().then(() => nav('/'))}>Sair</button>
      </div></main>
    );
  const exit = () => b.signOut().then(() => nav('/'));
  return (
    <Shell items={ITEMS} badge={b.mode === 'local' ? 'Demonstração' : 'Gestão'} onExit={exit}>
      <Routes>
        <Route index element={<Agenda all={all} />} />
        <Route path="hoje" element={<Hoje all={all} />} />
        <Route path="mesa" element={<OwnerMesa all={all} />} />
        <Route path="pos" element={<Pos all={all} />} />
        <Route path="equipe" element={<Equipe all={all} />} />
        <Route path="ajustes" element={<Ajustes all={all} exit={exit} />} />
        <Route path="evento/:id/:tab?" element={<EventoPage all={all} />} />
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Routes>
    </Shell>
  );
}

/* ---------- Agenda ---------- */
function Agenda({ all }: { all: AllData }) {
  const nav = useNavigate();
  const [f, setF] = useState<'proximos' | 'passados' | 'todos'>('proximos');
  const [newEv, setNewEv] = useState(false);
  const t0 = today();
  let evs = [...all.events].sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
  if (f === 'proximos') evs = evs.filter((e) => e.date >= t0);
  else if (f === 'passados') evs = evs.filter((e) => e.date < t0).reverse();
  const live = all.settings.liveEventId ? all.events.find((e) => e.id === all.settings.liveEventId) : undefined;
  const pend = all.events.filter((e) => e.date < t0 && e.stage !== 'fechado');
  const due = careDue(all.tickets, t0);
  const groups: [string, EventDoc[]][] = [];
  for (const e of evs) {
    const m = parseD(e.date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const g = groups.find((x) => x[0] === m);
    if (g) g[1].push(e);
    else groups.push([m, [e]]);
  }
  return (
    <>
      <TopBar title="Agenda" />
      <main className="page" id="main">
        {live && (
          <Link className="card tap row" to="/painel/hoje" style={{ marginTop: 16, display: 'flex', textDecoration: 'none' }}>
            <span className="tag solid">Hoje</span>
            <span className="grow"><b>{live.name}</b><br /><span className="muted">{queueOf(all.tickets, live.id).length} na fila · {all.tickets.filter((t) => t.eventId === live.id && t.status === 'concluido').length} tattoos prontas</span></span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
        {(pend.length > 0 || due > 0) && (
          <div className="list" style={{ marginTop: 12 }}>
            {pend.map((e) => (
              <Link key={e.id} className="item tap row" style={{ display: 'flex', textDecoration: 'none' }} to={`/painel/evento/${e.id}/fechamento`}>
                <span className="tag">Falta fechar</span><span className="grow">{e.name} · {fmtD(e.date)}</span><span aria-hidden="true">›</span>
              </Link>
            ))}
            {due > 0 && (
              <Link className="item tap row" style={{ display: 'flex', textDecoration: 'none' }} to="/painel/pos">
                <span className="tag solid">Pós</span><span className="grow">{due} mensage{due > 1 ? 'ns' : 'm'} de cuidado para enviar hoje</span><span aria-hidden="true">›</span>
              </Link>
            )}
          </div>
        )}
        <div className="row wrap" style={{ marginTop: 20 }}>
          <div className="seg grow" role="group" aria-label="Mostrar" style={{ maxWidth: 480 }}>
            {([['proximos', 'Próximos'], ['passados', 'Passados'], ['todos', 'Todos']] as const).map(([k, l]) => (
              <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
            ))}
          </div>
          <button className="btn desktop-only" onClick={() => setNewEv(true)}>+ Novo evento</button>
        </div>
        {!evs.length && (
          <div className="card center" style={{ marginTop: 16 }}>
            <p>Nenhum evento {f === 'passados' ? 'passado' : 'por aqui'} ainda.</p>
            <button className="btn" onClick={() => setNewEv(true)}>Criar evento</button>
          </div>
        )}
        {groups.map(([m, list]) => (
          <section key={m}>
            <h2 className="month">{m[0].toUpperCase() + m.slice(1)}</h2>
            <div className="cards">
              {list.map((e) => {
                const p = evProgress(e);
                const tat = teamCount(e, 'tatuador');
                const need = e.need?.tatuador || e.tables || 0;
                return (
                  <button key={e.id} className="card tap" onClick={() => nav(`/painel/evento/${e.id}`)}>
                    <div className="evrow">
                      <div className="date"><b>{pad(parseD(e.date).getUTCDate())}</b><span className="muted">{WDL[wdOf(e.date)]}</span></div>
                      <div className="grow">
                        <b style={{ lineHeight: 1.3, display: 'block' }}>{e.name}</b>
                        <span className="muted">{e.type} · {e.start}{e.end ? '–' + e.end : ''} · {e.venue || 'Local a definir'}</span>
                        <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
                          <span className={'tag' + (e.stage === 'fechado' ? ' quiet' : '')}>{STAGE_L[e.stage] || e.stage}</span>
                          <span className={'tag' + (tat < need && e.date >= t0 ? ' solid' : ' quiet')}>{tat}/{need} tatuadores{tat < need && e.date >= t0 ? ' · falta gente' : ''}</span>
                          {e.id === all.settings.liveEventId && <span className="tag solid">Hoje</span>}
                        </div>
                        <div className="bar" role="img" aria-label={`${p} de 8 etapas prontas`}><i style={{ width: `${(p / 8) * 100}%` }} /></div>
                        <span className="muted">{p} de 8 etapas</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </main>
      <button className="btn fab mobile-only" onClick={() => setNewEv(true)}>+ Novo evento</button>
      {newEv && <NewEventModal all={all} onClose={() => setNewEv(false)} />}
    </>
  );
}

function NewEventModal({ all, onClose }: { all: AllData; onClose: () => void }) {
  const ops = useOps();
  const nav = useNavigate();
  const [d, setD] = useState({ name: '', type: 'Casamento', date: addDays(today(), 14), start: '19:00', end: '23:00', venue: '', address: '', public: '', tables: '2', fee: '', pname: '', pphone: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const up = (p: Partial<typeof d>) => setD({ ...d, ...p });
  const create = async () => {
    const er: Record<string, string> = {};
    if (!d.name.trim()) er.name = 'Escreva o nome do evento.';
    if (!d.date) er.date = 'Escolha a data.';
    setErr(er);
    if (Object.keys(er).length) return;
    const id = 'e' + uid();
    const T = Math.max(1, Number(d.tables) || 1);
    const ev: Omit<EventDoc, 'id'> = {
      name: d.name.trim(), type: d.type, date: d.date, start: d.start, end: d.end, venue: d.venue, address: d.address, public: Number(d.public) || 0,
      tables: T, stage: 'negociacao', steps: Object.fromEntries(STEPS.map(([k]) => [k, { done: false, note: '' }])), team: [],
      need: { tatuador: T, atendimento: 1 }, partner: { name: d.pname, company: '', phone: digits(d.pphone) },
      budget: { fee: Number(d.fee) || 0, avgTicket: 210, conv: 6, costs: [{ id: 'k1', name: 'Transporte', value: 0 }, { id: 'k2', name: 'Alimentação da equipe', value: 0 }, { id: 'k3', name: 'Diária do atendimento', value: 0 }] },
      checklist: [], training: {}, tableState: Array.from({ length: T }, (_, i) => ({ n: i + 1, artistId: null, ticketId: null, paused: false })),
      cats: TYPE_CATS[d.type] || [], closing: { paid: {}, feeReceived: false, extra: [], closedAt: null }, notes: '', createdAt: Date.now(),
    };
    ev.checklist = makeChecklist(T, estTattoos(ev, all.settings.avgMin));
    if (await ops.putEvent(id, ev, 'Evento criado.')) {
      onClose();
      nav(`/painel/evento/${id}`);
    }
  };
  return (
    <Modal title="Novo evento" onClose={onClose}>
      <Field label="Nome do evento" error={err.name} hint="Ex.: Casamento Ana & Leo">{(p) => <input className="inp" {...p} autoFocus value={d.name} onChange={(e) => up({ name: e.target.value })} />}</Field>
      <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Tipo</p>
      <Chips label="Tipo" options={EVENT_TYPES} value={d.type} onChange={(v) => up({ type: v })} />
      <div className="form2">
        <Field label="Data" error={err.date}>{(p) => <input className="inp" {...p} type="date" value={d.date} onChange={(e) => up({ date: e.target.value })} />}</Field>
        <Field label="Mesas de tattoo">{(p) => <input className="inp" {...p} type="number" min={1} inputMode="numeric" value={d.tables} onChange={(e) => up({ tables: e.target.value })} />}</Field>
        <Field label="Início">{(p) => <input className="inp" {...p} type="time" value={d.start} onChange={(e) => up({ start: e.target.value })} />}</Field>
        <Field label="Fim">{(p) => <input className="inp" {...p} type="time" value={d.end} onChange={(e) => up({ end: e.target.value })} />}</Field>
      </div>
      <Field label="Local">{(p) => <input className="inp" {...p} value={d.venue} onChange={(e) => up({ venue: e.target.value })} />}</Field>
      <Field label="Endereço">{(p) => <input className="inp" {...p} value={d.address} onChange={(e) => up({ address: e.target.value })} />}</Field>
      <div className="form2">
        <Field label="Público estimado">{(p) => <input className="inp" {...p} type="number" inputMode="numeric" value={d.public} onChange={(e) => up({ public: e.target.value })} />}</Field>
        <Field label="Valor do contrato (R$)">{(p) => <input className="inp" {...p} type="number" inputMode="decimal" value={d.fee} onChange={(e) => up({ fee: e.target.value })} />}</Field>
        <Field label="Contato do parceiro">{(p) => <input className="inp" {...p} value={d.pname} onChange={(e) => up({ pname: e.target.value })} />}</Field>
        <Field label="WhatsApp do parceiro">{(p) => <input className="inp" {...p} type="tel" inputMode="tel" value={d.pphone} onChange={(e) => up({ pphone: e.target.value })} />}</Field>
      </div>
      <p className="muted">O checklist de materiais, as etapas e o orçamento são criados sozinhos.</p>
      <button className="btn block lg" onClick={create}>Criar evento</button>
    </Modal>
  );
}

/* ---------- Hoje ---------- */
export function QrModal({ all, onClose }: { all: AllData; onClose: () => void }) {
  const url = clientUrl(all.settings.publicUrl);
  const b = useBackend();
  return (
    <Modal title="QR code dos clientes" onClose={onClose}>
      <div className="center" style={{ margin: '16px 0' }}>
        <QR text={url} size={240} label={`QR code que abre ${url}`} />
        <p style={{ wordBreak: 'break-all' }}>{url}</p>
      </div>
      <p>Imprima e coloque no balcão e nas mesas. O cliente escolhe a flash, preenche a ficha e recebe o código para pagar. Não precisa de login nem de app.</p>
      {b.mode === 'local' && <p className="note">Modo demonstração: este QR só mostra os dados neste aparelho. Para outros celulares verem a fila, conecte o Supabase e publique o app (veja o README).</p>}
      {/localhost|127\.0\.0\.1/.test(url) && <p className="note">O endereço é “localhost”. Em Ajustes › Estúdio, preencha o link público do app para o QR abrir em outros celulares.</p>}
    </Modal>
  );
}

function Hoje({ all }: { all: AllData }) {
  const b = useBackend();
  const ops = useOps();
  const confirm2 = useConfirm2();
  const [qr, setQr] = useState(false);
  const e = all.settings.liveEventId ? all.events.find((x) => x.id === all.settings.liveEventId) : undefined;
  const t0 = today();
  const goLive = (id: string) => ops.patchSettings({ liveEventId: id }, 'Evento aberto para os clientes.');
  return (
    <>
      <TopBar title="Hoje" right={e ? <button className="btn ghost" onClick={() => setQr(true)}>QR dos clientes</button> : undefined} />
      <main className="page" id="main">
        {e ? (
          <>
            <p style={{ margin: '12px 0 0' }}><b>{e.name}</b> <span className="muted">· {fmtDLong(e.date)} · {e.venue}</span></p>
            <LiveBoard src={ownerSource(b, all)} mesaHref="/painel/mesa" />
            <button className="btn ghost block" style={{ marginTop: 32 }}
              onClick={() => confirm2('stop', 'Toque de novo para fechar o evento para novos pedidos.') && ops.patchSettings({ liveEventId: null }, 'Evento fechado para novos pedidos.')}>
              Fechar evento para novos pedidos
            </button>
          </>
        ) : (
          <>
            <div className="card" style={{ marginTop: 16 }}>
              <p className="big" style={{ marginTop: 0 }}>Nenhum evento aberto agora.</p>
              <p className="muted">Abra o evento de hoje para liberar o catálogo, a ficha e a fila pelo QR code. O atendimento também passa a ver o dia.</p>
            </div>
            <div className="list" style={{ marginTop: 12 }}>
              {all.events.filter((x) => x.date >= addDays(t0, -1)).sort((a, z) => a.date.localeCompare(z.date)).slice(0, 5).map((x) => (
                <div className="item row" key={x.id}>
                  <span className="grow"><b>{x.name}</b><br /><span className="muted">{x.date === t0 ? 'Hoje' : fmtD(x.date)} · {x.venue}</span></span>
                  <button className="btn" onClick={() => goLive(x.id)}>Abrir</button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      {qr && <QrModal all={all} onClose={() => setQr(false)} />}
    </>
  );
}

function OwnerMesa({ all }: { all: AllData }) {
  const b = useBackend();
  const nav = useNavigate();
  const src = ownerSource(b, all);
  return (
    <>
      <TopBar title="Mesa" back={() => nav('/painel/hoje')} />
      <main className="page" id="main">{src.data ? <MesaView src={src} /> : <div className="card" style={{ marginTop: 16 }}>Nenhum evento aberto. Abra o evento em Hoje.</div>}</main>
    </>
  );
}

/* ---------- Pós-tattoo ---------- */
function Pos({ all }: { all: AllData }) {
  const ops = useOps();
  const confirm2 = useConfirm2();
  const [f, setF] = useState<'hoje' | 'proximos' | 'feitos'>('hoje');
  const t0 = today();
  const rows = all.tickets.filter((t) => t.status === 'concluido' && t.doneAt && diffDays(tsKey(t.doneAt), t0) <= 21).map((t) => ({ t, nx: nextCare(t) }));
  const due = rows.filter((x) => x.nx && x.nx.date <= t0);
  const soon = rows.filter((x) => x.nx && x.nx.date > t0);
  const done = rows.filter((x) => !x.nx);
  const list = (f === 'hoje' ? due : f === 'proximos' ? soon : done).sort((a, b) => (a.nx?.date || 'z').localeCompare(b.nx?.date || 'z'));
  const evName = (id: string) => all.events.find((e) => e.id === id)?.name || '';
  const mark = (id: string, d: number, msg?: string) => ops.patchTicket(id, { care: { [d]: Date.now() } }, msg);
  return (
    <>
      <TopBar title="Pós-tattoo" />
      <main className="page" id="main">
        <p className="muted" style={{ marginTop: 12 }}>Mensagens de cuidado nos dias 1, 3, 7, 14 e 20 depois da tattoo. Toque em “Enviar” para abrir o WhatsApp com o texto pronto.</p>
        <div className="seg" role="group" aria-label="Mostrar" style={{ maxWidth: 640 }}>
          {([['hoje', `Para hoje (${due.length})`], ['proximos', `Próximos (${soon.length})`], ['feitos', `Concluídos (${done.length})`]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
        {!list.length ? <div className="card center" style={{ marginTop: 16 }}>{f === 'hoje' ? 'Tudo enviado por hoje.' : 'Nada por aqui.'}</div> : (
          <div className="cards" style={{ marginTop: 16 }}>
            {list.map(({ t, nx }) => {
              const late = nx && nx.date < t0 ? diffDays(nx.date, t0) : 0;
              const msg = nx ? careMsg(t, nx.d, all.settings.templates, evName(t.eventId)) : '';
              return (
                <div className="card" key={t.id}>
                  <div className="row">
                    <Thumb flash={t.flash} size={48} />
                    <div className="grow"><b>{t.name}</b><div className="muted">{evName(t.eventId)} · {fmtD(tsKey(t.doneAt!))}</div></div>
                    {nx ? <span className={'tag' + (late ? ' solid' : '')}>Dia {nx.d}{late ? ' · atrasada' : ''}</span> : <span className="tag quiet">Concluído</span>}
                  </div>
                  {nx && (
                    <>
                      <p style={{ color: 'var(--muted)' }}>{msg}</p>
                      <div className="row wrap" style={{ gap: 8 }}>
                        {t.phone && t.anamnese?.termos?.whatsapp !== false ? (
                          <a className="btn" target="_blank" rel="noopener" href={waLink(t.phone, msg)} onClick={() => mark(t.id, nx.d)}>Enviar no WhatsApp</a>
                        ) : <span className="muted">{t.phone ? 'Cliente não quis receber no WhatsApp' : 'Sem telefone'}</span>}
                        <button className="btn ghost" onClick={() => mark(t.id, nx.d, 'Marcado como enviado.')}>Marcar enviado</button>
                        {late > 0 && <span>{late} dia{late > 1 ? 's' : ''} de atraso</span>}
                        <button className="link right" onClick={() => confirm2('skip' + t.id, 'Toque de novo para parar as mensagens deste cliente.') && ops.patchTicket(t.id, { care: { skip: true } })}>Parar</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

/* ---------- Equipe ---------- */
function Equipe({ all }: { all: AllData }) {
  const [f, setF] = useState({ role: '', lang: '', style: '' });
  const [edit, setEdit] = useState<{ a: Artist; isNew: boolean } | null>(null);
  let as = [...all.artists].sort((a, b) => a.name.localeCompare(b.name));
  if (f.role) as = as.filter((a) => a.role === f.role);
  if (f.lang) as = as.filter((a) => (a.langs || []).includes(f.lang));
  if (f.style) as = as.filter((a) => (a.styles || []).includes(f.style));
  const blank = (): Artist => ({ id: 'a' + uid(), name: '', phone: '', instagram: '', role: 'tatuador', level: 'Intermediário', years: 0, langs: ['Português'], styles: [], days: ['sab', 'dom'], blocked: [], commission: all.settings.commission || 50, notes: '' });
  return (
    <>
      <TopBar title="Equipe" right={<button className="btn desktop-only" onClick={() => setEdit({ a: blank(), isNew: true })}>+ Nova pessoa</button>} />
      <main className="page" id="main">
        <div className="chips" role="group" aria-label="Função" style={{ marginTop: 12 }}>
          {[['', 'Todos'], ...Object.entries(ROLES)].map(([k, l]) => <button key={k} className="chip" aria-pressed={f.role === k} onClick={() => setF({ ...f, role: k })}>{l}</button>)}
        </div>
        <div className="form2" style={{ maxWidth: 640 }}>
          <Field label="Idioma">{(p) => <select className="inp" {...p} value={f.lang} onChange={(e) => setF({ ...f, lang: e.target.value })}><option value="">Qualquer</option>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
          <Field label="Estilo">{(p) => <select className="inp" {...p} value={f.style} onChange={(e) => setF({ ...f, style: e.target.value })}><option value="">Qualquer</option>{STUDIO_STYLES.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        </div>
        {as.length ? (
          <div className="cards" style={{ marginTop: 16 }}>
            {as.map((a) => {
              const nx = all.events.filter((e) => e.date >= today() && (e.team || []).some((m) => m.artistId === a.id)).sort((x, y) => x.date.localeCompare(y.date))[0];
              return (
                <button key={a.id} className="card tap" onClick={() => setEdit({ a, isNew: false })}>
                  <div className="row"><b className="grow">{a.name}</b><span className="tag quiet">{ROLES[a.role]}</span></div>
                  <span className="muted">{a.level}{a.years ? ` · ${a.years} ano${a.years > 1 ? 's' : ''}` : ''} · {(a.days || []).map((d) => WDL[d]).join(', ') || 'sem dias'}{a.role !== 'atendimento' ? ` · ${a.commission ?? ''}%` : ''}</span>
                  <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>{[...(a.langs || []), ...(a.styles || [])].map((x) => <span className="tag quiet" key={x}>{x}</span>)}</div>
                  {nx && <p className="muted" style={{ marginBottom: 0 }}>Próximo: {nx.name} · {fmtD(nx.date)}</p>}
                </button>
              );
            })}
          </div>
        ) : <div className="card" style={{ marginTop: 16 }}>Ninguém com esses filtros.</div>}
      </main>
      <button className="btn fab mobile-only" onClick={() => setEdit({ a: blank(), isNew: true })}>+ Nova pessoa</button>
      {edit && <ArtistModal a={edit.a} isNew={edit.isNew} onClose={() => setEdit(null)} />}
    </>
  );
}

function ArtistModal({ a, isNew, onClose }: { a: Artist; isNew: boolean; onClose: () => void }) {
  const ops = useOps();
  const confirm2 = useConfirm2();
  const [d, setD] = useState({ ...a, phone: fmtPhone(a.phone), blockedTxt: (a.blocked || []).map((x) => fmtD(x, { day: '2-digit', month: '2-digit' })).join(', '), years: String(a.years || ''), commission: String(a.commission ?? '') });
  const [err, setErr] = useState('');
  const up = (p: Partial<typeof d>) => setD({ ...d, ...p });
  const tog = (k: 'langs' | 'styles' | 'days', v: string) => up({ [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] } as Partial<typeof d>);
  const save = async () => {
    if (!d.name.trim()) return setErr('Escreva o nome.');
    const out: Artist = { ...a, ...d, name: d.name.trim(), phone: digits(d.phone), blocked: parseBlocked(d.blockedTxt), years: Number(d.years) || 0, commission: Number(d.commission) || 0 };
    delete (out as unknown as Record<string, unknown>).blockedTxt;
    if (await ops.putArtist(a.id, out, 'Salvo.')) onClose();
  };
  return (
    <Modal title={isNew ? 'Nova pessoa' : a.name} onClose={onClose}>
      <Field label="Nome" error={err}>{(p) => <input className="inp" {...p} autoFocus={isNew} value={d.name} onChange={(e) => up({ name: e.target.value })} />}</Field>
      <div className="form2">
        <Field label="WhatsApp">{(p) => <input className="inp" {...p} type="tel" inputMode="tel" value={d.phone} onChange={(e) => up({ phone: e.target.value })} />}</Field>
        <Field label="Instagram">{(p) => <input className="inp" {...p} value={d.instagram} onChange={(e) => up({ instagram: e.target.value })} />}</Field>
      </div>
      <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Função</p>
      <Chips label="Função" options={Object.keys(ROLES) as Role[]} labels={ROLES} value={d.role} onChange={(v) => up({ role: v })} />
      <div className="form2">
        <Field label="Experiência">{(p) => <select className="inp" {...p} value={d.level} onChange={(e) => up({ level: e.target.value })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        <Field label="Anos de experiência">{(p) => <input className="inp" {...p} type="number" min={0} inputMode="numeric" value={d.years} onChange={(e) => up({ years: e.target.value })} />}</Field>
      </div>
      <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Idiomas</p>
      <Chips label="Idiomas" multi options={LANGS} value={d.langs} onChange={(v) => tog('langs', v)} />
      <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Estilos</p>
      <Chips label="Estilos" multi options={STUDIO_STYLES} value={d.styles} onChange={(v) => tog('styles', v)} />
      <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Dias livres</p>
      <Chips label="Dias livres" multi options={['sex', 'sab', 'dom', 'seg', 'ter', 'qua', 'qui']} labels={WDL} value={d.days} onChange={(v) => tog('days', v)} />
      <Field label="Datas bloqueadas" hint="Ex.: 28/11, 05/12">{(p) => <input className="inp" {...p} value={d.blockedTxt} onChange={(e) => up({ blockedTxt: e.target.value })} />}</Field>
      <Field label="Comissão (%)">{(p) => <input className="inp" {...p} type="number" inputMode="numeric" value={d.commission} onChange={(e) => up({ commission: e.target.value })} />}</Field>
      <Field label="Observações">{(p) => <textarea className="inp" {...p} value={d.notes} onChange={(e) => up({ notes: e.target.value })} />}</Field>
      <div className="row wrap" style={{ marginTop: 18 }}>
        <button className="btn grow" onClick={save}>Salvar</button>
        {!isNew && <button className="btn ghost" onClick={() => confirm2('da' + a.id, 'Toque de novo para excluir esta pessoa.') && ops.removeArtist(a.id).then(onClose)}>Excluir</button>}
      </div>
    </Modal>
  );
}

/* ---------- Ajustes ---------- */
function Ajustes({ all, exit }: { all: AllData; exit: () => void }) {
  const b = useBackend();
  const ops = useOps();
  const toast = useToast();
  const confirm2 = useConfirm2();
  const [qr, setQr] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const s = all.settings;
  const sv = (path: string, v: unknown, msg?: string) => ops.patchSettings(nest(path, v), msg);
  const deskUrl = location.origin + '/';
  const newPin = () => {
    const p = String(Math.floor(100000 + Math.random() * 900000));
    sv('attendantPin', p, 'PIN novo salvo. Passe para o atendimento.');
    setShowPin(true);
  };
  return (
    <>
      <TopBar title="Ajustes" />
      <main className="page" id="main">
        <div className="grid two">
          <section>
            <h2 className="h2">Acesso do atendimento</h2>
            <div className="card">
              <p style={{ marginTop: 0 }}>Para quem trabalha no balcão no dia do evento. Com o PIN, a pessoa vê <b>só o evento aberto hoje</b>: fila, pagamentos, fichas, “Novo cliente” no tablet e a tela da mesa.</p>
              <p className="muted">Agenda, orçamento, contratos, equipe, fechamento e pós ficam só aqui na gestão.</p>
              <div className="row wrap" style={{ marginTop: 12 }}>
                <span>PIN:</span>
                <span className="code" style={{ fontSize: 28 }} aria-live="polite">{showPin ? s.attendantPin : '••••••'.slice(0, s.attendantPin.length)}</span>
                <button className="link" onClick={() => setShowPin(!showPin)}>{showPin ? 'Esconder' : 'Mostrar'}</button>
              </div>
              {s.attendantPin === SEED_PIN && <p className="note">Este é o PIN de exemplo. Troque antes do evento.</p>}
              <div className="row wrap" style={{ marginTop: 12 }}>
                <button className="btn" onClick={newPin}>Gerar PIN novo</button>
                <button className="btn ghost" onClick={() => copyText(`Atendimento A2 — entre em ${deskUrl}, toque em “Atendimento do dia” e use o PIN ${s.attendantPin}.`, toast)}>Copiar instruções</button>
              </div>
              <p className="muted">Trocar o PIN tira o acesso de quem usava o PIN antigo.</p>
            </div>

            <h2 className="h2">Telas do evento</h2>
            <div className="list">
              <a className="item tap row" style={{ display: 'flex', textDecoration: 'none' }} href="/cliente" target="_blank" rel="noopener"><span className="grow"><b>Cliente</b><br /><span className="muted">Catálogo, ficha e fila. É o que abre no QR code.</span></span>›</a>
              <Link className="item tap row" style={{ display: 'flex', textDecoration: 'none' }} to="/painel/mesa"><span className="grow"><b>Mesa do tatuador</b><br /><span className="muted">Começar e liberar a mesa.</span></span>›</Link>
              <a className="item tap row" style={{ display: 'flex', textDecoration: 'none' }} href="/fila" target="_blank" rel="noopener"><span className="grow"><b>Telão da fila</b><br /><span className="muted">Para uma TV ou tablet no stand.</span></span>›</a>
            </div>
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setQr(true)}>Ver QR code dos clientes</button>

            <h2 className="h2">Preços das flashs</h2>
            <div className="card">
              <table className="prices">
                <thead><tr><th scope="col">Tamanho</th><th scope="col">Traço fino (R$)</th><th scope="col">Detalhada (R$)</th></tr></thead>
                <tbody>
                  {(['P', 'M', 'G'] as const).map((z) => (
                    <tr key={z}>
                      <th scope="row" style={{ fontWeight: 500 }}>{z} <span className="muted">{({ P: 'até 5 cm', M: '5 a 8 cm', G: '8 a 12 cm' })[z]}</span></th>
                      {(['F', 'D'] as const).map((tier) => (
                        <td key={tier}>
                          <PriceInput label={`${tier === 'F' ? 'Traço fino' : 'Detalhada'} ${z}`} value={s.prices?.[tier]?.[z] ?? null} onSave={(v) => sv(`prices.${tier}.${z}`, v)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginBottom: 0 }}>Deixe em branco o tamanho que não é feito.</p>
            </div>
          </section>

          <section>
            <h2 className="h2">Estúdio</h2>
            <div className="card">
              <SaveInput label="Nome" value={s.studioName} onSave={(v) => sv('studioName', v)} />
              <SaveInput label="Responsável" value={s.owner} onSave={(v) => sv('owner', v)} />
              <SaveInput label="WhatsApp do estúdio" type="tel" inputMode="tel" value={fmtPhone(s.whatsapp)} onSave={(v) => sv('whatsapp', digits(v))} />
              <div className="form2">
                <SaveInput label="Minutos por flash" type="number" inputMode="numeric" value={s.avgMin} onSave={(v) => sv('avgMin', Number(v) || 25)} />
                <SaveInput label="Comissão padrão (%)" type="number" inputMode="numeric" value={s.commission} onSave={(v) => sv('commission', Number(v) || 50)} />
              </div>
              <SaveInput label="Link público do app" type="url" inputMode="url" value={s.publicUrl} placeholder="https://a2-eventos.vercel.app" hint="É o endereço que vai no QR code. Deixe em branco para usar o endereço atual." onSave={(v) => sv('publicUrl', v.trim())} />
            </div>

            <h2 className="h2">Mensagens de pós</h2>
            <p className="muted" style={{ marginTop: -4 }}>Use {'{nome}'} e {'{evento}'} para personalizar.</p>
            {CARE_DAYS.map((d) => <SaveInput key={d} multiline label={`Dia ${d}`} value={s.templates?.[d] || ''} onSave={(v) => sv(`templates.${d}`, v)} />)}

            {b.mode === 'local' && (
              <>
                <h2 className="h2">Dados de demonstração</h2>
                <p className="muted">Neste modo os dados ficam só neste navegador.</p>
                <div className="row wrap">
                  <button className="btn ghost" onClick={() => confirm2('seed', 'Toque de novo para trocar tudo pelos dados de exemplo.') && b.resetDemo!().then(() => toast('Dados de exemplo carregados, com o evento de hoje.'))}>Recriar exemplo com evento hoje</button>
                  <button className="btn ghost" onClick={() => confirm2('wipe', 'Toque de novo para apagar todos os dados deste aparelho.') && b.wipe!().then(() => toast('Dados apagados.'))}>Apagar tudo</button>
                </div>
              </>
            )}
            <h2 className="h2">Conta</h2>
            {b.mode === 'supabase' && <PasswordCard />}
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={exit}>Sair da gestão</button>
          </section>
        </div>
      </main>
      {qr && <QrModal all={all} onClose={() => setQr(false)} />}
    </>
  );
}

/** Senha da gestão: depois dela, o login não depende mais de e-mail. */
function PasswordCard() {
  const b = useBackend();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState<{ pw?: string; pw2?: string }>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const e: { pw?: string; pw2?: string } = {};
    if (pw.length < 8) e.pw = 'A senha precisa ter pelo menos 8 caracteres.';
    else if (pw !== pw2) e.pw2 = 'As duas senhas não são iguais.';
    setErr(e);
    if (e.pw || e.pw2) return;
    setBusy(true);
    try {
      await b.setOwnerPassword!(pw);
      setPw('');
      setPw2('');
      toast('Senha salva. Nas próximas vezes, entre com e-mail e senha.');
    } catch (x) {
      setErr({ pw: authErrorText(x) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p style={{ marginTop: 0 }}><b>Senha da gestão</b></p>
      <p className="muted">Com senha, você entra sem esperar e-mail. O link por e-mail tem limite de poucos envios por hora.</p>
      <Field label="Senha nova" error={err.pw} hint="Pelo menos 8 caracteres.">
        {(p) => <input className="inp" {...p} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
      </Field>
      <Field label="Repita a senha" error={err.pw2}>
        {(p) => <input className="inp" {...p} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
      </Field>
      <button className="btn" style={{ marginTop: 14 }} disabled={busy}>Salvar senha</button>
    </form>
  );
}

function PriceInput({ label, value, onSave }: { label: string; value: number | null; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => setV(value == null ? '' : String(value)), [value]);
  return (
    <input className="inp money" type="number" inputMode="decimal" aria-label={label} placeholder="Não faz" value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = v === '' ? null : Number(v); if (n !== value) onSave(n); }} />
  );
}

