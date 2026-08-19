/**
 * Deterministic reference-fact resolution for the Productive Value engine.
 *
 * Reference price alone cannot establish Productive Value.
 * Social-media sentiment is forbidden.
 * Unverified provider self-report is insufficient where independent
 * evidence is required.
 */

import { categoryPlan } from './factors.ts';
import {
  GEOGRAPHIC_CONTEXT_KINDS,
  valueFunctionOk,
  valueFunctionRefuse,
  type GeographicContextKind,
  type ProductiveValueInput,
  type ProductiveValueReferenceFact,
  type ValueFunctionResult,
  type ValueReferenceFactType,
} from './types.ts';
import type { GeographyRef, MeasurementPeriod, ProductiveCategory } from '../../types.ts';

export const MINIMUM_REFERENCE_SOURCE_QUORUM = 2 as const;
export const MAXIMUM_REFERENCE_FRESHNESS_EPOCHS = 2 as const;

export type ResolvedReferenceFacts = {
  readonly facts: readonly ProductiveValueReferenceFact[];
  readonly factIds: readonly string[];
  readonly byType: Readonly<Partial<Record<ValueReferenceFactType, readonly ProductiveValueReferenceFact[]>>>;
};

export function periodsMatch(left: MeasurementPeriod, right: MeasurementPeriod): boolean {
  return (
    left.epoch === right.epoch &&
    left.validFromUnixSeconds === right.validFromUnixSeconds &&
    left.validUntilUnixSeconds === right.validUntilUnixSeconds
  );
}

export function geographyMatches(left: GeographyRef, right: GeographyRef): boolean {
  return left.geographyId === right.geographyId && left.jurisdiction === right.jurisdiction;
}

export function isPermittedGeographicContext(kind: string | undefined): kind is GeographicContextKind {
  return kind !== undefined && (GEOGRAPHIC_CONTEXT_KINDS as readonly string[]).includes(kind);
}

export function resolveReferenceFacts(
  category: ProductiveCategory,
  input: ProductiveValueInput,
): ValueFunctionResult<ResolvedReferenceFacts> {
  if (input.referencePriceAlone) {
    return valueFunctionRefuse(
      'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
      'a reference price alone cannot establish Productive Value',
    );
  }
  if (input.aiEconomicJudgment) {
    return valueFunctionRefuse('AI_ECONOMIC_JUDGMENT_FORBIDDEN', 'AI economic judgment cannot set productive value');
  }
  const facts = input.referenceFacts;
  if (facts.some((fact) => fact.socialMediaSentiment)) {
    return valueFunctionRefuse('FORBIDDEN_INPUT', 'social-media sentiment cannot enter the value function');
  }
  if (facts.some((fact) => fact.moonreyMarketPrice)) {
    return valueFunctionRefuse(
      'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
      'MoonRey market price cannot become a self-referential multiplier',
    );
  }
  if (facts.length === 1 && facts[0]?.factType === 'REFERENCE_PRICE') {
    return valueFunctionRefuse(
      'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
      'reference price is context, never automatic value',
    );
  }
  const onlyPrice = facts.length > 0 && facts.every((fact) => fact.factType === 'REFERENCE_PRICE');
  if (onlyPrice) {
    return valueFunctionRefuse(
      'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
      'reference price facts alone cannot establish Productive Value',
    );
  }

  const conflicts = detectFactConflicts(facts);
  if (conflicts) {
    return valueFunctionRefuse('REFERENCE_FACTS_CONFLICT', conflicts);
  }

  for (const fact of facts) {
    if (!fact.verified || !fact.policyCompatible) {
      return valueFunctionRefuse('MISSING_INPUT_FAIL_CLOSED', `${fact.factId} is not a verified policy-compatible reference`);
    }
    if (fact.stale || fact.freshnessEpochs > MAXIMUM_REFERENCE_FRESHNESS_EPOCHS) {
      return valueFunctionRefuse('REFERENCE_FACT_STALE', `${fact.factId} exceeds the governed freshness window`);
    }
    if (fact.sourceQuorumEvidence.length < MINIMUM_REFERENCE_SOURCE_QUORUM) {
      return valueFunctionRefuse(
        'REFERENCE_FACT_QUORUM_INSUFFICIENT',
        `${fact.factId} lacks independent source quorum`,
      );
    }
    if (fact.quality < 0n) {
      return valueFunctionRefuse('NEGATIVE_FACTOR_UNDEFINED', `${fact.factId} quality cannot be negative`);
    }
    if (typeof fact.quality !== 'bigint') {
      return valueFunctionRefuse('FLOAT_MATH_FORBIDDEN', `${fact.factId} quality must be bigint`);
    }
    if (!periodsMatch(fact.measurementPeriod, input.measurementPeriod)) {
      return valueFunctionRefuse(
        'REFERENCE_FACTS_CONFLICT',
        `${fact.factId} measurement period does not match the valued event`,
      );
    }
    if (fact.geography.jurisdiction !== input.geography.jurisdiction) {
      return valueFunctionRefuse('GEOGRAPHY_AMBIGUOUS', `${fact.factId} jurisdiction does not match the valued event`);
    }
  }

  const requiredTypes = categoryPlan(category).references;
  const present = new Set(facts.map((fact) => fact.factType));
  const missingRequired = requiredTypes.filter((type) => !present.has(type) && type !== 'REFERENCE_PRICE');
  if (missingRequired.length > 0 && requiredTypes.includes('QUALITY') && !present.has('QUALITY')) {
    return valueFunctionRefuse('MISSING_INPUT_FAIL_CLOSED', 'QUALITY reference evidence is required');
  }

  const byType: Partial<Record<ValueReferenceFactType, ProductiveValueReferenceFact[]>> = {};
  for (const fact of facts) {
    const bucket = byType[fact.factType] ?? [];
    bucket.push(fact);
    byType[fact.factType] = bucket;
  }
  return valueFunctionOk(
    Object.freeze({
      facts,
      factIds: facts.map((fact) => fact.factId).sort(),
      byType: Object.freeze(byType),
    }),
  );
}

function detectFactConflicts(facts: readonly ProductiveValueReferenceFact[]): string | null {
  for (const fact of facts) {
    if (fact.conflictsWithFactIds && fact.conflictsWithFactIds.length > 0) {
      return `${fact.factId} conflicts with ${fact.conflictsWithFactIds.join(',')}`;
    }
  }
  const grouped = new Map<string, ProductiveValueReferenceFact[]>();
  for (const fact of facts) {
    const key = `${fact.factType}|${fact.geography.geographyId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(fact);
    grouped.set(key, bucket);
  }
  for (const [key, bucket] of grouped) {
    if (bucket.length < 2) {
      continue;
    }
    const quantities = bucket
      .filter((item) => item.quantity)
      .map((item) => `${item.quantity!.numerator.toString()}/${item.quantity!.denominator.toString()}`);
    if (new Set(quantities).size > 1) {
      return `conflicting ${key} quantities`;
    }
  }
  return null;
}
