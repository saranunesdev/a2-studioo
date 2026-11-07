import { MODULES, PAY, ROLES } from '../data/constants';
import { budgetCalc, closingCalc, minPrice, teamCount } from './rules';
import type { Artist, EventDoc, Settings, TeamMember, Ticket } from './types';
import { brl, first, fmtD, fmtDLong, fmtPhone } from './util';

export function inviteText(e: EventDoc, a: Artist, m: TeamMember, s: Settings) {
  return `Oi, ${first(a.name)}! Tudo bem? Quero te chamar para o ${e.name} (${e.type}).\n📅 ${fmtDLong(e.date)}, das ${e.start} às ${e.end}\n📍 ${e.venue}${e.address ? ' — ' + e.address : ''}\nFunção: ${ROLES[m.role] || m.role}${m.role !== 'atendimento' ? `\nComissão: ${a.commission || s.commission || 50}% das flashs` : ''}\nTopa? Me confirma por aqui que eu te mando o contrato.`;
}

export function groupText(e: EventDoc, artists: Artist[]) {
  const lines = (e.team || [])
    .map((m) => {
      const a = artists.find((x) => x.id === m.artistId);
      return a ? `• ${a.name} — ${ROLES[m.role] || m.role}` : '';
    })
    .filter(Boolean);
  return `Escala ${e.name}\n📅 ${fmtDLong(e.date)} · ${e.start}–${e.end}\n📍 ${e.venue}${e.address ? ' — ' + e.address : ''}\n\n${lines.join('\n')}\n\nChegada 1 h antes para montar as mesas. Levem documento e usem preto.`;
}

export function proposalText(e: EventDoc, s: Settings) {
  const b = e.budget;
  const c = budgetCalc(e, s);
  return `Proposta — ${s.studioName || 'A2 Tattoo Studio'}\n${e.name} · ${fmtDLong(e.date)} · ${e.start}–${e.end}\n${e.venue}\n\nO que entregamos:\n• Stand de flash tattoo com ${e.tables} ${e.tables > 1 ? 'mesas' : 'mesa'} e equipe de ${teamCount(e) || e.tables + 1} pessoas\n• Catálogo digital por QR code, ficha de saúde on-line e fila com aviso no celular\n• Protocolos de biossegurança e descarte correto de materiais\n• Acompanhamento pós-tattoo por WhatsApp durante 20 dias\n• Capacidade estimada: ${c.est} tatuagens\n\nInvestimento: ${brl(b.fee || 0)}${b.avgTicket ? `\nFlashs pagas pelos convidados a partir de ${brl(minPrice(s.prices, 'F', 'P'))}` : ''}\n\nPrecisamos do local: ponto de energia, ${e.tables} mesas, iluminação e acesso para montagem 2 h antes.\n\nProposta válida por 15 dias.`;
}

export const trainingText = (e: EventDoc) =>
  `Protocolo A2 — ${e.name} (${fmtD(e.date)})\n\n` +
  MODULES.map((m) => `*${m.name}*\n` + m.items.map((i) => '• ' + i).join('\n')).join('\n\n');

