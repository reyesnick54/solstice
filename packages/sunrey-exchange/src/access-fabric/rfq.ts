import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExchangeAccountId, ExchangeMarketId } from '../ids.ts';
import { comparePrice } from '../price.ts';
import type {
  CapacityAccessTerms,
  CapacityQuote,
  CapacityQuoteEvaluation,
  CapacityRfq,
  CapacityRfqAward,
} from './types.ts';
import type { AccessPolicyRefusalCode } from './taxonomy.ts';
import { evaluateTermsCompleteness, windowsOverlap } from './terms.ts';

/**
 * Request for quote on productive capacity.
 *
 * Regulatory compatibility is a filter, not a score. `filterPermittedQuotes`
 * runs before any ranking, so a non-permitted quote cannot win under any
 * weighting. Ranking itself is deterministic: price, then submission sequence,
 * then quote id.
 */
export function openCapacityRfq(input: {
  readonly rfqId: string;
  readonly marketId: ExchangeMarketId;
  readonly buyerAccountId: ExchangeAccountId;
  readonly terms: CapacityAccessTerms;
  readonly closesAtHeight: bigint;
  readonly invitedProviders?: readonly string[];
  readonly at: UtcInstant;
}): CapacityRfq {
  const completeness = evaluateTermsCompleteness(input.terms);
  if (!completeness.complete) {
    throw new TypeError(`RFQ refused: incomplete terms (${completeness.missing.join(', ')})`);
  }
  return Object.freeze({
    rfqId: input.rfqId,
    marketId: input.marketId,
    buyerAccountId: input.buyerAccountId,
    terms: input.terms,
    closesAtHeight: input.closesAtHeight,
    state: 'OPEN',
    invitedProviders: Object.freeze([...(input.invitedProviders ?? [])]),
    createdAt: input.at,
  });
}

export function closeCapacityRfq(rfq: CapacityRfq): CapacityRfq {
  return Object.freeze({ ...rfq, state: 'CLOSED' });
}

export function cancelCapacityRfq(rfq: CapacityRfq): CapacityRfq {
  return Object.freeze({ ...rfq, state: 'CANCELLED' });
}

export function acceptsQuoteAt(rfq: CapacityRfq, height: bigint): boolean {
  return rfq.state === 'OPEN' && height < rfq.closesAtHeight;
}

export function submitCapacityQuote(rfq: CapacityRfq, quote: CapacityQuote, height: bigint): CapacityQuote {
  if (!acceptsQuoteAt(rfq, height)) {
    throw new TypeError('RFQ is not accepting quotes at this height');
  }
  if (quote.rfqId !== rfq.rfqId) {
    throw new TypeError('quote does not reference this RFQ');
  }
  if (quote.unitPrice.baseAssetId !== rfq.terms.unit) {
    throw new TypeError('quote unit price base must be the requested capacity unit');
  }
  return Object.freeze({ ...quote, submittedAtHeight: height });
}

/**
 * Deterministic permitted/not-permitted filter. Every refusal code is reported
 * so a rejected provider is told why rather than silently outranked.
 */
export function evaluateCapacityQuote(input: {
  readonly rfq: CapacityRfq;
  readonly quote: CapacityQuote;
  readonly providerJurisdiction: Jurisdiction;
  readonly providerCapabilities: readonly string[];
  readonly providerVerified: boolean;
}): CapacityQuoteEvaluation {
  const terms = input.rfq.terms;
  const refusals: AccessPolicyRefusalCode[] = [];

  if (terms.policyRequirements.deniedJurisdictions.includes(input.providerJurisdiction)) {
    refusals.push('JURISDICTION_FORBIDDEN');
  } else if (
    terms.policyRequirements.permittedJurisdictions.length > 0 &&
    !terms.policyRequirements.permittedJurisdictions.includes(input.providerJurisdiction)
  ) {
    refusals.push('JURISDICTION_FORBIDDEN');
  }
  if (terms.policyRequirements.requireVerifiedAccount && !input.providerVerified) {
    refusals.push('ELIGIBILITY_DENIED');
  }
  const missingCapability = terms.policyRequirements.requiredCapabilities.some(
    (capability) => !input.providerCapabilities.includes(capability),
  );
  if (missingCapability) {
    refusals.push('ELIGIBILITY_DENIED');
  }
  if (!terms.permittedConsideration.includes(input.quote.consideration)) {
    refusals.push('CONSIDERATION_NOT_PERMITTED');
  }
  if (!windowsOverlap(terms.availabilityWindow, input.quote.deliverableWindow)) {
    refusals.push('AVAILABILITY_WINDOW_CLOSED');
  }
  if (
    input.rfq.invitedProviders.length > 0 &&
    !input.rfq.invitedProviders.includes(input.quote.providerId)
  ) {
    refusals.push('ELIGIBILITY_DENIED');
  }

  const unique = [...new Set(refusals)];
  return Object.freeze({
    quoteId: input.quote.quoteId,
    permitted: unique.length === 0,
    refusalCodes: Object.freeze(unique),
  });
}

export function filterPermittedQuotes(
  evaluations: readonly CapacityQuoteEvaluation[],
): {
  readonly permittedQuoteIds: readonly string[];
  readonly filteredOut: readonly CapacityQuoteEvaluation[];
} {
  const permitted: string[] = [];
  const filteredOut: CapacityQuoteEvaluation[] = [];
  for (const evaluation of evaluations) {
    if (evaluation.permitted) {
      permitted.push(evaluation.quoteId);
    } else {
      filteredOut.push(evaluation);
    }
  }
  return Object.freeze({
    permittedQuoteIds: Object.freeze(permitted),
    filteredOut: Object.freeze(filteredOut),
  });
}

/**
 * Award an RFQ. The permitted set is computed first and only permitted quotes
 * are ranked. Award quantity never exceeds the requested quantity.
 */
export function awardCapacityRfq(input: {
  readonly rfq: CapacityRfq;
  readonly quotes: readonly CapacityQuote[];
  readonly evaluations: readonly CapacityQuoteEvaluation[];
}): CapacityRfqAward {
  const { permittedQuoteIds, filteredOut } = filterPermittedQuotes(input.evaluations);
  const eligible = input.quotes.filter((quote) => permittedQuoteIds.includes(quote.quoteId));
  const ranked = [...eligible].sort((a, b) => {
    const priceCmp = comparePrice(a.unitPrice, b.unitPrice);
    if (priceCmp !== 0) {
      return priceCmp;
    }
    if (a.sequence !== b.sequence) {
      return a.sequence - b.sequence;
    }
    return a.quoteId < b.quoteId ? -1 : a.quoteId > b.quoteId ? 1 : 0;
  });
  const winner = ranked[0];
  const requested = input.rfq.terms.quantity;
  const awardedQuantity = winner
    ? winner.offeredQuantity < requested
      ? winner.offeredQuantity
      : requested
    : 0n;

  return Object.freeze({
    rfqId: input.rfq.rfqId,
    awardedQuoteId: winner ? winner.quoteId : null,
    awardedQuantity,
    awardedUnitPrice: winner ? winner.unitPrice : null,
    consideredQuoteIds: Object.freeze(ranked.map((quote) => quote.quoteId)),
    filteredOut,
    tieBreak: 'PRICE_THEN_SEQUENCE_THEN_QUOTE_ID',
  });
}
