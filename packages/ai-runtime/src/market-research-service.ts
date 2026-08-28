import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AiModelGateway, AiGatewayResult } from './gateway.ts';
import { asAiRequestId } from './ids.ts';
import { parseMarketOpportunityResearch, type MarketOpportunityResearchResult } from './market-research.ts';
import type { AiProviderFailure, AiContextObject } from './types.ts';

export type PublicMarketResearchInput = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly userApprovedExternal: boolean;
  readonly marketUniverse: readonly string[];
  readonly publicContext: Readonly<Record<string, unknown>>;
  readonly preferredProvider?: 'XAI_GROK' | 'S3M' | 'LOCAL_TEST';
};

export type PublicMarketResearchOutput = {
  readonly research: MarketOpportunityResearchResult;
  readonly gateway: AiGatewayResult;
};

/**
 * Bounded public-research facade. Customer and portfolio data are deliberately
 * absent from this input; personalization belongs to Growth after this call.
 */
export function researchPublicMarketOpportunities(
  gateway: AiModelGateway,
  input: PublicMarketResearchInput,
): Result<PublicMarketResearchOutput, AiProviderFailure> {
  if (containsPrivateKey(input.publicContext) || Object.keys(input.publicContext).some((key) => PRIVATE_KEYS.has(key))) {
    return err({ ok: false, code: 'SECRET_IN_PAYLOAD', detail: 'public research context contains private data', providerKind: null });
  }
  const context: AiContextObject = Object.freeze({
    objectId: 'public-market-context',
    dataClass: 'PUBLIC',
    authorizedProviders: Object.freeze(['XAI_GROK', 'S3M', 'LOCAL_TEST']),
    userApproved: true,
    payload: Object.freeze({
      marketUniverse: Object.freeze([...input.marketUniverse]),
      publicContext: input.publicContext,
    }),
  });
  const result = gateway.infer({
    requestId: asAiRequestId(input.requestId),
    purpose: 'MARKET_OPPORTUNITY_RESEARCH',
    taskClass: 'MARKET_OPPORTUNITY_RESEARCH',
    privacyClass: 'PUBLIC',
    mode: 'GROK_BETA_PRIMARY',
    authorization: {
      actorId: 'sunrey-research-service',
      subjectId: 'public-market-research',
      userApprovedExternal: input.userApprovedExternal,
      mandateId: null,
      agentId: null,
    },
    jurisdictionRef: null,
    conversationId: null,
    userId: 'public-research',
    context: Object.freeze([context]),
    responseSchema: 'MARKET_OPPORTUNITY_RESEARCH',
    correlationId: input.correlationId,
    preferredProvider: input.preferredProvider ?? 'XAI_GROK',
    allowFallback: false,
  });
  if (!result.ok) return result;
  const structured = result.value.response?.structured;
  if (!structured || structured.kind !== 'MARKET_OPPORTUNITY_RESEARCH') {
    return err({ ok: false, code: 'INVALID_STRUCTURED_OUTPUT', detail: 'research provider did not return market research', providerKind: result.value.model?.provider ?? null });
  }
  const validated = parseMarketOpportunityResearch(structured.result);
  return validated.ok ? ok({ research: validated.value, gateway: result.value }) : validated;
}

const PRIVATE_KEYS = new Set([
  'customerId', 'customerName', 'email', 'bankAccount', 'ledgerBalance',
  'transactionHistory', 'rawPeg', 'walletSecrets', 'privateHoldings',
  'kyc', 'identity', 'riskProfile', 'accountNumber',
]);

function containsPrivateKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsPrivateKey);
  return Object.entries(value).some(([key, child]) => PRIVATE_KEYS.has(key) || containsPrivateKey(child));
}
