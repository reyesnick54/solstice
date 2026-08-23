import { ENVIRONMENT } from '../../config/src/flags.ts';
import type { AgentLifecycleState } from './taxonomy.ts';
import type { MandateRefusal, UserAgent } from './types.ts';

const TRANSITIONS: Readonly<Record<AgentLifecycleState, readonly AgentLifecycleState[]>> = {
  CREATED: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['PAUSED', 'RESTRICTED', 'REVOKED'],
  PAUSED: ['ACTIVE', 'REVOKED'],
  RESTRICTED: ['ACTIVE', 'REVOKED'],
  REVOKED: ['ARCHIVED'],
  ARCHIVED: [],
};

export const AGENT_LIFECYCLE_TRANSITIONS = TRANSITIONS;

export function canTransitionAgent(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function agentMayConverse(status: AgentLifecycleState): { readonly ok: true } | MandateRefusal {
  switch (status) {
    case 'ACTIVE':
      return { ok: true };
    case 'CREATED':
      return { ok: false, code: 'AGENT_NOT_ACTIVE', detail: 'agent has not been activated' };
    case 'PAUSED':
      return { ok: false, code: 'AGENT_PAUSED', detail: 'owner paused this agent' };
    case 'RESTRICTED':
      return { ok: false, code: 'AGENT_RESTRICTED', detail: 'compliance policy restricted this agent' };
    case 'REVOKED':
      return { ok: false, code: 'AGENT_REVOKED', detail: 'revoked agent cannot operate' };
    case 'ARCHIVED':
      return { ok: false, code: 'AGENT_ARCHIVED', detail: 'archived agent cannot operate' };
  }
}

export function productionStateRemainsGated(agent: UserAgent): boolean {
  return ENVIRONMENT === 'simulation' && agent.status !== 'REVOKED' && agent.status !== 'ARCHIVED';
}

export function transitionAgent(
  agent: UserAgent,
  next: AgentLifecycleState,
  actorId: string,
): { readonly ok: true; readonly agent: UserAgent } | MandateRefusal {
  if (actorId.startsWith('agent:')) {
    return { ok: false, code: 'SELF_EXPANSION_FORBIDDEN', detail: 'an agent cannot change its own lifecycle' };
  }
  if (!canTransitionAgent(agent.status, next)) {
    return {
      ok: false,
      code: agent.status === 'REVOKED' ? 'AGENT_REVOKED' : 'AGENT_NOT_ACTIVE',
      detail: `cannot transition ${agent.status} to ${next}`,
    };
  }
  return { ok: true, agent: Object.freeze({ ...agent, status: next }) };
}
