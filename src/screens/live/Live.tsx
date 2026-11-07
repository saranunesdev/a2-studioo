import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CELLS, SHEET_META } from '../../data/catalog';
import { BODY, HEALTH, PAY, STATUS } from '../../data/constants';
import { queueOf } from '../../lib/queue';
import { flashName, priceOf } from '../../lib/rules';
import { calledMsg } from '../../lib/texts';
import type { DeskData, PayMethod, QueueOp, Size, Ticket, TicketStatus } from '../../lib/types';
import { ageOf, brl, first, fmtPhone, fmtT, waLink } from '../../lib/util';
import { Check, Field, FlashCrop, Modal, Thumb, flashAlt, useConfirm2, useToast } from '../../components/ui';
import type { LiveSource } from './source';

export function StatusTag({ t, short }: { t: Pick<Ticket, 'status' | 'table'>; short?: boolean }) {
  const strong: TicketStatus[] = ['chamado', 'aguardando_pagamento'];
  const label = t.status === 'chamado' && t.table && !short ? `Chamado — Mesa ${t.table}` : STATUS[t.status];
  return <span className={'tag' + (strong.includes(t.status) ? ' solid' : t.status === 'cancelado' ? ' quiet' : '')}>{label}</span>;
}

function useRun(src: LiveSource) {
  const toast = useToast();
  return async (op: QueueOp, ok?: string) => {
    try {
      await src.queue(op);
      if (ok) toast(ok);
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'Não deu para atualizar a fila. Tente de novo.');
    }
  };
}

