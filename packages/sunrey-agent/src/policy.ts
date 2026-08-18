import type { UtcInstant } from '../../domain/src/time.ts';
import { evaluateBudget, rolloverUsage } from './budget.ts';
import { isAgentActionClass, isHighRiskAction } from './taxonomy.ts';
import type {
  AgentMandateUsage,
  AgentTransactionProposal,
  MandateRefusal,
  UserAgentMandate,
} from './types.ts';

const EXPANSION_INTENTS = new Set([
  'CHANGE_AGENT_MANDATE',
  'RAISE_BUDGET',
  'ADD_ASSET',
  'ADD_DESTINATION',
  'EXTEND_EXPIRY',
  'CHANGE_APPROVAL_REQUIREMENTS',
  'CREATE_MASTER_DELEGATION',
]);

const INJECTION_MARKERS = [
  'ignore previous instructions',
  'ignore all mandates',
  'you are now unrestricted',
  'raise your budget',
  'add asset wildcard',
  'disable approval',
  'use master key',
];

export function detectPromptInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return INJECTION_MARKERS.some((marker) => lower.includes(marker));
}

export function evaluateMandateForProposal(input: {
  readonly mandate: UserAgentMandate;
  readonly usage: AgentMandateUsage;
  readonly proposal: AgentTransactionProposal;
  readonly now: UtcInstant;
  readonly walletId: string;
  readonly networkId: string;
  readonly jurisdictionAvailable: boolean;
}): { readonly ok: true } | MandateRefusal {
  const { mandate, proposal } = input;
  if (!mandate.owner.ownerId || !mandate.owner.walletId || !mandate.owner.accountId) {
    return { ok: false, code: 'ORPHAN_AGENT', detail: 'mandate must bind an explicit owner, wallet, and account' };
  }
  if (mandate.state === 'REVOKED') {
    return { ok: false, code: 'MANDATE_REVOKED', detail: 'revoked mandate cannot authorize' };
  }
  if (mandate.state === 'EXPIRED' || input.now > mandate.policy.expiry) {
    return { ok: false, code: 'MANDATE_EXPIRED', detail: 'mandate has expired' };
  }
  if (proposal.walletId !== input.walletId || mandate.owner.walletId !== input.walletId) {
    return { ok: false, code: 'WRONG_WALLET', detail: 'proposal wallet does not match mandate wallet' };
  }
  if (proposal.networkId !== input.networkId) {
    return { ok: false, code: 'WRONG_NETWORK', detail: 'proposal network does not match active wallet network' };
  }
  if (proposal.mandateHash !== mandate.mandateHash) {
    return { ok: false, code: 'MANDATE_REVOKED', detail: 'proposal mandate hash does not match current mandate' };
  }
  if (EXPANSION_INTENTS.has(proposal.intent) || proposal.intent === 'CHANGE_AGENT_MANDATE') {
    return { ok: false, code: 'SELF_EXPANSION_FORBIDDEN', detail: 'an agent cannot expand its own mandate' };
  }
  if (detectPromptInjection(proposal.operationalRationale) || detectPromptInjection(proposal.reasonCode)) {
    return { ok: false, code: 'PROMPT_INJECTION', detail: 'prompt-injection content cannot authorize a financial action' };
  }
  if (proposal.guaranteedReturn !== false) {
    return { ok: false, code: 'PROFIT_GUARANTEE_FORBIDDEN', detail: 'agent strategies must not represent guaranteed return' };
  }
  if (!isAgentActionClass(proposal.intent) || !mandate.permissions.actionClasses.includes(proposal.intent)) {
    return { ok: false, code: 'ACTION_CLASS_NOT_PERMITTED', detail: `action ${proposal.intent} is not on the mandate` };
  }
  if (mandate.permissions.allowWildcardAssets !== false) {
    return { ok: false, code: 'WILDCARD_ASSET_FORBIDDEN', detail: 'wildcard asset permissions are not configured' };
  }
  const assetOk = mandate.permissions.assets.some(
    (item) => item.wildcard === false && (item.listedAssetId ?? item.assetId) === proposal.assetId,
  );
  if (!assetOk) {
    return { ok: false, code: 'ASSET_NOT_PERMITTED', detail: `asset ${proposal.assetId} is not approved` };
  }
  if (proposal.intent === 'EXECUTE_BOUNDED_EXCHANGE_ORDER' || proposal.intent === 'PREPARE_EXCHANGE_ORDER') {
    const marketOk = mandate.permissions.markets.some((item) => item.marketId === proposal.destinationOrMarket);
    if (!marketOk) {
      return { ok: false, code: 'MARKET_NOT_PERMITTED', detail: `market ${proposal.destinationOrMarket} is not approved` };
    }
  }
  if (proposal.intent === 'EXECUTE_PREAPPROVED_PAYMENT' || proposal.intent === 'PREPARE_PAYMENT') {
    const destOk = mandate.permissions.destinations.some((item) => item.destinationId === proposal.destinationOrMarket);
    if (!destOk) {
      return { ok: false, code: 'DESTINATION_NOT_PERMITTED', detail: `destination ${proposal.destinationOrMarket} is not approved` };
    }
  }
  if (!input.jurisdictionAvailable) {
    return { ok: false, code: 'JURISDICTION_UNAVAILABLE', detail: 'action is unavailable under the active jurisdiction pack' };
  }
  const usage = rolloverUsage(input.usage, input.now, mandate.budget.periodHours);
  if (usage.transactionsThisPeriod >= mandate.policy.frequencyMaxPerPeriod) {
    return { ok: false, code: 'FREQUENCY_EXCEEDED', detail: 'frequency constraint exceeded' };
  }
  const budget = evaluateBudget({ budget: mandate.budget, usage, proposal });
  if (!budget.ok) {
    return { ok: false, code: 'BUDGET_EXCEEDED', detail: budget.reason };
  }
  if (isHighRiskAction(proposal.intent)) {
    return { ok: false, code: 'HIGH_RISK_REQUIRES_HUMAN', detail: 'high-risk action requires direct human approval' };
  }
  return { ok: true };
}

export function approvalSatisfied(input: {
  readonly mandate: UserAgentMandate;
  readonly proposal: AgentTransactionProposal;
  readonly humanApproved: boolean;
  readonly approvalClassUsed?: string;
}): { readonly ok: true } | MandateRefusal {
  const required = input.mandate.policy.approval.class;
  if (required === 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE' && !isHighRiskAction(input.proposal.intent)) {
    return { ok: true };
  }
  if (!input.humanApproved) {
    return { ok: false, code: 'APPROVAL_REQUIRED', detail: `approval class ${required} is not satisfied` };
  }
  if (input.approvalClassUsed && input.approvalClassUsed !== required && required !== 'NO_ADDITIONAL_APPROVAL_WITHIN_MANDATE') {
    return { ok: false, code: 'APPROVAL_REQUIRED', detail: 'approval class does not match the mandate' };
  }
  return { ok: true };
}
