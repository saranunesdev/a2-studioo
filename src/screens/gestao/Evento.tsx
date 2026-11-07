import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../../components/Shell';
import { Check, Chips, Field, Modal, SaveInput, TextModal, copyText, useConfirm2, useToast } from '../../components/ui';
import { DESIGNS } from '../../data/catalog';
import {
  CATS, CHK_GROUPS, CHK_L, CHK_ST, CONTRACT, EVENT_TYPES, LANGS, LEVELS, MODULES, PAY, ROLES, STAGES, STEPS, STUDIO_STYLES, TYPE_CATS,
} from '../../data/constants';
import {
  artistAvail, budgetCalc, closingCalc, estTattoos, hoursOf, makeChecklist, teamCount, trainedAll,
} from '../../lib/rules';
import {
  closingCsv, closingText, contractText, groupText, inviteText, promoText, proposalText, trainingText,
} from '../../lib/texts';
import type { AllData, ChecklistItem, EventDoc } from '../../lib/types';
import { brl, clone, digits, first, fmtD, fmtDLong, fmtPhone, uid, waLink, waShare } from '../../lib/util';
import { useBackend } from '../../store';
import { LiveBoard } from '../live/Live';
import { ownerSource } from '../live/source';
import { QrModal } from './Gestao';
import { nest, useOps } from './ops';

const TABS: [string, string][] = [
  ['resumo', 'Resumo'], ['equipe', 'Equipe'], ['checklist', 'Checklist'], ['orcamento', 'Orçamento'],
  ['treino', 'Treino'], ['catalogo', 'Catálogo'], ['hoje', 'Hoje'], ['fechamento', 'Fechamento'],
];

type TextM = { title: string; text: string; note?: string; phone?: string | null } | null;

export default function EventoPage({ all }: { all: AllData }) {
  const { id, tab = 'resumo' } = useParams();
  const nav = useNavigate();
  const e = all.events.find((x) => x.id === id);
  const [text, setText] = useState<TextM>(null);
  if (!e) return <><TopBar title="Evento" back={() => nav('/painel')} /><main className="page"><div className="card" style={{ marginTop: 16 }}>Evento não encontrado.</div></main></>;
  const props = { e, all, setText };
  return (
    <>
      <TopBar title={e.name} back={() => nav('/painel')} />
      <main className="page" id="main">
        <div className="tabs" role="tablist" aria-label="Seções do evento">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k}
              ref={(el) => { if (el && tab === k) el.scrollIntoView({ block: 'nearest', inline: 'center' }); }}
              onClick={() => { nav(`/painel/evento/${e.id}/${k}`, { replace: true }); window.scrollTo(0, 0); }}>{l}</button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === 'resumo' && <Resumo {...props} />}
          {tab === 'equipe' && <EquipeTab {...props} />}
          {tab === 'checklist' && <Checklist {...props} />}
          {tab === 'orcamento' && <Orcamento {...props} />}
          {tab === 'treino' && <Treino {...props} />}
          {tab === 'catalogo' && <CatalogoTab {...props} />}
          {tab === 'hoje' && <HojeTab {...props} />}
          {tab === 'fechamento' && <Fechamento {...props} />}
        </div>
      </main>
      {text && <TextModal {...text} onClose={() => setText(null)} />}
    </>
  );
}

type P = { e: EventDoc; all: AllData; setText: (t: TextM) => void };

