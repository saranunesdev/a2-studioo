export type Tier = 'F' | 'D';
export type Size = 'P' | 'M' | 'G';
export type PayMethod = 'pix' | 'cartao' | 'dinheiro';
export type Role = 'tatuador' | 'atendimento' | 'piercer';
export type Stage = 'negociacao' | 'orcamento' | 'contrato' | 'confirmado' | 'realizado' | 'fechado';
export type TicketStatus =
  | 'aguardando_pagamento'
  | 'na_fila'
  | 'chamado'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado';
export type Lang = 'pt' | 'en';

export type Prices = Record<Tier, Partial<Record<Size, number | null>>>;

export interface Flash {
  sheet: number;
  n: number;
  size: Size;
  tier: Tier;
  price: number | null;
}

export interface Anamnese {
  nascimento?: string;
  cpf?: string;
  email?: string;
  instagram?: string;
  cidade?: string;
  primeira?: boolean;
  comoConheceu?: string;
  saude?: Record<string, boolean>;
  detalhes?: string;
  termos?: { verdade?: boolean; ciente?: boolean; whatsapp?: boolean; imagem?: boolean };
  responsavel?: { nome: string; cpf: string } | null;
  papel?: boolean;
}

export interface Ticket {
  id: string;
  eventId: string;
  code: string;
  createdAt: number;
  status: TicketStatus;
  name: string;
  phone: string;
  flash: Flash;
  bodyPart: string;
  anamnese: Anamnese;
  alerts: string[];
  pay: { method: PayMethod; amount: number; at: number } | null;
  queueAt: number | null;
  table: number | null;
  artistId: string | null;
  calledAt: number | null;
  startedAt: number | null;
  doneAt: number | null;
  care: Record<string, number | boolean>;
  source: 'qr' | 'balcao' | 'tablet';
  lang?: Lang;
}

export interface TableState {
  n: number;
  artistId: string | null;
  ticketId: string | null;
  paused: boolean;
}

export interface TeamMember {
  artistId: string;
  role: Role;
  contract: 'pendente' | 'enviado' | 'assinado';
  confirmed: boolean;
}

export interface ChecklistItem {
  id: string;
  group: string;
  name: string;
  qty: number;
  status: 'faltando' | 'comprar' | 'separado' | 'embalado' | 'voltou';
}

export interface Cost {
  id: string;
  name: string;
  value: number;
}

export interface EventDoc {
  id: string;
  name: string;
  type: string;
  date: string;
  start: string;
  end: string;
  venue: string;
  address: string;
  public: number;
  tables: number;
  stage: Stage;
  steps: Record<string, { done: boolean; note: string }>;
  team: TeamMember[];
  need: { tatuador: number; atendimento: number };
  partner: { name: string; company: string; phone: string };
  budget: { fee: number; avgTicket: number; conv: number; costs: Cost[] };
  checklist: ChecklistItem[];
  training: Record<string, Record<string, boolean>>;
  tableState: TableState[];
  cats: string[];
  closing: {
    paid: Record<string, boolean>;
    feeReceived: boolean;
    extra: { name: string; value: number }[];
    closedAt: number | null;
    supplies?: number | null;
  };
  notes: string;
  createdAt: number;
}

export interface Artist {
  id: string;
  name: string;
  phone: string;
  role: Role;
  level: string;
  years: number;
  langs: string[];
  styles: string[];
  days: string[];
  blocked: string[];
  commission: number;
  instagram: string;
  notes: string;
}

export interface Settings {
  studioName: string;
  owner: string;
  whatsapp: string;
  publicUrl: string;
  avgMin: number;
  commission: number;
  prices: Prices;
  liveEventId: string | null;
  templates: Record<string, string>;
  /** PIN da gestão — só no modo demonstração. No Supabase ele fica embaralhado no banco. */
  ownerPin?: string;
  /** PIN do acesso de atendimento (só o dia do evento). */
  attendantPin: string;
}

export interface AllData {
  events: EventDoc[];
  artists: Artist[];
  tickets: Ticket[];
  settings: Settings;
}

/** O que o cliente e o telão podem ver. Sem dados pessoais. */
export interface PublicLive {
  open: boolean;
  eventId: string;
  name: string;
  type: string;
  date: string;
  venue: string;
  start: string;
  end: string;
  cats: string[];
  prices: Prices;
  avgMin: number;
  studio: string;
  whatsapp: string;
  tables: { n: number; artist: string; code: string; status: string; paused: boolean }[];
  waiting: string[];
  called: { code: string; table: number; at: number }[];
}

/** O que o atendimento vê no dia do evento. Sem agenda, orçamento nem contratos. */
export interface DeskData {
  event: Pick<
    EventDoc,
    'id' | 'name' | 'type' | 'date' | 'start' | 'end' | 'venue' | 'tables' | 'tableState' | 'cats'
  > & { team: { artistId: string; role: Role }[] };
  tickets: Ticket[];
  artists: { id: string; name: string; role: Role }[];
  settings: Pick<Settings, 'prices' | 'avgMin' | 'studioName' | 'whatsapp' | 'templates'>;
}

export type QueueOp =
  | { type: 'pay'; ticketId: string; method: PayMethod }
  | { type: 'start' | 'finish' | 'noshow' | 'cancel' | 'requeue'; ticketId: string }
  | { type: 'pause'; eventId: string; n: number }
  | { type: 'tableArtist'; eventId: string; n: number; artistId: string | null }
  | { type: 'fill'; eventId: string };

export interface TicketInput {
  eventId: string;
  name: string;
  phone: string;
  flash: Flash;
  bodyPart: string;
  anamnese: Anamnese;
  alerts: string[];
  source: Ticket['source'];
  lang?: Lang;
  /** Balcão: já pago na hora. */
  payMethod?: PayMethod | null;
}
