/**
 * Agent mandate HTTP surface for Wave 7 delegation controls.
 * Mandates specify user, agent, allowed data/accounts/actions, purpose,
 * limits, expiration, revocation, and approval requirements.
 */

import type { AgentConversationRuntime } from '../../../../packages/sunrey-agent/src/runtime.ts';
import type { AgentActionClass, AgentAssistScope } from '../../../../packages/sunrey-agent/src/types.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import { AGENT_AUTHORIZATION_POLICY } from './agent-authorization.ts';
import type { BffPrincipal } from './ports.ts';
import { agentError } from './agent.ts';

export type ClientMandateResource = {
  readonly schema: 'sunrey.consumer.agent-mandate.v1';
  readonly mandateId: string;
  readonly agentId: string;
  readonly ownerId: string;
  readonly status: string;
  readonly purpose: string;
  readonly mode: string;
  readonly environment: string;
  readonly allowedData: readonly string[];
  readonly allowedAccounts: readonly string[];
  readonly allowedActions: readonly string[];
  readonly assistScopes: readonly string[];
  readonly budget: {
    readonly perTransaction: string;
    readonly perPeriod: string;
    readonly maxProposalAmount: string | null;
    readonly allowedCurrencies: readonly string[];
  } | null;
  readonly approval: {
    readonly class: string;
    readonly highRiskAlwaysHuman: boolean;
  } | null;
  readonly expiresAt: string;
  readonly revocable: true;
  readonly executionSeparated: true;
  readonly adviceOnly: boolean;
  readonly authorizationPolicy: typeof AGENT_AUTHORIZATION_POLICY;
};

function clientMandate(
  agentId: string,
  mandate: NonNullable<ReturnType<AgentConversationRuntime['engine']['getMandate']>>,
): ClientMandateResource {
  const adviceOnly = !mandate.permissions.actionClasses.some((c) =>
    ['PREPARE_PAYMENT', 'PREPARE_EXCHANGE', 'PREPARE_WITHDRAWAL'].includes(c),
  );
  return Object.freeze({
    schema: 'sunrey.consumer.agent-mandate.v1',
    mandateId: mandate.mandateId,
    agentId,
    ownerId: mandate.owner.ownerId,
    status: mandate.state,
    purpose: 'PERSONAL_FINANCIAL_ASSISTANCE',
    mode: mandate.policy.mode,
    environment: mandate.policy.environment,
    allowedData: mandate.assistScopes.filter((s) => s.startsWith('DATA:')),
    allowedAccounts: mandate.owner.accountId ? [mandate.owner.accountId] : [],
    allowedActions: [...mandate.permissions.actionClasses],
    assistScopes: [...mandate.assistScopes],
    budget: Object.freeze({
      perTransaction: mandate.budget.perTransaction.toString(),
      perPeriod: mandate.budget.perPeriod.toString(),
      maxProposalAmount: mandate.budget.maxProposalAmount?.toString() ?? null,
      allowedCurrencies: mandate.budget.allowedCurrencies,
    }),
    approval: Object.freeze({
      class: mandate.policy.approval.class,
      highRiskAlwaysHuman: mandate.policy.approval.highRiskAlwaysHuman,
    }),
    expiresAt: mandate.policy.expiry,
    revocable: true,
    executionSeparated: true,
    adviceOnly,
    authorizationPolicy: AGENT_AUTHORIZATION_POLICY,
  });
}

export function getAgentMandate(
  runtime: AgentConversationRuntime,
  principal: BffPrincipal,
  agentId: string,
  requestId: string,
): ClientMandateResource | BffErrorEnvelope {
  const owned = runtime.getOwnedAgent(principal.customerId, agentId);
  if (!owned.ok) {
    return agentError(owned.error, requestId);
  }
  const mandate = owned.value.mandateId ? runtime.engine.getMandate(owned.value.mandateId) : undefined;
  if (!mandate) {
    return bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'No active mandate for this agent',
      retryable: false,
      requestId,
    });
  }
  return clientMandate(agentId, mandate);
}