function TicketRow({ t, extra, below, onOpen }: { t: Ticket; extra?: React.ReactNode; below?: React.ReactNode; onOpen: () => void }) {
  return (
    <div className="item">
      <button className="row" style={{ border: 0, background: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer', minHeight: 44 }} onClick={onOpen}>
        <Thumb flash={t.flash} size={52} alt={flashAlt(t.flash.sheet, t.flash.n, t.flash.size)} />
        <span className="grow">
          <span className="row" style={{ gap: 8 }}>
            <span className="code">{t.code}</span>
            <b style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</b>
          </span>
          <span className="muted" style={{ display: 'block' }}>
            {flashName(t.flash)} · {brl(t.flash?.price)}
            {t.alerts?.length ? <b style={{ color: 'var(--ink)' }}> · ⚠ {t.alerts.length} alerta{t.alerts.length > 1 ? 's' : ''}</b> : null}
          </span>
        </span>
        {extra}
      </button>
      {below && <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>{below}</div>}
    </div>
  );
}

/** Painel do dia: números, mesas, pagamentos e fila. Usado pela gestão e pelo atendimento. */
export function LiveBoard({ src, telaoHref = '/fila', mesaHref }: { src: LiveSource; telaoHref?: string; mesaHref: string }) {
  const d = src.data!;
  const e = d.event;
  const run = useRun(src);
  const [open, setOpen] = useState<string | null>(null);
  const [walkin, setWalkin] = useState(false);
  const tix = d.tickets;
  const by = (s: TicketStatus) => tix.filter((t) => t.status === s);
  const q = queueOf(tix, e.id);
  const pay = by('aguardando_pagamento');
  const done = by('concluido').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const tats = e.team.filter((m) => m.role !== 'atendimento');
  const nameOf = (id: string | null) => d.artists.find((a) => a.id === id)?.name || '';

  return (
    <>
      <div className="stat" style={{ marginTop: 16 }}>
        <div><b>{pay.length}</b><span className="muted">Falta pagar</span></div>
        <div><b>{q.length}</b><span className="muted">Na fila</span></div>
        <div><b>{by('chamado').length + by('em_atendimento').length}</b><span className="muted">Nas mesas</span></div>
        <div><b>{done.length}</b><span className="muted">Prontas</span></div>
      </div>
      <div className="row wrap" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => setWalkin(true)}>+ Cliente no balcão</button>
        <Link className="btn ghost" to={mesaHref}>Tela da mesa</Link>
        <a className="btn ghost" href={telaoHref} target="_blank" rel="noopener">Abrir telão</a>
      </div>

      <div className="live-grid">
        <section aria-labelledby="h-mesas">
          <h2 className="h2" id="h-mesas">Mesas</h2>
          <div className="tables">
            {e.tableState.map((tb) => {
              const t = tb.ticketId ? tix.find((x) => x.id === tb.ticketId) : undefined;
              return (
                <div className="table" key={tb.n}>
                  <div className="row">
                    <span className="n grow">Mesa {tb.n}</span>
                    {tb.paused ? <span className="tag quiet">Pausada</span> : t ? <StatusTag t={t} short /> : <span className="tag quiet">Livre</span>}
                  </div>
                  <Field label={`Tatuador da mesa ${tb.n}`}>
                    {(p) => (
                      <select className="inp" {...p} value={tb.artistId || ''}
                        onChange={(ev) => run({ type: 'tableArtist', eventId: e.id, n: tb.n, artistId: ev.target.value || null })}>
                        <option value="">Ninguém</option>
                        {tats.map((m) => <option key={m.artistId} value={m.artistId}>{first(nameOf(m.artistId))}</option>)}
                      </select>
                    )}
                  </Field>
                  {t ? (
                    <button className="row" style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', minHeight: 44 }} onClick={() => setOpen(t.id)}>
                      <Thumb flash={t.flash} size={44} alt={flashAlt(t.flash.sheet, t.flash.n, t.flash.size)} />
                      <span><span className="code">{t.code}</span> {first(t.name)}{t.alerts?.length ? ' · ⚠ ver ficha' : ''}</span>
                    </button>
                  ) : (
                    <span className="muted">Sem cliente</span>
                  )}
                  {t?.status === 'chamado' && (
                    <div className="row wrap" style={{ gap: 8 }}>
                      <button className="btn grow" onClick={() => run({ type: 'start', ticketId: t.id })}>Começar</button>
                      {t.phone && (
                        <a className="btn ghost" target="_blank" rel="noopener" href={waLink(t.phone, calledMsg(t, nameOf(t.artistId), t.lang))}>Avisar no WhatsApp</a>
                      )}
                    </div>
                  )}
                  {t?.status === 'em_atendimento' && (
                    <button className="btn" onClick={() => run({ type: 'finish', ticketId: t.id }, 'Mesa liberada.')}>Liberar mesa</button>
                  )}
                  <button className="link" onClick={() => run({ type: 'pause', eventId: e.id, n: tb.n })}>{tb.paused ? 'Voltar a atender' : 'Pausar mesa'}</button>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="h2">Falta pagar</h2>
          {pay.length ? (
            <div className="list">
              {pay.map((t) => (
                <TicketRow key={t.id} t={t} onOpen={() => setOpen(t.id)}
                  below={<>
                    <span>Pagou no:</span>
                    {(Object.entries(PAY) as [PayMethod, string][]).map(([k, l]) => (
                      <button key={k} className="btn ghost grow" aria-label={`${t.code} pagou no ${l}`} onClick={() => run({ type: 'pay', ticketId: t.id, method: k }, `${t.code} pago. Entrou na fila.`)}>
                        {l}
                      </button>
                    ))}
                  </>} />
              ))}
            </div>
          ) : <p className="muted">Ninguém esperando para pagar.</p>}

          <h2 className="h2">Fila</h2>
          {q.length ? (
            <div className="list">
              {q.map((t, i) => <TicketRow key={t.id} t={t} onOpen={() => setOpen(t.id)} extra={<span className="muted">{i + 1}º</span>} />)}
            </div>
          ) : <p className="muted">Fila vazia. Quem pagar entra aqui e é chamado quando uma mesa liberar.</p>}

          {done.length > 0 && (
            <>
              <h2 className="h2">Prontas</h2>
              <div className="list">
                {done.slice(0, 30).map((t) => <TicketRow key={t.id} t={t} onOpen={() => setOpen(t.id)} extra={<span className="muted">{fmtT(t.doneAt!)}</span>} />)}
              </div>
            </>
          )}
        </section>
      </div>

      {open && <TicketModal src={src} id={open} onClose={() => setOpen(null)} />}
      {walkin && <WalkinModal src={src} onClose={() => setWalkin(false)} />}
    </>
  );
}

export function TicketModal({ src, id, onClose }: { src: LiveSource; id: string; onClose: () => void }) {
  const d = src.data!;
  const t = d.tickets.find((x) => x.id === id);
  const run = useRun(src);
  const confirm2 = useConfirm2();
  if (!t) return null;
  const an = t.anamnese || {};
  const a = d.artists.find((x) => x.id === t.artistId);
  const act = (op: QueueOp, ok?: string, close?: boolean) => run(op, ok).then(() => close && onClose());
  return (
    <Modal title={`${t.code} · ${t.name}`} onClose={onClose}>
      <div className="row wrap"><StatusTag t={t} />{t.source !== 'qr' && <span className="tag quiet">{t.source === 'balcao' ? 'Balcão' : 'Tablet'}</span>}</div>
      <p className="muted">
        {fmtPhone(t.phone)}{an.nascimento ? ` · ${ageOf(an.nascimento)} anos` : ''}{t.table ? ` · mesa ${t.table}` : ''}{a ? ` · ${first(a.name)}` : ''}
      </p>
      <div className="row top">
        <Thumb flash={t.flash} size={110} alt={flashAlt(t.flash.sheet, t.flash.n, t.flash.size)} />
        <div>
          <b>{flashName(t.flash)}</b><br />{brl(t.flash?.price)}{t.pay ? ` · pago no ${PAY[t.pay.method]}` : ' · falta pagar'}
          <br />Local: {t.bodyPart || '—'}{an.primeira ? <><br />Primeira tattoo</> : null}
        </div>
      </div>
      {t.alerts?.length ? (
        <div className="alert" style={{ marginTop: 14 }} role="note">
          <strong>Atenção na ficha</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{t.alerts.map((x) => <li key={x}>{x}</li>)}</ul>
          {an.detalhes && <p><i>{an.detalhes}</i></p>}
        </div>
      ) : <p>Ficha sem alertas de saúde.</p>}
      {an.papel && <p className="note">Ficha preenchida em papel e conferida no balcão.</p>}
      {an.responsavel?.nome && <p>Responsável: {an.responsavel.nome} · CPF {an.responsavel.cpf}</p>}
      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Ver ficha completa</summary>
        <div>
          {an.cpf && <>CPF: {an.cpf}<br /></>}{an.email && <>E-mail: {an.email}<br /></>}{an.instagram && <>Instagram: {an.instagram}<br /></>}
          {an.cidade && <>Cidade: {an.cidade}<br /></>}Nascimento: {an.nascimento ? an.nascimento.split('-').reverse().join('/') : '—'}<br />
          Como conheceu: {an.comoConheceu || '—'}<br />
          {HEALTH.map(([k, l]) => <span key={k}>{l}: <b>{an.saude?.[k] ? 'sim' : 'não'}</b><br /></span>)}
          Fotos no Instagram: {an.termos?.imagem ? 'autoriza' : 'não autoriza'} · Cuidados no WhatsApp: {an.termos?.whatsapp ? 'sim' : 'não'}
          {t.lang === 'en' && <><br />Idioma: inglês</>}
        </div>
      </details>
      <div className="stack" style={{ marginTop: 18 }}>
        {t.status === 'aguardando_pagamento' && (
          <div className="row wrap" style={{ gap: 8 }}>
            {(Object.entries(PAY) as [PayMethod, string][]).map(([k, l]) => (
              <button key={k} className="btn grow" onClick={() => act({ type: 'pay', ticketId: t.id, method: k }, 'Pago. Entrou na fila.', true)}>Pagou no {l}</button>
            ))}
          </div>
        )}
        {t.status === 'chamado' && (
          <>
            {t.phone && <a className="btn ghost block" target="_blank" rel="noopener" href={waLink(t.phone, calledMsg(t, a?.name, t.lang))}>Avisar no WhatsApp</a>}
            <div className="row wrap">
              <button className="btn grow" onClick={() => act({ type: 'start', ticketId: t.id })}>Começar</button>
              <button className="btn ghost grow" onClick={() => act({ type: 'noshow', ticketId: t.id }, 'Voltou para a fila.')}>Não apareceu</button>
            </div>
          </>
        )}
        {t.status === 'em_atendimento' && <button className="btn block" onClick={() => act({ type: 'finish', ticketId: t.id }, 'Mesa liberada.', true)}>Terminar e liberar mesa</button>}
        {t.status === 'cancelado' && <button className="btn ghost block" onClick={() => act({ type: 'requeue', ticketId: t.id }, 'Pedido reaberto.')}>Reabrir pedido</button>}
        {t.phone && <a className="btn ghost block" target="_blank" rel="noopener" href={waLink(t.phone, `Oi, ${first(t.name)}! Aqui é do A2 Tattoo Studio.`)}>Conversar no WhatsApp</a>}
        {['aguardando_pagamento', 'na_fila', 'chamado'].includes(t.status) && (
          <button className="link danger" onClick={() => confirm2('c' + t.id, 'Toque de novo para cancelar o pedido.') && act({ type: 'cancel', ticketId: t.id }, 'Pedido cancelado.', true)}>
            Cancelar pedido
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Cliente no balcão: atendimento rápido com ficha em papel. */
function WalkinModal({ src, onClose }: { src: LiveSource; onClose: () => void }) {
  const d = src.data as DeskData;
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', sheet: 0, n: 1, size: 'P' as Size, bodyPart: 'Antebraço', paper: false });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const tier = SHEET_META[f.sheet][2];
  const max = CELLS[f.sheet].length;
  const n = Math.min(max, Math.max(1, f.n || 1));
  const save = async (method: PayMethod | null) => {
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Escreva o nome do cliente.';
    if (!f.paper) er.paper = 'Confira a ficha em papel antes de colocar na fila.';
    setErr(er);
    if (Object.keys(er).length) return;
    let size = f.size;
    if (priceOf(d.settings.prices, tier, size) == null) size = 'M';
    setBusy(true);
    try {
      const r = await src.submit({
        eventId: d.event.id, name: f.name, phone: f.phone.replace(/\D/g, ''),
        flash: { sheet: f.sheet, n, size, tier, price: priceOf(d.settings.prices, tier, size) },
        bodyPart: f.bodyPart, anamnese: { papel: true, saude: {}, termos: { whatsapp: !!f.phone } }, alerts: [], source: 'balcao',
        payMethod: method,
      });
      toast(`Código ${r.code} criado.`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para salvar.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Cliente no balcão" onClose={onClose}>
      <p className="muted">Para quem preencheu a ficha em papel. Para preencher a ficha completa no tablet, use “Novo cliente”.</p>
      <Field label="Nome" error={err.name}>{(p) => <input className="inp" {...p} autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <Field label="WhatsApp (opcional)">{(p) => <input className="inp" {...p} type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      <div className="form2">
        <Field label="Prancha">
          {(p) => (
            <select className="inp" {...p} value={f.sheet} onChange={(e) => setF({ ...f, sheet: Number(e.target.value), n: 1 })}>
              {SHEET_META.map((s, i) => <option key={i} value={i}>{s[0]}</option>)}
            </select>
          )}
        </Field>
        <Field label={`Número do desenho (1 a ${max})`}>
          {(p) => <input className="inp" {...p} type="number" inputMode="numeric" min={1} max={max} value={f.n} onChange={(e) => setF({ ...f, n: Number(e.target.value) })} />}
        </Field>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <Thumb flash={{ sheet: f.sheet, n }} size={88} alt={flashAlt(f.sheet, n, f.size)} />
        <div className="seg grow" role="group" aria-label="Tamanho">
          {(['P', 'M', 'G'] as Size[]).map((z) => {
            const pr = priceOf(d.settings.prices, tier, z);
            return <button key={z} aria-pressed={f.size === z} disabled={pr == null} onClick={() => setF({ ...f, size: z })}>{z} · {brl(pr)}</button>;
          })}
        </div>
      </div>
      <Field label="Local do corpo">
        {(p) => <select className="inp" {...p} value={f.bodyPart} onChange={(e) => setF({ ...f, bodyPart: e.target.value })}>{BODY.map((x) => <option key={x}>{x}</option>)}</select>}
      </Field>
      <Check checked={f.paper} onChange={(v) => setF({ ...f, paper: v })}>Ficha de saúde preenchida em papel e conferida</Check>
      {err.paper && <span className="err">{err.paper}</span>}
      <p style={{ margin: '14px 0 8px', fontWeight: 600 }}>Já pagou?</p>
      <div className="row wrap" style={{ gap: 8 }}>
        {(Object.entries(PAY) as [PayMethod, string][]).map(([k, l]) => <button key={k} className="btn grow" disabled={busy} onClick={() => save(k)}>Pagou no {l}</button>)}
      </div>
      <button className="link" style={{ marginTop: 10 }} disabled={busy} onClick={() => save(null)}>Ainda não pagou</button>
    </Modal>
  );
}

/** Tela da mesa: o tatuador vê o cliente da vez e libera a mesa. */
export function MesaView({ src }: { src: LiveSource }) {
  const d = src.data!;
  const e = d.event;
  const run = useRun(src);
  const [open, setOpen] = useState<string | null>(null);
  const [n, setN] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem('a2-mesa')) || null;
    } catch {
      return null;
    }
  });
  const pick = (v: number) => {
    setN(v);
    try {
      localStorage.setItem('a2-mesa', String(v));
    } catch {
      /* ignore */
    }
  };
  const tb = e.tableState.find((x) => x.n === n);
  const t = tb?.ticketId ? d.tickets.find((x) => x.id === tb.ticketId) : undefined;
  const a = d.artists.find((x) => x.id === tb?.artistId);
  const q = queueOf(d.tickets, e.id).length;
  return (
    <>
      <div className="chips" role="group" aria-label="Escolha a sua mesa" style={{ marginTop: 12 }}>
        {e.tableState.map((x) => <button key={x.n} className="chip" aria-pressed={n === x.n} onClick={() => pick(x.n)}>Mesa {x.n}</button>)}
      </div>
      {!tb ? <div className="card" style={{ marginTop: 12 }}>Escolha a sua mesa.</div> : (
        <>
          <div className="row" style={{ marginTop: 16 }}>
            <span className="serif grow" style={{ fontSize: 48, lineHeight: 1 }}>Mesa {tb.n}</span>
            <span className="right" style={{ textAlign: 'right' }}>{a ? first(a.name) : 'Sem tatuador'}<br /><span className="muted">{q} na fila</span></span>
          </div>
          {!tb.artistId && <p className="note">Escolha o tatuador desta mesa na tela Hoje para começar a receber clientes.</p>}
          {tb.paused ? (
            <div className="card center" style={{ marginTop: 16 }}>
              <p>Mesa pausada.</p>
              <button className="btn" onClick={() => run({ type: 'pause', eventId: e.id, n: tb.n })}>Voltar a atender</button>
            </div>
          ) : !t ? (
            <>
              <div className="card center" style={{ marginTop: 16 }}><p>{q ? 'Chamando o próximo…' : 'Ninguém na fila agora. Quando alguém pagar, aparece aqui.'}</p></div>
              <button className="link" style={{ marginTop: 12 }} onClick={() => run({ type: 'pause', eventId: e.id, n: tb.n })}>Pausar mesa</button>
            </>
          ) : (
            <div className="grid two" style={{ marginTop: 16 }}>
              <div className="card">
                <div className="row"><span className="code" style={{ fontSize: 34 }}>{t.code}</span><StatusTag t={t} /></div>
                <h2 style={{ fontSize: 28, margin: '6px 0' }}>{t.name}</h2>
                <div style={{ background: '#fff', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, margin: '12px 0' }}>
                  <FlashCrop sheet={t.flash.sheet} n={t.flash.n} alt={flashAlt(t.flash.sheet, t.flash.n, t.flash.size)} />
                </div>
                <p><b>{flashName(t.flash)}</b> · {t.bodyPart}{t.anamnese?.primeira ? ' · primeira tattoo' : ''}{t.anamnese?.nascimento ? ` · ${ageOf(t.anamnese.nascimento)} anos` : ''}</p>
              </div>
              <div>
                {t.alerts?.length ? (
                  <div className="alert" role="note"><strong>Atenção</strong>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>{t.alerts.map((x) => <li key={x}>{x}</li>)}</ul>
                    {t.anamnese?.detalhes && <p><i>{t.anamnese.detalhes}</i></p>}
                  </div>
                ) : <p className="note">Ficha sem alertas.</p>}
                <button className="link" onClick={() => setOpen(t.id)}>Ver ficha completa</button>
                <div className="stack" style={{ marginTop: 16 }}>
                  {t.status === 'chamado' ? (
                    <>
                      <button className="btn block lg" onClick={() => run({ type: 'start', ticketId: t.id })}>Cliente chegou · começar</button>
                      <button className="btn ghost block" onClick={() => run({ type: 'noshow', ticketId: t.id }, 'Voltou para a fila.')}>Não apareceu</button>
                    </>
                  ) : (
                    <button className="btn block lg" onClick={() => run({ type: 'finish', ticketId: t.id }, 'Mesa liberada.')}>Terminar e liberar mesa</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {open && <TicketModal src={src} id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
