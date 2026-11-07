import type { AllData, DeskData, PublicLive, QueueOp, Ticket, TicketInput } from '../lib/types';

export type Unsub = () => void;
export type Col = 'events' | 'artists' | 'tickets';

/**
 * Tudo o que as telas precisam do banco de dados.
 * - Gestão (dona): lê e grava tudo.
 * - Atendimento: entra com PIN e só vê o evento aberto hoje.
 * - Cliente e telão: sem login; só veem a fila pública e o próprio pedido.
 */
export interface Backend {
  mode: 'local' | 'supabase';

  // Gestão
  ownerSignedIn(): Promise<boolean>;
  ownerSignIn(email: string): Promise<'sent' | 'ok'>;
  /** Entrar com e-mail e senha (sem mandar e-mail). Só no modo conectado. */
  ownerSignInPassword?(email: string, password: string): Promise<void>;
  /** Criar ou trocar a senha da gestão já logada. Só no modo conectado. */
  setOwnerPassword?(password: string): Promise<void>;
  signOut(): Promise<void>;
  subscribeAll(cb: (d: AllData | null) => void): Unsub;
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