/* ---------- Resumo ---------- */
function Resumo({ e, all, setText }: P) {
  const ops = useOps();
  const nav = useNavigate();
  const confirm2 = useConfirm2();
  const [promo, setPromo] = useState(false);
  const sv = (path: string, v: unknown) => ops.patchEvent(e.id, nest(path, v));
  const go = (t: string) => nav(`/painel/evento/${e.id}/${t}`, { replace: true });
  const team = e.team || [];
  const hint = (k: string) => {
    if (k === 'contratos_tatuadores') return team.length ? `${team.filter((m) => m.contract === 'assinado').length} de ${team.length} contratos assinados` : 'Ninguém escalado ainda.';
    if (k === 'compras') { const n = (e.checklist || []).filter((i) => i.status === 'comprar' || i.status === 'faltando').length; return n ? `${n} itens faltando ou para comprar` : 'Checklist completo'; }
    if (k === 'treinamento') return team.length ? `${team.filter((m) => trainedAll(e, m.artistId)).length} de ${team.length} com todos os módulos` : '';
    if (k === 'logistica') { const c = e.checklist || []; return `${c.filter((i) => i.status === 'embalado' || i.status === 'voltou').length} de ${c.length} itens no carro`; }
    if (k === 'orcamento') return `Resultado previsto: ${brl(budgetCalc(e, all.settings).result)}`;
    return '';
  };
  const action: Record<string, [string, () => void] | null> = {
    negociacao: null, orcamento: ['Abrir orçamento', () => go('orcamento')],
    contrato_parceiro: ['Gerar contrato', () => setText({ title: 'Contrato do parceiro', text: contractText('partner', e, all.settings), phone: e.partner?.phone || '', note: 'Modelo simples para adaptar. Vale passar por um advogado antes de usar.' })],
    contratos_tatuadores: ['Ver equipe', () => go('equipe')], compras: ['Lista de compras', () => go('checklist')],
    treinamento: ['Ver treino', () => go('treino')], logistica: ['Checklist', () => go('checklist')], divulgacao: ['Texto e QR para divulgar', () => setPromo(true)],
  };
  const changeTables = (v: string) => {
    const n = Math.min(20, Math.max(1, Number(v) || 1));
    const ts = clone(e.tableState || []);
    while (ts.length < n) ts.push({ n: ts.length + 1, artistId: null, ticketId: null, paused: false });
    while (ts.length > n && !ts[ts.length - 1].ticketId) ts.pop();
    const need = clone(e.need || { tatuador: e.tables, atendimento: 1 });
    if (need.tatuador === e.tables) need.tatuador = n;
    ops.patchEvent(e.id, { tables: n, tableState: ts, need });
  };
  const p = e.partner || { name: '', company: '', phone: '' };
  const dup = async () => {
    const c = clone(e) as Partial<EventDoc>;
    const nid = 'e' + uid();
    delete c.id;
    Object.assign(c, {
      name: e.name + ' (cópia)', stage: 'negociacao', steps: Object.fromEntries(STEPS.map(([k]) => [k, { done: false, note: '' }])), team: [], training: {},
      closing: { paid: {}, feeReceived: false, extra: [], closedAt: null }, createdAt: Date.now(),
      tableState: (e.tableState || []).map((t) => ({ n: t.n, artistId: null, ticketId: null, paused: false })),
      checklist: (e.checklist || []).map((i) => ({ ...i, status: 'faltando' })),
    });
    if (await ops.putEvent(nid, c as EventDoc, 'Evento duplicado.')) nav(`/painel/evento/${nid}`);
  };
  return (
    <div className="grid two">
      <section>
        <p className="muted" style={{ margin: '16px 0 0' }}>{fmtDLong(e.date)} · {e.start}–{e.end}</p>
        <p style={{ fontWeight: 600, margin: '16px 0 6px' }}>Fase</p>
        <Chips label="Fase" options={STAGES.map((s) => s[0])} labels={Object.fromEntries(STAGES)} value={e.stage} onChange={(v) => ops.patchEvent(e.id, { stage: v })} />
        <h2 className="h2">Etapas da organização</h2>
        <div className="list">
          {STEPS.map(([k, l]) => {
            const s = e.steps?.[k] || { done: false };
            const a = action[k];
            const h = hint(k);
            return (
              <div className="item" key={k}>
                <label className="check" style={{ padding: 0 }}>
                  <input type="checkbox" checked={!!s.done} onChange={(ev) => sv(`steps.${k}.done`, ev.target.checked)} />
                  <span className="grow"><b style={{ fontWeight: s.done ? 500 : 600 }}>{l}</b>{s.done ? <span className="muted"> · pronto</span> : null}{h && <><br /><span className="muted">{h}</span></>}</span>
                </label>
                {a && <button className="link" style={{ marginLeft: 32 }} onClick={a[1]}>{a[0]}</button>}
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="h2">Dados do evento</h2>
        <div className="card">
          <SaveInput label="Nome" value={e.name} onSave={(v) => sv('name', v)} />
          <div className="form2">
            <Field label="Tipo">{(pp) => <select className="inp" {...pp} value={e.type} onChange={(ev) => sv('type', ev.target.value)}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
            <SaveInput label="Data" type="date" value={e.date} onSave={(v) => sv('date', v)} />
            <SaveInput label="Início" type="time" value={e.start} onSave={(v) => sv('start', v)} />
            <SaveInput label="Fim" type="time" value={e.end} onSave={(v) => sv('end', v)} />
            <SaveInput label="Público estimado" type="number" inputMode="numeric" value={e.public} onSave={(v) => sv('public', Number(v) || 0)} />
            <SaveInput label="Mesas de tattoo" type="number" inputMode="numeric" min={1} max={20} value={e.tables} onSave={changeTables} />
          </div>
          <SaveInput label="Local" value={e.venue} onSave={(v) => sv('venue', v)} />
          <SaveInput label="Endereço" value={e.address} onSave={(v) => sv('address', v)} />
          {e.address && <a className="link" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}`}>Abrir no mapa</a>}
        </div>
        <h2 className="h2">Parceiro</h2>
        <div className="card">
          <SaveInput label="Contato" value={p.name} onSave={(v) => sv('partner.name', v)} />
          <div className="form2">
            <SaveInput label="Empresa" value={p.company} onSave={(v) => sv('partner.company', v)} />
            <SaveInput label="WhatsApp" type="tel" inputMode="tel" value={fmtPhone(p.phone)} onSave={(v) => sv('partner.phone', digits(v))} />
          </div>
          <div className="row wrap" style={{ marginTop: 14 }}>
            {p.phone && <a className="btn" target="_blank" rel="noopener" href={waLink(p.phone, `Oi, ${first(p.name)}! Aqui é a ${all.settings.owner || 'Ariana'}, do A2 Tattoo Studio, sobre o ${e.name} (${fmtD(e.date)}).`)}>WhatsApp</a>}
            <button className="btn ghost" onClick={action.contrato_parceiro![1]}>Contrato do parceiro</button>
            <button className="btn ghost" onClick={() => go('orcamento')}>Proposta</button>
          </div>
        </div>
        <SaveInput label="Observações" multiline value={e.notes} placeholder="Horário de montagem, acesso, contato no local…" onSave={(v) => sv('notes', v)} />
        <div className="row" style={{ marginTop: 28 }}>
          <button className="link" onClick={dup}>Duplicar evento</button>
          <button className="link right danger" onClick={() => confirm2('del' + e.id, 'Toque de novo em Excluir para apagar o evento.') && ops.removeEvent(e.id, 'Evento excluído.').then(() => nav('/painel'))}>Excluir evento</button>
        </div>
      </section>
      {promo && <PromoModal e={e} all={all} onClose={() => setPromo(false)} />}
    </div>
  );
}

function PromoModal({ e, all, onClose }: { e: EventDoc; all: AllData; onClose: () => void }) {
  const toast = useToast();
  const [qr, setQr] = useState(false);
  const txt = promoText(e, all.settings);
  if (qr) return <QrModal all={all} onClose={onClose} />;
  return (
    <Modal title="Divulgação" onClose={onClose}>
      <Field label="Legenda para o Instagram">{(p) => <textarea className="inp" {...p} readOnly style={{ minHeight: 220 }} value={txt} />}</Field>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => copyText(txt, toast)}>Copiar legenda</button>
        <button className="btn ghost" onClick={() => setQr(true)}>Ver QR code</button>
      </div>
    </Modal>
  );
}

/* ---------- Equipe do evento ---------- */
function EquipeTab({ e, all, setText }: P) {
  const ops = useOps();
  const [add, setAdd] = useState(false);
  const team = e.team || [];
  const need = e.need || { tatuador: e.tables, atendimento: 1 };
  const save = (t: EventDoc['team'], extra: Partial<EventDoc> = {}, msg?: string) => ops.patchEvent(e.id, { team: t, ...extra }, msg);
  return (
    <>
      <h2 className="h2">Escala</h2>
      <div className="row wrap" style={{ gap: 20 }}>
        <span>{teamCount(e, 'tatuador')}/{need.tatuador} tatuadores</span>
        <span>{teamCount(e, 'atendimento')}/{need.atendimento} atendimento</span>
        {teamCount(e, 'piercer') > 0 && <span>{teamCount(e, 'piercer')} piercer</span>}
      </div>
      {!team.length ? <div className="card" style={{ marginTop: 12 }}>Ninguém escalado ainda. Toque em “Adicionar pessoa” para ver quem está livre em {fmtD(e.date)}.</div> : (
        <div className="cards" style={{ marginTop: 12 }}>
          {team.map((m) => {
            const a = all.artists.find((x) => x.id === m.artistId);
            if (!a) return null;
            const ct = m.contract || 'pendente';
            return (
              <div className="card" key={a.id}>
                <div className="row top">
                  <div className="grow"><b>{a.name}</b><div className="muted">{ROLES[m.role] || m.role} · {a.level}{a.langs?.length > 1 ? ' · ' + a.langs.filter((l) => l !== 'Português').join(', ') : ''}</div></div>
                  <button className={'tag' + (ct === 'assinado' ? ' quiet' : ' solid')} title="Tocar para mudar"
                    onClick={() => save(team.map((x) => (x.artistId === a.id ? { ...x, contract: CONTRACT[(CONTRACT.indexOf(ct) + 1) % 3] } : x)))}>
                    Contrato: {ct}
                  </button>
                </div>
                <div className="row wrap" style={{ marginTop: 10, gap: 8 }}>
                  <a className="btn" target="_blank" rel="noopener" href={waLink(a.phone, inviteText(e, a, m, all.settings))}>Convidar</a>
                  <button className="btn ghost" onClick={() => setText({ title: 'Contrato de ' + first(a.name), text: contractText('artist', e, all.settings, a), phone: a.phone, note: 'Modelo simples para adaptar. Vale passar por um advogado antes de usar.' })}>Contrato</button>
                </div>
                <div className="row wrap">
                  <Check checked={!!m.confirmed} onChange={(v) => save(team.map((x) => (x.artistId === a.id ? { ...x, confirmed: v } : x)))}>Confirmou</Check>
                  <button className="link right" onClick={() => save(team.filter((x) => x.artistId !== a.id), { tableState: (e.tableState || []).map((t) => (t.artistId === a.id && !t.ticketId ? { ...t, artistId: null } : t)) })}>Remover</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => setAdd(true)}>Adicionar pessoa</button>
        {team.length > 0 && <a className="btn ghost" target="_blank" rel="noopener" href={waShare(groupText(e, all.artists))}>Mandar escala no grupo</a>}
      </div>
      <h3 className="h3">Pessoas necessárias</h3>
      <div className="form2" style={{ maxWidth: 520 }}>
        <SaveInput label="Tatuadores" type="number" inputMode="numeric" value={need.tatuador} onSave={(v) => ops.patchEvent(e.id, { need: { tatuador: Number(v) || 0 } })} />
        <SaveInput label="Atendimento" type="number" inputMode="numeric" value={need.atendimento} onSave={(v) => ops.patchEvent(e.id, { need: { atendimento: Number(v) || 0 } })} />
      </div>
      {add && <AddTeamModal e={e} all={all} onClose={() => setAdd(false)} />}
    </>
  );
}

function AddTeamModal({ e, all, onClose }: { e: EventDoc; all: AllData; onClose: () => void }) {
  const ops = useOps();
  const [f, setF] = useState({ role: '', lang: '', style: '' });
  let as = all.artists.filter((a) => !(e.team || []).some((t) => t.artistId === a.id));
  if (f.role) as = as.filter((a) => a.role === f.role);
  if (f.lang) as = as.filter((a) => (a.langs || []).includes(f.lang));
  if (f.style) as = as.filter((a) => (a.styles || []).includes(f.style));
  const lv = (a: { level: string }) => LEVELS.indexOf(a.level);
  as.sort((a, b) => (artistAvail(a, e, all.events) ? 1 : 0) - (artistAvail(b, e, all.events) ? 1 : 0) || lv(b) - lv(a));
  const pick = (id: string) => {
    const a = all.artists.find((x) => x.id === id)!;
    const team = [...clone(e.team || []), { artistId: a.id, role: a.role, contract: 'pendente' as const, confirmed: false }];
    const ts = clone(e.tableState || []);
    if (a.role !== 'atendimento') { const free = ts.find((t) => !t.artistId); if (free) free.artistId = a.id; }
    ops.patchEvent(e.id, { team, tableState: ts }, first(a.name) + ' na escala.');
  };
  return (
    <Modal title={`Escalar para ${fmtD(e.date)}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Primeiro quem está livre neste dia.</p>
      <div className="chips" role="group" aria-label="Função">
        {[['', 'Todos'], ...Object.entries(ROLES)].map(([k, l]) => <button key={k} className="chip" aria-pressed={f.role === k} onClick={() => setF({ ...f, role: k })}>{l}</button>)}
      </div>
      <div className="form2">
        <Field label="Idioma">{(p) => <select className="inp" {...p} value={f.lang} onChange={(ev) => setF({ ...f, lang: ev.target.value })}><option value="">Qualquer</option>{LANGS.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
        <Field label="Estilo">{(p) => <select className="inp" {...p} value={f.style} onChange={(ev) => setF({ ...f, style: ev.target.value })}><option value="">Qualquer</option>{STUDIO_STYLES.map((l) => <option key={l}>{l}</option>)}</select>}</Field>
      </div>
      <div className="list" style={{ marginTop: 14 }}>
        {as.map((a) => {
          const why = artistAvail(a, e, all.events);
          return (
            <div className="item row" key={a.id}>
              <div className="grow"><b>{a.name}</b> <span className={'tag' + (why ? ' solid' : ' quiet')}>{why ? 'Ocupado: ' + why : 'Livre'}</span>
                <div className="muted">{ROLES[a.role]} · {a.level} · {(a.langs || []).join(', ')}</div></div>
              <button className={'btn' + (why ? ' ghost' : '')} onClick={() => pick(a.id)}>Escalar</button>
            </div>
          );
        })}
        {!as.length && <div className="item muted">Ninguém com esses filtros. Cadastre em Equipe.</div>}
      </div>
    </Modal>
  );
}

/* ---------- Checklist ---------- */
function Checklist({ e, all, setText }: P) {
  const ops = useOps();
  const [add, setAdd] = useState(false);
  const c = e.checklist || [];
  const counts: Record<string, number> = {};
  for (const i of c) counts[i.status] = (counts[i.status] || 0) + 1;
  const setC = (list: ChecklistItem[], msg?: string) => ops.patchEvent(e.id, { checklist: list }, msg);
  const ks = CHK_ST.map((x) => x[0]);
  const shop = () => {
    const it = c.filter((i) => i.status === 'faltando' || i.status === 'comprar');
    const txt = `Compras — ${e.name} (${fmtD(e.date)})\n\n` + CHK_GROUPS.map((g) => { const x = it.filter((i) => i.group === g); return x.length ? `*${g}*\n` + x.map((i) => `☐ ${i.qty} × ${i.name}`).join('\n') : ''; }).filter(Boolean).join('\n\n');
    setText({ title: 'Lista de compras', text: it.length ? txt : 'Nada para comprar. Tudo separado.', phone: '' });
  };
  const regen = () => {
    const nw = makeChecklist(e.tables, estTattoos(e, all.settings.avgMin)).map((i) => { const o = c.find((x) => x.name === i.name); return o ? { ...i, id: o.id, status: o.status } : i; });
    setC([...nw, ...c.filter((o) => !nw.some((n) => n.name === o.name))], 'Quantidades recalculadas.');
  };
  return (
    <>
      <h2 className="h2">Equipamentos e insumos</h2>
      <p className="muted" style={{ marginTop: -4 }}>Toque na situação para avançar: Faltando → Comprar → Separado → No carro → Voltou. Quantidades para {e.tables} mesas e cerca de {estTattoos(e, all.settings.avgMin)} tattoos.</p>
      <div className="row wrap" style={{ gap: 6 }}>{CHK_ST.map(([k, l]) => <span key={k} className={'tag' + (k === 'faltando' && counts[k] ? ' solid' : ' quiet')}>{l}: {counts[k] || 0}</span>)}</div>
      <div className="row wrap" style={{ marginTop: 14 }}>
        <button className="btn" onClick={shop}>Lista de compras</button>
        <button className="btn ghost" onClick={() => setAdd(true)}>Adicionar item</button>
        <button className="btn ghost" onClick={regen}>Recalcular quantidades</button>
      </div>
      <div className="grid two">
        {CHK_GROUPS.map((g) => {
          const its = c.filter((i) => i.group === g);
          if (!its.length) return null;
          return (
            <section key={g}>
              <h3 className="h3">{g}</h3>
              <div className="list">
                {its.map((i) => (
                  <div className="item row" key={i.id}>
                    <span className="grow">{i.name}</span>
                    <input className="inp money" style={{ width: 80, textAlign: 'right' }} type="number" min={0} inputMode="numeric" defaultValue={i.qty} aria-label={`Quantidade de ${i.name}`}
                      onBlur={(ev) => Number(ev.target.value) !== i.qty && setC(c.map((x) => (x.id === i.id ? { ...x, qty: Number(ev.target.value) || 0 } : x)))} />
                    <button className={'tag' + (i.status === 'faltando' ? ' solid' : i.status === 'voltou' || i.status === 'embalado' ? ' quiet' : '')} style={{ minWidth: 104 }} aria-label={`${i.name}: ${CHK_L[i.status]}. Tocar para avançar`}
                      onClick={() => setC(c.map((x) => (x.id === i.id ? { ...x, status: ks[(ks.indexOf(x.status) + 1) % ks.length] as ChecklistItem['status'] } : x)))}>
                      {CHK_L[i.status]}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {add && <AddItemModal onClose={() => setAdd(false)} onSave={(it) => setC([...c, { ...it, id: 'c' + uid(), status: 'faltando' }], 'Item adicionado.')} />}
    </>
  );
}
function AddItemModal({ onClose, onSave }: { onClose: () => void; onSave: (i: { name: string; group: string; qty: number }) => void }) {
  const [d, setD] = useState({ name: '', group: 'Insumos', qty: '1' });
  const [err, setErr] = useState('');
  return (
    <Modal title="Novo item" onClose={onClose}>
      <Field label="Item" error={err}>{(p) => <input className="inp" {...p} autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
      <Field label="Grupo">{(p) => <select className="inp" {...p} value={d.group} onChange={(e) => setD({ ...d, group: e.target.value })}>{CHK_GROUPS.map((g) => <option key={g}>{g}</option>)}</select>}</Field>
      <Field label="Quantidade">{(p) => <input className="inp" {...p} type="number" inputMode="numeric" value={d.qty} onChange={(e) => setD({ ...d, qty: e.target.value })} />}</Field>
      <button className="btn block" style={{ marginTop: 16 }} onClick={() => { if (!d.name.trim()) return setErr('Escreva o nome do item.'); onSave({ name: d.name.trim(), group: d.group, qty: Number(d.qty) || 1 }); onClose(); }}>Adicionar</button>
    </Modal>
  );
}

/* ---------- Orçamento ---------- */
function Orcamento({ e, all, setText }: P) {
  const ops = useOps();
  const b = e.budget;
  const c = budgetCalc(e, all.settings);
  const costs = b.costs || [];
  const setCosts = (k: typeof costs) => ops.patchEvent(e.id, { budget: { costs: k } });
  return (
    <div className="grid two">
      <section>
        <h2 className="h2">Orçamento</h2>
        <div className="card">
          <div className="form2">
            <SaveInput label="Valor do contrato (R$)" type="number" inputMode="decimal" value={b.fee || 0} onSave={(v) => ops.patchEvent(e.id, { budget: { fee: Number(v) || 0 } })} />
            <SaveInput label="Preço médio da flash (R$)" type="number" inputMode="decimal" value={b.avgTicket || 0} onSave={(v) => ops.patchEvent(e.id, { budget: { avgTicket: Number(v) || 0 } })} />
            <SaveInput label="% do público que tatua" type="number" inputMode="decimal" value={b.conv ?? 6} onSave={(v) => ops.patchEvent(e.id, { budget: { conv: Number(v) || 0 } })} />
            <SaveInput label="Público estimado" type="number" inputMode="numeric" value={e.public || 0} onSave={(v) => ops.patchEvent(e.id, { public: Number(v) || 0 })} />
          </div>
          <p className="muted">Capacidade: {e.tables} mesas × {hoursOf(e).toFixed(1).replace('.0', '')} h ÷ {all.settings.avgMin || 25} min por tattoo. Previsão: <b style={{ color: 'var(--ink)' }}>{c.est} tattoos</b>.</p>
        </div>
        <h3 className="h3">Custos do evento</h3>
        <div className="list">
          {costs.map((k) => (
            <div className="item row" key={k.id}>
              <input className="inp grow" defaultValue={k.name} aria-label="Descrição do custo" onBlur={(ev) => ev.target.value !== k.name && setCosts(costs.map((x) => (x.id === k.id ? { ...x, name: ev.target.value } : x)))} />
              <input className="inp money" style={{ width: 110, textAlign: 'right' }} type="number" inputMode="decimal" defaultValue={k.value} aria-label={`Valor de ${k.name}`}
                onBlur={(ev) => Number(ev.target.value) !== k.value && setCosts(costs.map((x) => (x.id === k.id ? { ...x, value: Number(ev.target.value) || 0 } : x)))} />
              <button className="iconbtn" aria-label={`Remover ${k.name}`} onClick={() => setCosts(costs.filter((x) => x.id !== k.id))}>✕</button>
            </div>
          ))}
          <div className="item"><button className="link" onClick={() => setCosts([...costs, { id: 'k' + uid(), name: 'Novo custo', value: 0 }])}>+ Adicionar custo</button></div>
        </div>
      </section>
      <section>
        <h2 className="h2">Resultado previsto</h2>
        <div className="card">
          <div className="kv"><span>Contrato com o parceiro</span><span className="money">{brl(c.fee)}</span></div>
          <div className="kv"><span>Venda de flashs ({c.est} × {brl(b.avgTicket || 0)})</span><span className="money">{brl(c.sales)}</span></div>
          <div className="kv"><span>Comissão dos tatuadores ({all.settings.commission || 50}%)</span><span className="money">− {brl(c.comm)}</span></div>
          <div className="kv"><span>Insumos (≈ R$ 18 por tattoo)</span><span className="money">− {brl(c.supplies)}</span></div>
          <div className="kv"><span>Outros custos</span><span className="money">− {brl(c.costs)}</span></div>
          <div className="kv total"><span>Resultado{c.result < 0 ? ' (prejuízo)' : ''}</span><span className="money">{brl(c.result)}</span></div>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => setText({ title: 'Proposta', text: proposalText(e, all.settings), phone: e.partner?.phone || '' })}>Gerar proposta para o parceiro</button>
      </section>
    </div>
  );
}

/* ---------- Treino ---------- */
function Treino({ e, all }: P) {
  const ops = useOps();
  const [mod, setMod] = useState<string | null>(null);
  const team = e.team || [];
  const md = MODULES.find((m) => m.id === mod);
  return (
    <div className="grid two">
      <section>
        <h2 className="h2">Treinamento da equipe</h2>
        <p className="muted" style={{ marginTop: -4 }}>Toque no módulo para ver o conteúdo e mandar para a equipe.</p>
        <div className="list">
          {MODULES.map((m) => (
            <button key={m.id} className="item tap row" style={{ display: 'flex' }} onClick={() => setMod(m.id)}>
              <span className="tag quiet" style={{ minWidth: 56, justifyContent: 'center' }}>{m.short}</span><span className="grow">{m.name}</span><span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="h2">Quem já fez</h2>
        {!team.length ? <div className="card">Escale a equipe para acompanhar o treino.</div> : (
          <>
            <div className="list matrix">
              {team.map((t) => {
                const a = all.artists.find((x) => x.id === t.artistId);
                if (!a) return null;
                const tr = e.training?.[a.id] || {};
                return (
                  <div className="mrow" key={a.id}>
                    <span className="grow"><b>{first(a.name)}</b> <span className="muted">{MODULES.filter((m) => tr[m.id]).length}/{MODULES.length}</span></span>
                    {MODULES.map((m) => (
                      <button key={m.id} className="mbtn" aria-pressed={!!tr[m.id]} aria-label={`${first(a.name)}: ${m.name}${tr[m.id] ? ' (feito)' : ''}`}
                        onClick={() => ops.patchEvent(e.id, { training: { [a.id]: { [m.id]: !tr[m.id] } } })}>{m.short}</button>
                    ))}
                  </div>
                );
              })}
            </div>
            <a className="btn ghost" style={{ marginTop: 14 }} target="_blank" rel="noopener" href={waShare(trainingText(e))}>Mandar protocolo no grupo</a>
          </>
        )}
      </section>
      {md && (
        <Modal title={md.name} onClose={() => setMod(null)}>
          <ul style={{ paddingLeft: 20 }}>{md.items.map((i) => <li key={i} style={{ margin: '8px 0' }}>{i}</li>)}</ul>
          <p className="muted">Conteúdo-base para treinar a equipe. Confira as normas sanitárias do seu município e estado.</p>
          <a className="btn" target="_blank" rel="noopener" href={waShare('*' + md.name + '*\n' + md.items.map((i) => '• ' + i).join('\n'))}>Mandar para a equipe</a>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Catálogo do evento ---------- */
function CatalogoTab({ e }: P) {
  const ops = useOps();
  const on = e.cats?.length ? e.cats : null;
  const n = DESIGNS.filter((d) => !on || d.cats.some((c) => on.includes(c))).length;
  const toggle = (c: string) => { const s = new Set(e.cats || []); if (s.has(c)) s.delete(c); else s.add(c); ops.patchEvent(e.id, { cats: [...s] }); };
  return (
    <>
      <h2 className="h2">Catálogo do evento</h2>
      <p className="muted" style={{ marginTop: -4 }}>Escolha os temas que aparecem para os clientes no QR. Nenhum marcado mostra tudo.</p>
      <Chips label="Temas" multi options={CATS} value={e.cats || []} onChange={toggle} />
      <div className="row wrap" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={() => ops.patchEvent(e.id, { cats: TYPE_CATS[e.type] || [] })}>Sugestão para {e.type}</button>
        <button className="btn ghost" onClick={() => ops.patchEvent(e.id, { cats: [] })}>Mostrar tudo</button>
      </div>
      <p style={{ marginTop: 14 }}><b>{n}</b> desenhos neste evento.</p>
    </>
  );
}

/* ---------- Hoje (dentro do evento) ---------- */
function HojeTab({ e, all }: P) {
  const b = useBackend();
  const ops = useOps();
  const live = all.settings.liveEventId === e.id;
  const other = all.settings.liveEventId && all.settings.liveEventId !== e.id ? all.events.find((x) => x.id === all.settings.liveEventId) : undefined;
  const src = ownerSource(b, all);
  if (!live)
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ marginTop: 0 }}>Abra o evento para os clientes verem o catálogo, preencherem a ficha e entrarem na fila pelo QR code. O atendimento também passa a ver este evento.</p>
        <button className="btn block lg" onClick={() => ops.patchSettings({ liveEventId: e.id }, 'Evento aberto para os clientes.')}>Abrir para os clientes</button>
        {other && <p className="muted">Isso fecha o evento aberto agora: {other.name}.</p>}
      </div>
    );
  return <LiveBoard src={src} mesaHref="/painel/mesa" />;
}

/* ---------- Fechamento ---------- */
function Fechamento({ e, all, setText }: P) {
  const ops = useOps();
  const toast = useToast();
  const [extra, setExtra] = useState(false);
  const c = closingCalc(e, all.tickets, all.artists, all.settings);
  const cl = e.closing || { paid: {}, feeReceived: false, extra: [], closedAt: null };
  const closed = e.stage === 'fechado';
  const csv = () => {
    const blob = new Blob(['﻿' + closingCsv(e, all.tickets, all.artists)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fechamento-${e.date}-${e.name.replace(/\W+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="grid two">
      <section>
        <h2 className="h2">Fechamento de caixa</h2>
        {closed && <p className="note">Fechado em {cl.closedAt ? new Date(cl.closedAt).toLocaleDateString('pt-BR') : ''}.</p>}
        <div className="card">
          <div className="kv"><span>{c.tix.length} tattoos pagas</span><span className="money">{brl(c.sales)}</span></div>
          {Object.entries(PAY).map(([k, l]) => <div className="kv" key={k}><span className="muted">{l}</span><span className="money">{brl(c.byM[k] || 0)}</span></div>)}
        </div>
        <h3 className="h3">Pagamento da equipe</h3>
        {Object.keys(c.arts).length ? (
          <div className="list">
            {Object.entries(c.arts).map(([id, r]) => {
              const a = all.artists.find((x) => x.id === id);
              return (
                <div className="item" key={id}>
                  <div className="row"><span className="grow"><b>{a?.name || 'Tatuador'}</b><br /><span className="muted">{r.n} tattoo{r.n > 1 ? 's' : ''} · {brl(r.gross)} · {r.pct}%</span></span><b className="money">{brl(r.pay)}</b></div>
                  <div className="row wrap">
                    <Check checked={!!cl.paid?.[id]} onChange={(v) => ops.patchEvent(e.id, { closing: { paid: { [id]: v } } })}>Pago</Check>
                    {a?.phone && <a className="link right" target="_blank" rel="noopener" href={waLink(a.phone, `Oi, ${first(a.name)}! Fechamento do ${e.name}: ${r.n} tattoos, total ${brl(r.gross)}. Sua parte (${r.pct}%): ${brl(r.pay)}. Obrigada pelo trampo! 🖤`)}>Enviar extrato</a>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="muted">Nenhuma tattoo paga com tatuador registrado.</p>}
      </section>
      <section>
        <h2 className="h2">Custos e repasses</h2>
        <div className="card">
          <Check checked={!!cl.feeReceived} onChange={(v) => ops.patchEvent(e.id, { closing: { feeReceived: v } })}>Contrato do parceiro recebido · {brl(c.fee)}</Check>
          <SaveInput label="Insumos usados (R$)" type="number" inputMode="decimal" value={c.supplies} onSave={(v) => ops.patchEvent(e.id, { closing: { supplies: Number(v) || 0 } })} />
          {(e.budget?.costs || []).map((k) => <div className="kv" key={k.id}><span>{k.name}</span><span className="money">{brl(k.value)}</span></div>)}
          {(cl.extra || []).map((k, i) => (
            <div className="kv" key={i}><span>{k.name}</span><span className="row" style={{ gap: 8 }}><span className="money">{brl(k.value)}</span>
              <button className="iconbtn" aria-label={`Remover ${k.name}`} onClick={() => { const ex = clone(cl.extra || []); ex.splice(i, 1); ops.patchEvent(e.id, { closing: { extra: ex } }); }}>✕</button></span></div>
          ))}
          <button className="link" onClick={() => setExtra(true)}>+ Custo extra</button>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="kv"><span>Vendas</span><span className="money">{brl(c.sales)}</span></div>
          <div className="kv"><span>Contrato</span><span className="money">{brl(c.fee)}</span></div>
          <div className="kv"><span>Comissões</span><span className="money">− {brl(c.comm)}</span></div>
          <div className="kv"><span>Insumos</span><span className="money">− {brl(c.supplies)}</span></div>
          <div className="kv"><span>Custos</span><span className="money">− {brl(c.costs)}</span></div>
          <div className="kv total"><span>Resultado do evento{c.result < 0 ? ' (prejuízo)' : ''}</span><span className="money">{brl(c.result)}</span></div>
        </div>
        <div className="row wrap" style={{ marginTop: 14 }}>
          {!closed && <button className="btn" onClick={() => ops.patchEvent(e.id, { stage: 'fechado', closing: { closedAt: Date.now() } }, 'Evento fechado.')}>Fechar evento</button>}
          <button className="btn ghost" onClick={() => copyText(closingText(e, all.tickets, all.artists, all.settings), toast)}>Copiar resumo</button>
          <button className="btn ghost" onClick={csv}>Baixar planilha (CSV)</button>
          <button className="btn ghost" onClick={() => setText({ title: 'Resumo do fechamento', text: closingText(e, all.tickets, all.artists, all.settings), phone: '' })}>Ver resumo</button>
        </div>
      </section>
      {extra && <ExtraModal onClose={() => setExtra(false)} onSave={(x) => ops.patchEvent(e.id, { closing: { extra: [...(cl.extra || []), x] } })} />}
    </div>
  );
}
function ExtraModal({ onClose, onSave }: { onClose: () => void; onSave: (x: { name: string; value: number }) => void }) {
  const [d, setD] = useState({ name: '', value: '' });
  const [err, setErr] = useState('');
  return (
    <Modal title="Custo extra" onClose={onClose}>
      <Field label="Descrição" error={err}>{(p) => <input className="inp" {...p} autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
      <Field label="Valor (R$)">{(p) => <input className="inp" {...p} type="number" inputMode="decimal" value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} />}</Field>
      <button className="btn block" style={{ marginTop: 16 }} onClick={() => { if (!d.name.trim()) return setErr('Escreva a descrição.'); onSave({ name: d.name.trim(), value: Number(d.value) || 0 }); onClose(); }}>Adicionar</button>
    </Modal>
  );
}
