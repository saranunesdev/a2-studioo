import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { applyQueueOp, deskData, makeTicket, publicDoc, queueOf, waitInfo, type QueueState } from './queue';
import type { Ticket } from './types';

const data = () => seedData(Date.UTC(2026, 10, 7, 21, 50));
const live = () => {
  const d = data();
  const event = d.events.find((e) => e.id === 'e_live')!;
  return { d, s: { event, tickets: d.tickets.filter((t) => t.eventId === event.id) } as QueueState };
};

describe('fila', () => {
  it('pagar coloca o pedido na fila e não cobra duas vezes', () => {
    const { s } = live();
    const t = s.tickets.find((x) => x.status === 'aguardando_pagamento')!;
    const a = applyQueueOp(s, { type: 'pay', ticketId: t.id, method: 'pix' }, 1000);
    const paid = a.tickets.find((x) => x.id === t.id)!;
    expect(paid.status).toBe('na_fila');
    expect(paid.pay?.amount).toBe(t.flash.price);
    const b = applyQueueOp(a, { type: 'pay', ticketId: t.id, method: 'cartao' }, 2000);
    expect(b.tickets.find((x) => x.id === t.id)!.pay?.method).toBe('pix');
  });

  it('liberar a mesa chama o primeiro da fila nessa mesa', () => {
    const { s } = live();
    const tb = s.event.tableState[0];
    const cur = s.tickets.find((x) => x.id === tb.ticketId)!;
    const first = queueOf(s.tickets, s.event.id)[0];
    let r = s;
    if (cur.status === 'chamado') r = applyQueueOp(r, { type: 'start', ticketId: cur.id }, 10);
    r = applyQueueOp(r, { type: 'finish', ticketId: cur.id }, 20);
    expect(r.tickets.find((x) => x.id === cur.id)!.status).toBe('concluido');
    const called = r.tickets.find((x) => x.id === first.id)!;
    expect(called.status).toBe('chamado');
    expect(called.table).toBe(tb.n);
    expect(r.event.tableState[0].ticketId).toBe(first.id);
  });

  it('duas mesas liberando ao mesmo tempo nunca chamam o mesmo cliente', () => {
    const { s } = live();
    const [t1, t2] = s.event.tableState.slice(0, 2).map((tb) => tb.ticketId!);
    let r = s;
    for (const id of [t1, t2]) {
      const st = r.tickets.find((x) => x.id === id)!.status;
      if (st === 'chamado') r = applyQueueOp(r, { type: 'start', ticketId: id }, 5);
    }
    r = applyQueueOp(r, { type: 'finish', ticketId: t1 }, 100);
    r = applyQueueOp(r, { type: 'finish', ticketId: t2 }, 100);
    const ids = r.event.tableState.map((tb) => tb.ticketId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    const calledTables = r.tickets.filter((t) => t.status === 'chamado' || t.status === 'em_atendimento').map((t) => t.table);
    expect(new Set(calledTables).size).toBe(calledTables.length);
  });

  it('mesa pausada ou sem tatuador não recebe cliente', () => {
    const { s } = live();
    const n = s.event.tableState[0].n;
    let r = applyQueueOp(s, { type: 'pause', eventId: s.event.id, n }, 1);
    const cur = r.event.tableState[0].ticketId!;
    if (r.tickets.find((t) => t.id === cur)!.status === 'chamado') r = applyQueueOp(r, { type: 'start', ticketId: cur }, 2);
    r = applyQueueOp(r, { type: 'finish', ticketId: cur }, 3);
    expect(r.event.tableState[0].ticketId).toBeNull();
    r = applyQueueOp(r, { type: 'pause', eventId: s.event.id, n }, 4);
    expect(r.event.tableState[0].ticketId).not.toBeNull();
  });

  it('não apareceu volta para o fim da fila', () => {
    const { s } = live();
    let r = s;
    const called = r.tickets.find((t) => t.status === 'chamado');
    if (!called) return;
    r = applyQueueOp(r, { type: 'noshow', ticketId: called.id }, 9e15);
    const q = queueOf(r.tickets, s.event.id);
    const me = r.tickets.find((t) => t.id === called.id)!;
    expect(['na_fila', 'chamado']).toContain(me.status);
    if (me.status === 'na_fila') expect(q[q.length - 1].id).toBe(called.id);
  });

  it('pedido de balcão já pago entra direto na fila', () => {
    const { s } = live();
    const t = makeTicket(
      { eventId: s.event.id, name: 'Teste', phone: '', flash: { sheet: 0, n: 1, size: 'M', tier: 'D', price: 280 }, bodyPart: 'Pulso', anamnese: {}, alerts: [], source: 'balcao', payMethod: 'dinheiro' },
      'x1', new Set(s.tickets.map((x) => x.code)), 5,
    );
    expect(t.status).toBe('na_fila');
    expect(s.tickets.map((x) => x.code)).not.toContain(t.code);
  });
});

describe('recortes de acesso', () => {
  it('a fila pública não tem nomes, telefones nem saúde', () => {
    const { d } = live();
    const p = publicDoc(d)!;
    const json = JSON.stringify(p);
    for (const t of d.tickets) {
      if (t.phone) expect(json).not.toContain(t.phone);
      expect(json).not.toContain(t.name);
    }
    expect(json).not.toContain('anamnese');
  });

  it('o atendimento não recebe orçamento, contratos, agenda nem outros eventos', () => {
    const { d } = live();
    const k = deskData(d)!;
    const json = JSON.stringify(k);
    expect(json).not.toContain('budget');
    expect(json).not.toContain('partner');
    expect(json).not.toContain('contract');
    expect(k.tickets.every((t: Ticket) => t.eventId === 'e_live')).toBe(true);
    expect(json).not.toContain('Casamento Júlia');
  });

  it('posição e espera estimada', () => {
    const { d } = live();
    const p = publicDoc(d)!;
    const w = waitInfo(p, p.waiting[0]);
    expect(w.pos).toBe(1);
    expect(w.wait).toBeGreaterThan(0);
    expect(waitInfo(p, 'ZZZ').pos).toBe(0);
  });
});
