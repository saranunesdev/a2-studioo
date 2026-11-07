import { useMemo, useState } from 'react';
import { CELLS, DESIGNS, SHEET_META, sheetUrl } from '../../data/catalog';
import { BODY, BODY_EN, CATS, CATS_EN, HEALTH, IMG_H, IMG_W, PAY } from '../../data/constants';
import { sizeLabel, useT } from '../../lib/i18n';
import { minPrice, priceOf } from '../../lib/rules';
import type { Anamnese, Flash, PayMethod, Prices, PublicLive, Size, TicketInput } from '../../lib/types';
import { ageOf, brl, digits, pad, today } from '../../lib/util';
import { Check, Field, FlashCrop, Modal, Thumb, flashAlt, useToast } from '../../components/ui';

type Pub = Pick<PublicLive, 'eventId' | 'cats' | 'prices'>;

/* ---------- Catálogo ---------- */
export function Catalog({ pub, onPick }: { pub: Pub; onPick: (f: Flash) => void }) {
  const { t, lang } = useT();
  const [f, setF] = useState<{ cat: string; size: Size | ''; max: number; show: number }>({ cat: 'Todas', size: '', max: 0, show: 60 });
  const [open, setOpen] = useState<{ s: number; n: number } | null>(null);
  const on = pub.cats?.length ? pub.cats : null;
  const cats = on || CATS;
  const list = useMemo(
    () =>
      DESIGNS.filter(
        (d) =>
          (!on || d.cats.some((c) => on.includes(c))) &&
          (f.cat === 'Todas' || d.cats.includes(f.cat)) &&
          (!f.size || priceOf(pub.prices, d.tier, f.size) != null) &&
          (!f.max || (minPrice(pub.prices, d.tier, f.size) ?? 1e9) <= f.max),
      ),
    [on, f.cat, f.size, f.max, pub.prices],
  );
  const allP = [...new Set((['F', 'D'] as const).flatMap((tier) => (['P', 'M', 'G'] as Size[]).map((z) => priceOf(pub.prices, tier, z))).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const catL = (c: string) => (lang === 'en' ? CATS_EN[c] || c : c);
  return (
    <>
      <p className="lbl" style={{ fontWeight: 600, margin: '8px 0 6px' }} id="f-theme">{t.theme}</p>
      <div className="chips" role="group" aria-labelledby="f-theme">
        {['Todas', ...cats].map((c) => (
          <button key={c} className="chip" aria-pressed={f.cat === c} onClick={() => setF({ ...f, cat: c, show: 60 })}>{c === 'Todas' ? t.all : catL(c)}</button>
        ))}
      </div>
      <div className="form2">
        <div>
          <p style={{ fontWeight: 600, margin: '12px 0 6px' }} id="f-size">{t.size}</p>
          <div className="seg" role="group" aria-labelledby="f-size">
            {([['', t.all], ['P', sizeLabel(lang, 'P')], ['M', 'M'], ['G', sizeLabel(lang, 'G')]] as [Size | '', string][]).map(([k, l]) => (
              <button key={k} aria-pressed={f.size === k} onClick={() => setF({ ...f, size: k, show: 60 })}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontWeight: 600, margin: '12px 0 6px' }} id="f-price">{t.price}</p>
          <div className="chips" role="group" aria-labelledby="f-price">
            {[0, ...allP].map((v) => (
              <button key={v} className="chip" aria-pressed={f.max === v} onClick={() => setF({ ...f, max: v, show: 60 })}>{v ? t.upTo(brl(v)) : t.anyPrice}</button>
            ))}
          </div>
        </div>
      </div>
      <p className="muted" aria-live="polite">{t.designs(list.length)}</p>
      {!list.length && (
        <div className="card center">{t.noDesigns} <button className="link" onClick={() => setF({ cat: 'Todas', size: '', max: 0, show: 60 })}>{t.clearFilters}</button></div>
      )}
      <div className="tiles">
        {list.slice(0, f.show).map((d) => {
          const alt = flashAlt(d.s, d.n, f.size || undefined, lang);
          return (
            <button key={d.s + '-' + d.n} className="tile" onClick={() => setOpen({ s: d.s, n: d.n })} aria-label={`${alt} · ${brl(minPrice(pub.prices, d.tier, f.size))}`}>
              <span className="box"><FlashCrop sheet={d.s} n={d.n} alt={alt} /></span>
              <span className="meta" aria-hidden="true"><span>{SHEET_META[d.s][0]} {pad(d.n)}</span><span>{brl(minPrice(pub.prices, d.tier, f.size))}</span></span>
            </button>
          );
        })}
      </div>
      {list.length > f.show && <button className="btn ghost block" style={{ marginTop: 16 }} onClick={() => setF({ ...f, show: f.show + 120 })}>{t.showMore(list.length - f.show)}</button>}
      {open && <DesignModal s={open.s} n={open.n} prices={pub.prices} initial={f.size} onClose={() => setOpen(null)} onPick={(fl) => { setOpen(null); onPick(fl); }} />}
    </>
  );
}

function DesignModal({ s, n, prices, initial, onClose, onPick }: { s: number; n: number; prices: Prices; initial: Size | ''; onClose: () => void; onPick: (f: Flash) => void }) {
  const { t, lang } = useT();
  const tier = SHEET_META[s][2];
  const first: Size = initial && priceOf(prices, tier, initial) != null ? initial : priceOf(prices, tier, 'P') != null ? 'P' : 'M';
  const [size, setSize] = useState<Size>(first);
  const [full, setFull] = useState(false);
  const c = CELLS[s][n - 1];
  const price = priceOf(prices, tier, size);
  const alt = flashAlt(s, n, size, lang);
  return (
    <Modal title={`${SHEET_META[s][0]} nº ${pad(n)}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{SHEET_META[s][1].map((x) => (lang === 'en' ? CATS_EN[x] || x : x)).join(' · ')} · {tier === 'D' ? t.detailed : t.fine}</p>
      <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'min(46vh, 340px)', padding: 16 }}>
        {full ? (
          <div className="sheetimg" style={{ height: '100%', aspectRatio: `${IMG_W}/${IMG_H}` }}>
            <img src={sheetUrl(s)} alt={`${SHEET_META[s][0]}: prancha completa, desenho ${n} destacado`} />
            <span className="hl" style={{ left: `${c[0] * 100}%`, top: `${c[1] * 100}%`, width: `${(c[2] - c[0]) * 100}%`, height: `${(c[3] - c[1]) * 100}%` }} />
          </div>
        ) : <FlashCrop sheet={s} n={n} alt={alt} />}
      </div>
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setFull(!full)}>{full ? t.seeAlone : t.seeOnSheet}</button>
      <p style={{ fontWeight: 600, margin: '18px 0 6px' }} id="d-size">{t.size}</p>
      <div className="seg" role="group" aria-labelledby="d-size">
        {(['P', 'M', 'G'] as Size[]).map((z) => {
          const p = priceOf(prices, tier, z);
          return (
            <button key={z} aria-pressed={size === z} disabled={p == null} onClick={() => setSize(z)} aria-label={`${sizeLabel(lang, z)} · ${p == null ? t.notAvailable : brl(p)}`}>
              {sizeLabel(lang, z)} · {p == null ? '—' : brl(p)}
            </button>
          );
        })}
      </div>
      <p className="muted">{t.sizeHelp}</p>
      <button className="btn block lg" style={{ marginTop: 12 }} disabled={price == null} onClick={() => onPick({ sheet: s, n, size, tier, price })}>
        {price != null ? t.choose(brl(price)) : t.chooseSize}
      </button>
    </Modal>
  );
}

/* ---------- Ficha (anamnese) ---------- */
interface Draft {
  name: string; phone: string; nascimento: string; cpf: string; email: string; instagram: string; cidade: string;
  bodyPart: string; primeira: boolean; comoConheceu: string; saude: Record<string, boolean>; detalhes: string;
  termos: { verdade: boolean; ciente: boolean; whatsapp: boolean; imagem: boolean }; resp: { nome: string; cpf: string };
}
const emptyDraft = (): Draft => ({
  name: '', phone: '', nascimento: '', cpf: '', email: '', instagram: '', cidade: '', bodyPart: '', primeira: false,
  comoConheceu: '', saude: Object.fromEntries(HEALTH.map(([k]) => [k, false])), detalhes: '',
  termos: { verdade: false, ciente: false, whatsapp: true, imagem: false }, resp: { nome: '', cpf: '' },
});

export function validateDraft(d: Draft, t: ReturnType<typeof useT>['t'], ref = today()) {
  const er: Record<string, string> = {};
  if (d.name.trim().length < 3 || !d.name.trim().includes(' ')) er.name = t.errName;
  if (digits(d.phone).length < 10) er.phone = t.errPhone;
  if (!d.nascimento || ageOf(d.nascimento, ref) < 0 || ageOf(d.nascimento, ref) > 120) er.nascimento = t.errBirth;
  if (!d.bodyPart) er.bodyPart = t.errBody;
  if (!d.termos.verdade || !d.termos.ciente) er.termos = t.errTerms;
  if (d.nascimento && ageOf(d.nascimento, ref) < 18 && !d.resp.nome.trim()) er.resp = t.errGuardian;
  return er;
}

export function ClientForm({ pick, eventId, tablet, onBack, submit, onDone }: {
  pick: Flash; eventId: string; tablet?: boolean; onBack: () => void;
  submit: (i: TicketInput) => Promise<{ id: string; code: string }>; onDone: (r: { id: string; code: string }) => void;
}) {
  const { t, lang } = useT();
  const toast = useToast();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [er, setEr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const minor = !!d.nascimento && ageOf(d.nascimento) < 18 && ageOf(d.nascimento) >= 0;
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const bodyL = (x: string) => (lang === 'en' ? BODY_EN[x] || x : x);

  const send = async (payMethod: PayMethod | null = null) => {
    const e = validateDraft(d, t);
    setEr(e);
    if (Object.keys(e).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .err')?.focus?.(), 300);
      return;
    }
    const alerts = HEALTH.filter(([k]) => d.saude[k]).map(([, l]) => l);
    if (minor) alerts.unshift('Menor de idade: conferir responsável presente');
    const anamnese: Anamnese = {
      nascimento: d.nascimento, cpf: d.cpf, email: d.email, instagram: d.instagram, cidade: d.cidade, primeira: d.primeira,
      comoConheceu: d.comoConheceu, saude: d.saude, detalhes: d.detalhes, termos: d.termos, responsavel: minor ? d.resp : null,
    };
    setBusy(true);
    try {
      const r = await submit({
        eventId, name: d.name.trim(), phone: digits(d.phone), flash: pick, bodyPart: d.bodyPart, anamnese, alerts,
        source: tablet ? 'tablet' : 'qr', lang, payMethod,
      });
      onDone(r);
    } catch {
      toast(t.sendFail);
    } finally {
      setBusy(false);
    }
  };
  const errCount = Object.keys(er).length;

  return (
    <>
      <div className="card row" style={{ marginTop: 8 }}>
        <Thumb flash={pick} size={72} alt={flashAlt(pick.sheet, pick.n, pick.size, lang)} />
        <div className="grow"><b>{SHEET_META[pick.sheet][0]} nº {pad(pick.n)}</b><div className="muted">{t.size} {sizeLabel(lang, pick.size)} · {brl(pick.price)}</div></div>
        <button className="link" onClick={onBack}>{t.change}</button>
      </div>
      {errCount > 0 && <div className="alert" role="alert" style={{ marginTop: 14 }} tabIndex={-1}><strong>{t.checkFields}</strong></div>}

      <h2 className="h2">{t.yourData}</h2>
      <Field label={t.fullName} error={er.name}>{(p) => <input className="inp" {...p} autoComplete={tablet ? 'off' : 'name'} value={d.name} onChange={(e) => up({ name: e.target.value })} />}</Field>
      <Field label={t.whatsapp} error={er.phone}>{(p) => <input className="inp" {...p} type="tel" inputMode="tel" autoComplete={tablet ? 'off' : 'tel'} value={d.phone} onChange={(e) => up({ phone: e.target.value })} />}</Field>
      <div className="form2">
        <Field label={t.birth} error={er.nascimento}>{(p) => <input className="inp" {...p} type="date" max={today()} value={d.nascimento} onChange={(e) => up({ nascimento: e.target.value })} />}</Field>
        <Field label={t.cpf}>{(p) => <input className="inp" {...p} inputMode="numeric" value={d.cpf} onChange={(e) => up({ cpf: e.target.value })} />}</Field>
        <Field label={t.email}>{(p) => <input className="inp" {...p} type="email" autoComplete={tablet ? 'off' : 'email'} value={d.email} onChange={(e) => up({ email: e.target.value })} />}</Field>
        <Field label={t.instagram}>{(p) => <input className="inp" {...p} value={d.instagram} onChange={(e) => up({ instagram: e.target.value })} />}</Field>
        <Field label={t.city}>{(p) => <input className="inp" {...p} value={d.cidade} onChange={(e) => up({ cidade: e.target.value })} />}</Field>
      </div>
      {minor && (
        <>
          <p className="note" style={{ marginTop: 16 }} role="note">{t.minorNote}</p>
          <div className="form2">
            <Field label={t.guardianName} error={er.resp}>{(p) => <input className="inp" {...p} value={d.resp.nome} onChange={(e) => up({ resp: { ...d.resp, nome: e.target.value } })} />}</Field>
            <Field label={t.guardianCpf}>{(p) => <input className="inp" {...p} inputMode="numeric" value={d.resp.cpf} onChange={(e) => up({ resp: { ...d.resp, cpf: e.target.value } })} />}</Field>
          </div>
        </>
      )}

      <h2 className="h2">{t.theTattoo}</h2>
      <p style={{ fontWeight: 600, margin: '0 0 6px' }} id="f-body">{t.where}</p>
      <div className="chips wrap" role="group" aria-labelledby="f-body" aria-describedby={er.bodyPart ? 'e-body' : undefined}>
        {BODY.map((x) => <button key={x} className="chip" aria-pressed={d.bodyPart === x} onClick={() => up({ bodyPart: x })}>{bodyL(x)}</button>)}
      </div>
      {er.bodyPart && <span className="err" id="e-body">{er.bodyPart}</span>}
      <Check checked={d.primeira} onChange={(v) => up({ primeira: v })}>{t.firstTattoo}</Check>

      <h2 className="h2">{t.health}</h2>
      <p className="muted" style={{ marginTop: -4 }}>{t.healthHelp}</p>
      <div className="list">
        {HEALTH.map(([k, l, en]) => (
          <label key={k} className="item check">
            <input type="checkbox" checked={d.saude[k]} onChange={(e) => up({ saude: { ...d.saude, [k]: e.target.checked } })} />
            <span>{lang === 'en' ? en : l}</span>
          </label>
        ))}
      </div>
      {Object.values(d.saude).some(Boolean) && (
        <Field label={t.tellMore} hint={t.tellMoreHint}>{(p) => <textarea className="inp" {...p} value={d.detalhes} onChange={(e) => up({ detalhes: e.target.value })} />}</Field>
      )}
      <Field label={t.howFound}>
        {(p) => (
          <select className="inp" {...p} value={d.comoConheceu} onChange={(e) => up({ comoConheceu: e.target.value })}>
            <option value="">{t.pick}</option>
            {t.howOpts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
      </Field>

      <h2 className="h2">{t.terms}</h2>
      <Check checked={d.termos.verdade} onChange={(v) => up({ termos: { ...d.termos, verdade: v } })}>{t.termTrue}</Check>
      <Check checked={d.termos.ciente} onChange={(v) => up({ termos: { ...d.termos, ciente: v } })}>{t.termAware}</Check>
      {er.termos && <span className="err">{er.termos}</span>}
      <Check checked={d.termos.whatsapp} onChange={(v) => up({ termos: { ...d.termos, whatsapp: v } })}>{t.termWa}</Check>
      <Check checked={d.termos.imagem} onChange={(v) => up({ termos: { ...d.termos, imagem: v } })}>{t.termImg}</Check>
      <p className="muted">{t.lgpd}</p>

      {tablet ? (
        <>
          <p style={{ fontWeight: 600, margin: '18px 0 8px' }}>Já pagou?</p>
          <div className="row wrap" style={{ gap: 8 }}>
            {(Object.entries(PAY) as [PayMethod, string][]).map(([k, l]) => <button key={k} className="btn grow" disabled={busy} onClick={() => send(k)}>Enviar · pagou no {l}</button>)}
          </div>
          <button className="btn ghost block" style={{ marginTop: 10 }} disabled={busy} onClick={() => send(null)}>Enviar · ainda não pagou</button>
        </>
      ) : (
        <button className="btn block lg" style={{ marginTop: 18 }} disabled={busy} onClick={() => send()}>{busy ? t.sending : t.send}</button>
      )}
    </>
  );
}
