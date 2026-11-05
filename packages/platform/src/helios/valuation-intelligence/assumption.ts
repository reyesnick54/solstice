/**
 * Explicit, versioned valuation assumptions — never embedded in LLM prompts.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  ValuationAssumptionValueKind,
  ValuationInputSource,
} from './taxonomy.ts';
import type { ValuationTemporalEnvelope } from './temporal-envelope.ts';

export type ValuationAssumptionValue =
  | { readonly kind: 'ratio_decimal'; readonly decimal: string; readonly unit: string | null }
  | { readonly kind: 'integer_minor'; readonly valueMinor: bigint; readonly currency: string }
  | { readonly kind: 'count'; readonly count: number; readonly unit: string | null }
  | { readonly kind: 'duration_years'; readonly years: string; readonly unit: 'years' }
  | { readonly kind: 'probability'; readonly probability: string; readonly unit: 'probability' }
  | { readonly kind: 'text_explicit'; readonly text: string; readonly unit: string | null };

export type ValuationAssumption = ValuationTemporalEnvelope & {
  readonly assumptionId: string;
  readonly assumptionVersion: string;
  readonly parameterKey: string;
  readonly parameterLabel: string;
  readonly valueKind: ValuationAssumptionValueKind;
  readonly value: ValuationAssumptionValue;
  readonly inputSource: ValuationInputSource;
  readonly derivedFromEvidenceRefs: readonly string[];
  readonly authoredAt: UtcInstant;
  readonly supersedesAssumptionId: string | null;
  readonly explicitRationale: string | null;
  readonly hiddenInPrompt: false;
  readonly grantsExecutionAuthority: false;
};

export function freezeValuationAssumption(assumption: ValuationAssumption): ValuationAssumption {
  return Object.freeze({
    ...assumption,
    sourceRefs: Object.freeze([...assumption.sourceRefs]),
    evidenceRefs: Object.freeze([...assumption.evidenceRefs]),
    derivedFromEvidenceRefs: Object.freeze([...assumption.derivedFromEvidenceRefs]),
  });
}

export function assertAssumptionExplicit(assumption: ValuationAssumption): void {
  if (assumption.hiddenInPrompt !== false) {
    throw new Error(`assumption ${assumption.assumptionId} must remain explicit (not prompt-hidden)`);
  }
  if (!assumption.assumptionVersion.trim()) {
    throw new Error(`assumption ${assumption.assumptionId} requires assumptionVersion`);
  }
  if (!assumption.parameterKey.trim()) {
    throw new Error(`assumption ${assumption.assumptionId} requires parameterKey`);
  }
}
