import type { ExchangeAccountId } from '../ids.ts';
import type { CapacityAccessTerms, CapacityQueueAllocation, CapacityQueueTicket } from './types.ts';
import { QUEUE_PRIORITY_ORDER, type QueuePriorityClass } from './taxonomy.ts';
import { evaluateTermsCompleteness } from './terms.ts';

/**
 * Queue / allocation market.
 *
 * Some productive capacity is rationed rather than priced — grid interconnect
 * slots, regulated water abstraction, constrained manufacturing lines. This
 * allocates a fixed available quantity deterministically by priority class then
 * arrival sequence. No price is discovered and no consideration moves here.
 */
export function enqueueCapacityRequest(input: {
  readonly ticketId: string;
  readonly queueId: string;
  readonly requesterAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly requestedQuantity: bigint;
  readonly priorityClass: QueuePriorityClass;
  readonly sequence: number;
}): CapacityQueueTicket {
  const completeness = evaluateTermsCompleteness(input.terms);
  if (!completeness.complete) {
    throw new TypeError(
      `queue request refused: incomplete terms (${completeness.missing.join(', ')})`,
    );
  }
  if (input.requestedQuantity <= 0n) {
    throw new TypeError('queue request requires a positive quantity');
  }
  return Object.freeze({
    ticketId: input.ticketId,
    queueId: input.queueId,
    requesterAccountId: input.requesterAccountId,
    terms: input.terms,
    requestedQuantity: input.requestedQuantity,
    priorityClass: input.priorityClass,
    sequence: input.sequence,
  });
}

export function sortQueueTickets(tickets: readonly CapacityQueueTicket[]): CapacityQueueTicket[] {
  return [...tickets].sort((a, b) => {
    const priorityCmp = QUEUE_PRIORITY_ORDER[a.priorityClass] - QUEUE_PRIORITY_ORDER[b.priorityClass];
    if (priorityCmp !== 0) {
      return priorityCmp;
    }
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return a.ticketId < b.ticketId ? -1 : a.ticketId > b.ticketId ? 1 : 0;
  });
}

/**
 * Allocate available capacity. Whole units only: a ticket receives the lesser
 * of its request and the remaining quantity, and any ticket that receives
 * nothing is reported rather than dropped.
 */
export function allocateCapacityQueue(input: {
  readonly queueId: string;
  readonly availableQuantity: bigint;
  readonly tickets: readonly CapacityQueueTicket[];
}): CapacityQueueAllocation {
  if (input.availableQuantity < 0n) {
    throw new TypeError('available capacity must not be negative');
  }
  const ordered = sortQueueTickets(input.tickets.filter((ticket) => ticket.queueId === input.queueId));
  const allocated: { ticketId: string; quantity: bigint; priorityClass: QueuePriorityClass }[] = [];
  const unserved: string[] = [];
  let remaining = input.availableQuantity;

  for (const ticket of ordered) {
    if (remaining <= 0n) {
      unserved.push(ticket.ticketId);
      continue;
    }
    const grant = ticket.requestedQuantity < remaining ? ticket.requestedQuantity : remaining;
    remaining -= grant;
    allocated.push({
      ticketId: ticket.ticketId,
      quantity: grant,
      priorityClass: ticket.priorityClass,
    });
    if (grant < ticket.requestedQuantity) {
      unserved.push(ticket.ticketId);
    }
  }

  return Object.freeze({
    queueId: input.queueId,
    availableQuantity: input.availableQuantity,
    allocated: Object.freeze(allocated.map((row) => Object.freeze(row))),
    unallocatedQuantity: remaining,
    unservedTicketIds: Object.freeze([...new Set(unserved)]),
    rationing: 'PRIORITY_THEN_SEQUENCE',
  });
}
