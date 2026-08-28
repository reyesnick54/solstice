import type { AiApprovedPurpose } from './taxonomy.ts';
import type { AiContextObject } from './types.ts';

const PURPOSE_FIELDS: Readonly<Record<AiApprovedPurpose, readonly string[]>> = Object.freeze({
  FINANCIAL_EXPLANATION: Object.freeze(['accountId', 'currency', 'availableMinorUnits', 'accountClass']),
  STRUCTURED_PROPOSAL_NARRATION: Object.freeze([
    'accountId',
    'assetId',
    'quantityMinorUnits',
    'destinationOrMarket',
    'feeMinorUnits',
    'currency',
  ]),
  SIMPLE_CLASSIFICATION: Object.freeze(['intentHint']),
  GROWTH_PLANNING: Object.freeze(['goalId', 'horizon', 'availableMinorUnits', 'currency']),
  PORTFOLIO_REASONING: Object.freeze(['positionId', 'assetId', 'quantityMinorUnits', 'currency']),
  PAYMENT_PREPARATION: Object.freeze(['accountId', 'currency', 'availableMinorUnits', 'destinationOrMarket']),
  EXCHANGE_ORDER_PREPARATION: Object.freeze(['assetId', 'quantityMinorUnits', 'market', 'currency']),
  USER_SUPPORT: Object.freeze(['topic']),
  REGULATORY_EXPLANATION: Object.freeze(['topic', 'jurisdictionRef']),
  GENERAL_ASSISTANT: Object.freeze(['topic']),
  MARKET_OPPORTUNITY_RESEARCH: Object.freeze([
    'marketUniverse',
    'publicContext',
    'priceBehavior',
    'marketStatistics',
    'economicContext',
    'publicNews',
    'publicSearchResults',
  ]),
});

export const DEFAULT_MAX_CONTEXT_OBJECTS = 8;

/**
 * Controlled context envelope. Never dump entire user records or database rows.
 */
export function minimizeContext(input: {
  readonly purpose: AiApprovedPurpose;
  readonly objects: readonly AiContextObject[];
  readonly maxObjects?: number;
}): readonly AiContextObject[] {
  const allowed = new Set(PURPOSE_FIELDS[input.purpose]);
  const max = input.maxObjects ?? DEFAULT_MAX_CONTEXT_OBJECTS;
  const minimized: AiContextObject[] = [];
  for (const object of input.objects.slice(0, max)) {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(object.payload)) {
      if (allowed.has(key)) {
        payload[key] = value;
      }
    }
    minimized.push(
      Object.freeze({
        ...object,
        payload: Object.freeze(payload),
      }),
    );
  }
  return Object.freeze(minimized);
}
