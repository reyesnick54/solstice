import { PersonalEconomyAgent } from '../../../agent/src/service.ts';
import type { AccessIntentFailure } from '../../../agent/src/access-fabric/index.ts';
import type { AgentFailure } from '../../../agent/src/service.ts';
import { agentAccessIntentToDomainInput } from './domain-intent-bridge.ts';
import { refuseAgentConfirmReservation, refuseSelfIssuedExecutionAuthority, toProposeAccessActionIntent } from './gate.ts';
import type { ActionIntent } from '../../../permissions/src/action-intent.ts';
import type { AgentRuntimePorts } from '../../../agent/src/ports.ts';
import type { AuthorizedGraphSlice } from '../../../agent/src/access-fabric/index.ts';
import type { AccessIntent } from '../../../agent/src/access-fabric/types.ts';

export type AccessDemandEngineResult =
  | {
      readonly ok: true;
      readonly intent: AccessIntent;
      readonly proposalId: string;
      readonly explanation: string;
      readonly actionIntent: ActionIntent;
      readonly domainIntentId: string;
    }
  | { readonly ok: false; readonly error: AccessIntentFailure };

export class AccessDemandEngine {
  private readonly agent: PersonalEconomyAgent;

  constructor(agent: PersonalEconomyAgent) {
    this.agent = agent;
  }

  private toAccessIntentFailure(error: AgentFailure): AccessIntentFailure {
    if (
      error.code === 'EMPTY_REQUEST'
      || error.code === 'UNPARSEABLE_REQUEST'
      || error.code === 'MALFORMED_INTENT'
      || error.code === 'PROHIBITED_GRAPH_CONTEXT'
      || error.code === 'PROHIBITED_CONFIRMATION'
      || error.code === 'SELF_ISSUED_AUTHORITY'
      || error.code === 'ACTOR_CONTEXT_REQUIRED'
      || error.code === 'KERNEL_PATH_REQUIRED'
    ) {
      return error;
    }
    return { code: 'MALFORMED_INTENT', message: error.message };
  }

  propose(input: {
    readonly actor: unknown;
    readonly ports: AgentRuntimePorts;
    readonly subjectId: string;
    readonly sourceText: string;
    readonly graphSlice: AuthorizedGraphSlice;
    readonly requestedGraphCategories?: readonly string[];
    readonly requestedGraphLabels?: Readonly<Record<string, readonly string[]>>;
    readonly actorId: string;
  }): AccessDemandEngineResult {
    const composed = this.agent.proposeAccessIntent(input.actor, input.ports, {
      subjectId: input.subjectId,
      sourceText: input.sourceText,
      graphSlice: input.graphSlice,
      ...(input.requestedGraphCategories ? { requestedGraphCategories: input.requestedGraphCategories } : {}),
      ...(input.requestedGraphLabels ? { requestedGraphLabels: input.requestedGraphLabels } : {}),
    });
    if (!composed.ok) {
      return { ok: false, error: this.toAccessIntentFailure(composed.error) };
    }
    const action = toProposeAccessActionIntent({
      intent: composed.value.intent,
      actorId: input.actorId,
      requestedAt: composed.value.intent.createdAt,
    });
    if (!action.ok) {
      return { ok: false, error: { code: action.code, message: action.detail } };
    }
    const domainInput = agentAccessIntentToDomainInput({ intent: composed.value.intent });
    return {
      ok: true,
      intent: composed.value.intent,
      proposalId: composed.value.proposal.proposalId,
      explanation: composed.value.intent.explanation,
      actionIntent: action.actionIntent,
      domainIntentId: domainInput.id,
    };
  }

  confirmReservation(): { readonly ok: false; readonly error: AccessIntentFailure } {
    const refusal = refuseAgentConfirmReservation({ actorOriginatedFromAgent: true });
    return { ok: false, error: { code: refusal.code, message: refusal.detail } };
  }

  issueExecutionAuthority(): { readonly ok: false; readonly error: AccessIntentFailure } {
    const refusal = refuseSelfIssuedExecutionAuthority();
    return { ok: false, error: { code: refusal.code, message: refusal.detail } };
  }
}
