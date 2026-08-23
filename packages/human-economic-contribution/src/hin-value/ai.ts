/**
 * Bounded AI role for HIN contribution measurement.
 *
 * AI may classify, flag anomalies, explain valuation, and summarize
 * aggregates. AI may not verify, set policy, set mint amounts, or
 * approve issuance.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import { HIN_PRODUCT_CATEGORIES, isHinProductCategory, type HinProductCategory } from './categories.ts';
import { detectQuantitySpike } from './caps.ts';
import {
  hinFailure,
  type HinActor,
  type HinAggregateMetrics,
  type HinAnomalyFlag,
  type HinContributionRecord,
  type HinEconomicValueInput,
  type HinFailure,
} from './types.ts';

export const HIN_AI_ROLE = Object.freeze({
  mayClassifyWithBoundedSchema: true,
  mayDetectAnomalies: true,
  mayExplainValuation: true,
  maySummarizeAggregates: true,
  mayDeclareVerified: false,
  maySetEconomicPolicy: false,
  maySetMintAmount: false,
  mayApproveIssuance: false,
});

export function refuseAiAuthority(actor: HinActor, action: 'verify' | 'policy' | 'mint' | 'issuance'): Result<never, HinFailure> {
  if (actor.kind !== 'AI') {
    return err(hinFailure('UNAUTHORIZED_ACTOR', `${actor.kind} is not an AI actor`));
  }
  if (action === 'verify') {
    return err(hinFailure('AI_CANNOT_VERIFY', 'AI cannot declare a contribution verified'));
  }
  if (action === 'policy') {
    return err(hinFailure('AI_CANNOT_SET_POLICY', 'AI cannot set HIN economic policy'));
  }
  if (action === 'mint') {
    return err(hinFailure('AI_CANNOT_SET_MINT', 'AI cannot set a mint amount'));
  }
  return err(hinFailure('AI_CANNOT_APPROVE_ISSUANCE', 'AI cannot approve SunRey issuance'));
}

export function aiClassifyCategory(input: { readonly proposedCategory: string }): Result<HinProductCategory, HinFailure> {
  if (!isHinProductCategory(input.proposedCategory)) {
    return err(hinFailure('CATEGORY_UNKNOWN', `AI classification '${input.proposedCategory}' is outside the bounded HIN category schema`));
  }
  return ok(input.proposedCategory);
}

export function aiFlagAnomaly(record: HinContributionRecord): HinAnomalyFlag | null {
  return detectQuantitySpike({
    contributionId: record.contributionId,
    quantity: record.quantity,
    typicalQuantity: 1n,
  });
}

export function aiExplainValueInput(input: HinEconomicValueInput): {
  readonly explanation: string;
  readonly authoritative: false;
  readonly setsMintAmount: false;
} {
  return Object.freeze({
    explanation: `Economic value input ${input.normalizedValue.toString()} ${input.denomination} was computed from methodology ${input.methodologyId} v${input.methodologyVersion} using quantity ${input.inputs.quantity}, quality ${input.inputs.qualityBps} bps, confidence ${input.inputs.confidenceBps} bps, and verification ${input.inputs.verificationState}. This is not a mint amount.`,
    authoritative: false,
    setsMintAmount: false,
  });
}

export function aiSummarizeMetrics(metrics: HinAggregateMetrics): {
  readonly summary: string;
  readonly individualRecordsExposed: false;
} {
  return Object.freeze({
    summary: `HIN aggregates cover ${metrics.verifiedContributors} verified contributors and ${metrics.contributionVolume} contributions across ${metrics.contributionCategories.length} categories. Economic value inputs total ${metrics.economicValueInputs.totalNormalized} ${metrics.economicValueInputs.denomination}. Individual records are not exposed.`,
    individualRecordsExposed: false,
  });
}

export function boundedCategorySchema(): readonly HinProductCategory[] {
  return HIN_PRODUCT_CATEGORIES;
}
