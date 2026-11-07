import { deskData } from '../../lib/queue';
import type { AllData, DeskData, QueueOp, TicketInput } from '../../lib/types';
import type { Backend } from '../../store/backend';

/** O que as telas do dia do evento usam, venha da gestão (tudo) ou do atendimento (PIN). */
export interface LiveSource {
  data: DeskData | null;
  isOwner: boolean;
  queue(op: QueueOp): Promise<void>;
  submit(input: TicketInput): Promise<{ id: string; code: string }>;
}

export function ownerSource(b: Backend, all: AllData): LiveSource {
  return {
    data: deskData(all),
    isOwner: true,
    queue: (op) => b.queue(op),
    submit: (input) => b.submitTicket(input),
  };
}
export function deskSource(b: Backend, data: DeskData | null, pin: string): LiveSource {
  return {
    data,
    isOwner: false,
    queue: (op) => b.queue(op, pin),
    submit: (input) => b.submitTicket(input, pin),
  };
}
