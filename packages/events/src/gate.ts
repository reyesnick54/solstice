import type { ActionIntent } from '../../permissions/src/action-intent.ts';
import type { AuthorizationDecision } from '../../permissions/src/decision.ts';

/**
 * The only port an event handler may use to request a consequential
 * financial action. There is no ledger field and no AuthorityIssuer.
 *
 * event → new ActionIntent → Kernel → authority → authorized mutation
 * Never: event → direct ledger mutation
 */
export type EventHandlerPorts = {
  readonly submitIntent: (intent: ActionIntent) => AuthorizationDecision;
};

export function requestConsequentialAction(
  ports: EventHandlerPorts,
  intent: ActionIntent,
): AuthorizationDecision {
  return ports.submitIntent(intent);
}

export class EventHandlerBypassError extends Error {
  readonly reasonCode = 'EVENT_HANDLER_CANNOT_MUTATE_LEDGER';

  constructor(message = 'event handlers cannot post journals or open accounts directly') {
    super(message);
    this.name = 'EventHandlerBypassError';
  }
}

export function refuseDirectFinancialMutation(): never {
  throw new EventHandlerBypassError();
}
