/**
 * EXEC01 — broker execution connectivity states and schema anchors.
 * No connectivity state implies legal authorization or production activation.
 */

export const HELIOS_EXEC01_CONNECTIVITY_SCHEMA = 'sunrey.helios.execution.connectivity.exec01.v1' as const;

export const HELIOS_EXEC01_CONNECTIVITY_AUTHORITY = 'BROKER_EXECUTION_CONNECTIVITY' as const;

export const BROKER_CONNECTIVITY_STATES = [
  'REGISTERED',
  'SANDBOX',
  'READ_ONLY_CONNECTED',
  'ORDER_ENTRY_CONFORMANCE',
  'EXTERNAL_GATES_PENDING',
  'PRODUCTION_DISABLED',
] as const;

export type BrokerConnectivityState = (typeof BROKER_CONNECTIVITY_STATES)[number];

export const BROKER_CONNECTIVITY_STATE_MEANING = Object.freeze({
  REGISTERED: 'Provider metadata recorded; no session or outbound API.',
  SANDBOX: 'Fixture or injected transport only; conforms to EXEC01 DTOs.',
  READ_ONLY_CONNECTED: 'Positions, cash, and statements readable; order entry disabled.',
  ORDER_ENTRY_CONFORMANCE: 'Submit/cancel/query exercised against conformance harness; still simulation.',
  EXTERNAL_GATES_PENDING: 'Engineering complete; human/regulatory gates remain; production disabled.',
  PRODUCTION_DISABLED: 'Explicit engineering posture while LIVE_INVESTMENT_EXECUTION remains false.',
});

export const EXEC01_CONNECTIVITY_IMPLIES_LEGAL_AUTHORIZATION = false as const;

export const EXEC01_PAPER_BROKER_PROVIDER_ID = 'sunrey_investments_paper_broker_v1' as const;

export const EXEC01_SANDBOX_HELIOS_PROVIDER_ID = 'sandbox_helios_investment_v1' as const;
