import type { ActionKind } from './action-intent.ts';
import type { ActorType } from '@solstice/domain';

/**
 * Agent capabilities are read-only. Adding or modifying a beneficiary
 * is never an agent capability. High-risk money movement is never an
 * agent capability in this simulation.
 */
export const AGENT_CAPABILITIES = [
  'QUERY_CUSTOMER',
  'QUERY_BALANCE',
  'QUERY_PAYMENT',
  'QUERY_ROUTE',
  'QUERY_EVIDENCE',
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export const HIGH_RISK_KINDS: readonly ActionKind[] = [
  'ADD_BENEFICIARY',
  'UPDATE_BENEFICIARY',
  'SEND_PAYMENT',
  'FX_CONVERT',
  'POST_JOURNAL',
  'COMPENSATE_PAYMENT',
  'SEED_CREDIT',
  'RECORD_COST_AVOIDED',
];

const ACTOR_ALLOWED_KINDS: Readonly<Record<ActorType, readonly ActionKind[]>> = {
  CUSTOMER: [
    'ADD_BENEFICIARY',
    'UPDATE_BENEFICIARY',
    'SEND_PAYMENT',
    'FX_CONVERT',
    'TRANSITION_CUSTOMER_STATUS',
  ],
  OPERATOR: [
    'CREATE_CUSTOMER',
    'TRANSITION_CUSTOMER_STATUS',
    'OPEN_ACCOUNT',
    'ADD_BENEFICIARY',
    'UPDATE_BENEFICIARY',
    'SEND_PAYMENT',
    'FX_CONVERT',
    'POST_JOURNAL',
    'COMPENSATE_PAYMENT',
    'RECORD_COST_AVOIDED',
  ],
  SYSTEM: [
    'CREATE_CUSTOMER',
    'TRANSITION_CUSTOMER_STATUS',
    'OPEN_ACCOUNT',
    'SEED_CREDIT',
    'ADD_BENEFICIARY',
    'UPDATE_BENEFICIARY',
    'SEND_PAYMENT',
    'FX_CONVERT',
    'POST_JOURNAL',
    'COMPENSATE_PAYMENT',
    'RECORD_COST_AVOIDED',
  ],
  INTERNAL_TOOL: [
    'CREATE_CUSTOMER',
    'TRANSITION_CUSTOMER_STATUS',
    'OPEN_ACCOUNT',
    'SEED_CREDIT',
    'ADD_BENEFICIARY',
    'POST_JOURNAL',
    'RECORD_COST_AVOIDED',
  ],
  AGENT: [],
};

export function actorMaySubmit(actorType: ActorType, kind: ActionKind): boolean {
  return ACTOR_ALLOWED_KINDS[actorType].includes(kind);
}

export function isHighRiskKind(kind: ActionKind): boolean {
  return HIGH_RISK_KINDS.includes(kind);
}