export function contractText(kind: 'partner' | 'artist', e: EventDoc, s: Settings, a?: Artist) {
  const p = e.partner || ({} as EventDoc['partner']);
  if (kind === 'partner')
    return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — FLASH TATTOO EM EVENTO\n\nCONTRATADA: ${s.studioName || 'A2 Tattoo Studio'}, representada por ${s.owner || 'Ariana'}.\nCONTRATANTE: ${p.company || p.name || '________'}, representada por ${p.name || '________'}.\n\n1. Objeto: estande de flash tattoo no evento “${e.name}”, em ${fmtDLong(e.date)}, das ${e.start} às ${e.end}, no endereço ${e.address || e.venue || '________'}.\n2. Estrutura: ${e.tables} ${e.tables > 1 ? 'mesas' : 'mesa'} de atendimento e equipe treinada em biossegurança.\n3. A CONTRATANTE fornece: ponto de energia, iluminação, espaço coberto e acesso para montagem 2 h antes do início.\n4. Valor: ${brl(e.budget?.fee || 0)}, com 50% na assinatura e 50% até a data do evento.\n5. Os clientes preenchem ficha de saúde e só são atendidos se aptos. Menores de idade somente com responsável legal presente.\n6. Cancelamento com menos de 15 dias: retenção do sinal.\n7. Uso de imagem: fotos do estande podem ser usadas por ambas as partes na divulgação.\n\nLocal e data: ____________________\n\n____________________          ____________________\nCONTRATADA                    CONTRATANTE`;
  return `CONTRATO DE PRESTAÇÃO DE SERVIÇOS — TATUADOR(A) EM EVENTO\n\nCONTRATANTE: ${s.studioName || 'A2 Tattoo Studio'}, representada por ${s.owner || 'Ariana'}.\nCONTRATADO(A): ${a!.name}, WhatsApp ${fmtPhone(a!.phone)}.\n\n1. Objeto: atendimento de flash tattoo no evento “${e.name}”, em ${fmtDLong(e.date)}, das ${e.start} às ${e.end}, em ${e.venue}.\n2. Remuneração: ${a!.commission ?? s.commission ?? 50}% do valor de cada flash realizada, pago no fechamento do evento (segunda-feira seguinte), via Pix.\n3. O(A) CONTRATADO(A) segue os protocolos de biossegurança do estúdio, confere a ficha de saúde antes de cada atendimento e usa apenas materiais fornecidos ou aprovados pela CONTRATANTE.\n4. Chegada 1 h antes do início para montagem. Faltas sem aviso de 48 h impedem novas escalas.\n5. As flashs são de autoria da CONTRATANTE e não podem ser reproduzidas fora do evento.\n\nLocal e data: ____________________\n\n____________________          ____________________\nCONTRATANTE                   CONTRATADO(A)`;
}

export const promoText = (e: EventDoc, s: Settings) =>
  `Tem flash tattoo do A2 no ${e.name}! 🖤\n📅 ${fmtDLong(e.date)}, das ${e.start} às ${e.end}\n📍 ${e.venue}\n\nEscolha seu desenho pelo QR code no stand, preencha a ficha no celular e curta o evento: a gente te chama quando for a sua vez.\nFlashs a partir de ${brl(minPrice(s.prices, 'F', 'P'))}.\n\nSua história. Na pele. Com arte.\n#flashtattoo #a2tattoostudio #tatuagem #fineline`;

export function closingText(e: EventDoc, tickets: Ticket[], artists: Artist[], s: Settings) {
  const c = closingCalc(e, tickets, artists, s);
  return (
    `Fechamento — ${e.name} (${fmtD(e.date)})\n${c.tix.length} tattoos · vendas ${brl(c.sales)}\n` +
    Object.entries(PAY).map(([k, l]) => `${l}: ${brl(c.byM[k] || 0)}`).join(' · ') +
    `\n\nEquipe:\n` +
    Object.keys(c.arts)
      .map((id) => {
        const a = artists.find((x) => x.id === id);
        const r = c.arts[id];
        return `• ${a ? a.name : id}: ${r.n} tattoos, ${brl(r.pay)}${e.closing?.paid?.[id] ? ' (pago)' : ' (a pagar)'}`;
      })
      .join('\n') +
    `\n\nContrato: ${brl(c.fee)}\nInsumos: ${brl(c.supplies)}\nCustos: ${brl(c.costs)}\nResultado: ${brl(c.result)}`
  );
}

export function closingCsv(e: EventDoc, tickets: Ticket[], artists: Artist[]) {
  const rows = [['codigo', 'cliente', 'flash', 'tamanho', 'valor', 'pagamento', 'tatuador', 'status']];
  for (const t of tickets.filter((x) => x.eventId === e.id && x.pay)) {
    const a = artists.find((x) => x.id === t.artistId);
    rows.push([t.code, t.name, `${t.flash.sheet}-${t.flash.n}`, t.flash.size, String(t.pay!.amount), t.pay!.method, a?.name || '', t.status]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

export function calledMsg(t: Ticket, artistName?: string, lang: 'pt' | 'en' = 'pt') {
  if (lang === 'en')
    return `Hi ${first(t.name)}! It's your turn at the A2 Tattoo Studio stand 🖤 Go to table ${t.table}${artistName ? ' with ' + first(artistName) : ''}. Code: ${t.code}.`;
  return `Oi, ${first(t.name)}! É a sua vez no stand do A2 Tattoo Studio 🖤 Vá até a mesa ${t.table}${artistName ? ' com ' + first(artistName) : ''}. Código: ${t.code}.`;
}
