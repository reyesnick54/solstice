import { FrozenClock } from '../../../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { UserAgentMandateEngine } from '../../../../packages/sunrey-agent/src/engine.ts';
import { AgentConversationRuntime } from '../../../../packages/sunrey-agent/src/runtime.ts';
import { pegViewFromLabels } from '../../../../packages/sunrey-agent/src/peg.ts';
import type { AgentConversation, AgentMemory, UserAgent } from '../../../../packages/sunrey-agent/src/types.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export function createSandboxAgentRuntime(now: string): AgentConversationRuntime {
  const engine = new UserAgentMandateEngine({
    clock: new FrozenClock(asUtcInstant(now)),
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_sandbox_agent' }) },
  });
  return new AgentConversationRuntime({
    engine,
    clock: new FrozenClock(asUtcInstant(now)),
    peg: {
      snapshot: (subjectId) =>
        pegViewFromLabels({
          subjectId,
          goalLabels: ['emergency reserve'],
          incomeLabels: ['salary'],
        }),
    },
  });
}

export function provisionSandboxAgent(
  runtime: AgentConversationRuntime,
  principal: BffPrincipal,
  accountId: string,
): UserAgent | null {
  const created = runtime.engine.createMandate({
    owner: {
      kind: 'USER',
      ownerId: principal.customerId,
      walletId: `wallet_${principal.customerId}`,
      accountId,
    },
    agentLabel: 'home',
    agentName: 'SunRey Home Agent',
    modelRef: 'model:sim-v1',
    policyRef: 'policy:agent-mandates-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: ['READ_FINANCIAL_STATE', 'PREPARE_PAYMENT', 'REQUEST_HUMAN_APPROVAL'],
      assets: [{ assetId: 'FIAT_ACCOUNT', wildcard: false }],
      markets: [],
      destinations: [],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 10_000n,
      perPeriod: 25_000n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
      maxProposalAmount: 10_000n,
      dailyProposalAggregate: 25_000n,
      allowedCurrencies: ['USD'],
    },
    approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 20,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: principal.jurisdiction,
    delegatedSigningKeyId: null,
    createdByActorId: principal.actorId,
  });
  if (!created.ok) {
    return null;
  }
  return runtime.engine.getAgent(created.value.agentId) ?? null;
}

export function clientAgent(agent: UserAgent) {
  return Object.freeze({
    agentId: agent.agentId,
    ownerId: agent.ownerId,
    agentType: agent.agentType,
    name: agent.name,
    status: agent.status,
    createdAt: agent.createdAt,
    modelPolicy: agent.modelPolicy,
    toolPolicy: agent.toolPolicy,
    mandateId: agent.mandateId,
    jurisdiction: agent.jurisdiction,
    riskPolicy: agent.riskPolicy,
    isCustomer: false,
    isExecutionAuthority: false,
  });
}

export function clientConversation(conversation: AgentConversation) {
  return Object.freeze({
    conversationId: conversation.conversationId,
    ownerId: conversation.ownerId,
    agentId: conversation.agentId,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    contextVersion: conversation.contextVersion,
    proposalRefs: conversation.proposalRefs,
    isFinancialRecord: false,
  });
}

export function clientMemory(memory: AgentMemory) {
  return Object.freeze({
    memoryId: memory.memoryId,
    category: memory.category,
    content: memory.content,
    source: memory.source,
    confidence: memory.confidence,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    expiresAt: memory.expiresAt,
    userEditable: memory.userEditable,
    dataClassification: memory.dataClassification,
    personalization: memory.personalization,
  });
}

export function agentError(failure: { readonly code: string; readonly detail: string }, requestId: string): BffErrorEnvelope {
  const owned = failure.code === 'CROSS_USER_DENIED' || failure.code === 'CONVERSATION_NOT_OWNED';
  return bffError({
    errorCode: owned ? 'RESOURCE_NOT_OWNED' : failure.code === 'ORPHAN_AGENT' ? 'NOT_FOUND' : 'VALIDATION',
    category: owned ? 'AUTHORIZATION' : failure.code === 'ORPHAN_AGENT' ? 'NOT_FOUND' : 'VALIDATION',
    message: failure.detail,
    retryable: false,
    requestId,
    detailsSafeForClient: { code: failure.code },
  });
}

export function formatAgentSse(chunks: readonly { readonly kind: string; readonly text: string }[]): string {
  return chunks
    .map((chunk) => `event: ${chunk.kind}\ndata: ${JSON.stringify({ text: chunk.text, financialStateChanged: false })}\n\n`)
    .join('');
}