export function revokeAgentMandate(
  runtime: AgentConversationRuntime,
  principal: BffPrincipal,
  agentId: string,
  requestId: string,
): ClientMandateResource | BffErrorEnvelope {
  const owned = runtime.getOwnedAgent(principal.customerId, agentId);
  if (!owned.ok) {
    return agentError(owned.error, requestId);
  }
  const mandateId = owned.value.mandateId;
  if (!mandateId) {
    return bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'No mandate to revoke',
      retryable: false,
      requestId,
    });
  }
  const revoked = runtime.engine.revokeMandate({ mandateId, actorId: principal.actorId });
  if (!revoked.ok) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: revoked.error.detail,
      retryable: false,
      requestId,
      detailsSafeForClient: { code: revoked.error.code },
    });
  }
  return clientMandate(agentId, revoked.value);
}

export function grantAgentMandate(
  runtime: AgentConversationRuntime,
  principal: BffPrincipal,
  agentId: string,
  body: Readonly<Record<string, unknown>>,
  requestId: string,
  now: string,
): ClientMandateResource | BffErrorEnvelope {
  const owned = runtime.getOwnedAgent(principal.customerId, agentId);
  if (!owned.ok) {
    return agentError(owned.error, requestId);
  }
  const actionClasses = Array.isArray(body.allowedActions)
    ? body.allowedActions.filter((v): v is string => typeof v === 'string')
    : ['READ_FINANCIAL_STATE', 'REQUEST_HUMAN_APPROVAL'];
  const forbidden = actionClasses.filter((c) =>
    ['MINT_SUNREY', 'MINT_MOONREY', 'EXECUTION', 'ISSUE_EXECUTION_AUTHORITY'].includes(c),
  );
  if (forbidden.length > 0) {
    return bffError({
      errorCode: 'POLICY_REFUSED',
      category: 'POLICY',
      message: 'Requested action classes are not delegatable to agents',
      retryable: false,
      requestId,
      detailsSafeForClient: { forbidden: forbidden.join(',') },
    });
  }
  const accountId =
    typeof body.allowedAccountId === 'string' ? body.allowedAccountId : owned.value.owner.accountId ?? `acct_${principal.customerId}`;
  const expiresAt =
    typeof body.expiresAt === 'string' ? body.expiresAt : asUtcInstant('2030-01-01T00:00:00.000Z');
  const existingMandate = owned.value.mandateId ? runtime.engine.getMandate(owned.value.mandateId) : undefined;
  if (existingMandate) {
    return clientMandate(agentId, existingMandate);
  }
  const created = runtime.engine.createMandate({
    owner: {
      kind: 'USER',
      ownerId: principal.customerId,
      walletId: `wallet_${principal.customerId}`,
      accountId,
    },
    agentLabel: owned.value.label,
    agentName: owned.value.name,
    modelRef: owned.value.modelRef,
    policyRef: 'policy:agent-mandates-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: actionClasses as AgentActionClass[],
      assets: [{ assetId: 'FIAT_ACCOUNT', wildcard: false }],
      markets: [],
      destinations: [],
      humanInformationAccess:
        body.humanInformationAccess === true
          ? ({ granted: true, scopeId: 'hin:default' } as const)
          : false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: BigInt(typeof body.perTransactionLimit === 'string' ? body.perTransactionLimit : '10000'),
      perPeriod: BigInt(typeof body.perPeriodLimit === 'string' ? body.perPeriodLimit : '25000'),
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
      maxProposalAmount: BigInt(typeof body.maxProposalAmount === 'string' ? body.maxProposalAmount : '10000'),
      dailyProposalAggregate: BigInt(typeof body.dailyProposalAggregate === 'string' ? body.dailyProposalAggregate : '25000'),
      allowedCurrencies: ['USD'],
    },
    approval: {
      class: (typeof body.approvalClass === 'string' ? body.approvalClass : 'MOBILE_CONFIRMATION') as never,
      highRiskAlwaysHuman: true,
    },
    expiry: asUtcInstant(expiresAt),
    frequencyMaxPerPeriod: 20,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: principal.jurisdiction,
    delegatedSigningKeyId: null,
    createdByActorId: principal.actorId,
    assistScopes: (Array.isArray(body.allowedData)
      ? body.allowedData.filter((v): v is string => typeof v === 'string')
      : []) as AgentAssistScope[],
  });
  if (!created.ok) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: created.error.detail,
      retryable: false,
      requestId,
      detailsSafeForClient: { code: created.error.code },
    });
  }
  void now;
  return clientMandate(created.value.agentId, created.value);
}
