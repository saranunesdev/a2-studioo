import type { AllData, DeskData, PublicLive, QueueOp, Ticket, TicketInput } from '../lib/types';

export type Unsub = () => void;
export type Col = 'events' | 'artists' | 'tickets';

/**
 * Tudo o que as telas precisam do banco de dados.
 * - Gestão: entra com o PIN da gestão (guardado no aparelho, ver ownerPin.ts) e lê e grava tudo.
 * - Atendimento: entra com o PIN do balcão e só vê o evento aberto hoje.
 * - Cliente e telão: sem login; só veem a fila pública e o próprio pedido.
 */
export interface Backend {
  mode: 'local' | 'supabase';

  // Gestão. As gravações usam o PIN da gestão guardado no aparelho.
  /** wait = segundos até poder tentar de novo, depois de muitos erros. */
  ownerLogin(pin: string): Promise<{ ok: boolean; wait?: number }>;
  changeOwnerPin(newPin: string): Promise<void>;
  /** 'denied' = o PIN guardado não vale mais (foi trocado). */
  subscribeAll(cb: (d: AllData | null | 'denied') => void): Unsub;
  put(col: Col, id: string, data: object): Promise<void>;
  patch(col: Col | 'settings', id: string, partial: object): Promise<void>;
  remove(col: Col, id: string): Promise<void>;
  resetDemo?(): Promise<void>;
  wipe?(): Promise<void>;

  // Atendimento
  checkPin(pin: string): Promise<boolean>;
  subscribeDesk(pin: string, cb: (d: DeskData | null) => void): Unsub;

  // Fila (gestão ou atendimento)
  queue(op: QueueOp, pin?: string): Promise<void>;

  // Cliente e telão
  subscribePublic(cb: (p: PublicLive | null) => void): Unsub;
  submitTicket(input: TicketInput, pin?: string): Promise<{ id: string; code: string }>;
  subscribeTicket(id: string, cb: (t: Ticket | null) => void): Unsub;
}
