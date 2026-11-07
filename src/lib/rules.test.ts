import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { artistAvail, budgetCalc, closingCalc, estTattoos, hoursOf, makeChecklist, nextCare, careMsg, priceOf } from './rules';
import { calledMsg, closingText, contractText, groupText, inviteText, promoText, proposalText, trainingText } from './texts';
import { ageOf, addDays, dKey, parseBlocked, waLink } from './util';

const d = seedData(Date.UTC(2026, 10, 7, 21, 50));
const ev = (id: string) => d.events.find((e) => e.id === id)!;

describe('regras', () => {
  it('horas do evento atravessando a meia-noite', () => {
    expect(hoursOf({ start: '19:00', end: '02:00' })).toBe(7);
    expect(hoursOf({ start: '12:00', end: '23:00' })).toBe(11);
  });

  it('previsão de tattoos limitada pela capacidade das mesas', () => {
    const e = ev('e_live');
    const n = estTattoos(e, 25);
    expect(n).toBeLessThanOrEqual(Math.round((e.tables * hoursOf(e) * 60) / 25));
    expect(n).toBeGreaterThan(0);
  });

  it('checklist proporcional às mesas e às tattoos', () => {
    const c = makeChecklist(3, 40);
    expect(c.find((i) => i.name.startsWith('Luvas'))!.qty).toBe(120);
    expect(c.find((i) => i.name.startsWith('Máquina'))!.qty).toBe(4);
    expect(c.every((i) => i.status === 'faltando')).toBe(true);
  });

  it('disponibilidade da equipe', () => {
    const e = { id: 'novo', date: d.events[0].date };
    const a = d.artists[0];
    expect(artistAvail({ ...a, blocked: [e.date] }, e, d.events)).toBe('bloqueado');
    expect(artistAvail(a, e, d.events)).toBe('outro evento');
  });

  it('orçamento e fechamento', () => {
    const b = budgetCalc(ev('e_live'), d.settings);
    expect(b.result).toBe(b.fee + b.sales - b.comm - b.costs - b.supplies);
    const c = closingCalc(ev('e_live'), d.tickets, d.artists, d.settings);
    expect(c.sales).toBe(Object.values(c.byM).reduce((s, v) => s + v, 0));
    expect(c.result).toBe(c.sales + c.fee - c.comm - c.costs - c.supplies);
  });

  it('pós-tattoo nos dias 1, 3, 7, 14 e 20', () => {
    const t = { doneAt: Date.UTC(2026, 10, 7, 15), care: {} as Record<string, number | boolean> };
    expect(nextCare(t)).toEqual({ d: 1, date: '2026-11-08' });
    t.care[1] = 1;
    t.care[3] = 1;
    expect(nextCare(t)!.d).toBe(7);
    t.care.skip = true;
    expect(nextCare(t)).toBeNull();
    const msg = careMsg({ name: 'Ana Souza', flash: { sheet: 0, n: 1, size: 'P', tier: 'F', price: 150 } }, 1, d.settings.templates, 'Festa');
    expect(msg).toContain('Ana');
    expect(msg).toContain('Festa');
  });

  it('preço por traço e tamanho', () => {
    expect(priceOf(d.settings.prices, 'F', 'P')).toBe(150);
    expect(priceOf(d.settings.prices, 'D', 'P')).toBeNull();
  });
});

describe('textos e utilidades', () => {
  it('gera todos os textos sem quebrar', () => {
    const e = ev('e_live');
    const a = d.artists.find((x) => x.id === e.team[0].artistId)!;
    for (const s of [inviteText(e, a, e.team[0], d.settings), groupText(e, d.artists), proposalText(e, d.settings), trainingText(e),
      contractText('partner', e, d.settings), contractText('artist', e, d.settings, a), promoText(e, d.settings),
      closingText(e, d.tickets, d.artists, d.settings)]) {
      expect(s.length).toBeGreaterThan(20);
      expect(s).not.toContain('undefined');
    }
    const t = { ...d.tickets[0], table: 2 };
    expect(calledMsg(t, 'Bruna Tavares')).toContain('mesa 2');
    expect(calledMsg(t, 'Bruna', 'en')).toContain('table 2');
  });

  it('link do WhatsApp com DDI do Brasil', () => {
    expect(waLink('(11) 98765-0001', 'oi')).toBe('https://wa.me/5511987650001?text=oi');
  });

  it('datas no fuso de São Paulo', () => {
    expect(dKey(new Date('2026-11-08T02:30:00Z'))).toBe('2026-11-07');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(ageOf('2008-11-08', '2026-11-07')).toBe(17);
    expect(ageOf('2008-11-07', '2026-11-07')).toBe(18);
    expect(parseBlocked('28/11, 05/12', '2026-11-07')).toEqual(['2026-11-28', '2026-12-05']);
  });
});
