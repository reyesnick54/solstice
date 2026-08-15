import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EconomicSourceId } from './ids.ts';

export const SOURCE_TYPES = [
  'CANONICAL_LEDGER',
  'SOLSTICE_PAYMENT',
  'SOLSTICE_CARD',
  'USER_DECLARED',
  'IDENTITY',
  'EXTERNAL_CONNECTOR',
  'DERIVED',
  'MODEL_INFERENCE_FUTURE',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const FACT_CONFIDENCES = [
  'AUTHORITATIVE',
  'VERIFIED',
  'USER_DECLARED',
  'DERIVED',
  'INFERRED',
] as const;

export type FactConfidence = (typeof FACT_CONFIDENCES)[number];

export const DATA_QUALITY_STATES = ['CURRENT', 'STALE', 'CONFLICTED', 'INCOMPLETE'] as const;
export type DataQualityState = (typeof DATA_QUALITY_STATES)[number];

export type Provenance = {
  readonly sourceId: EconomicSourceId;
  readonly sourceType: SourceType;
  readonly sourceRef: string;
  readonly observedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
  readonly confidence: FactConfidence;
  readonly version: number;
};

export type ProvenanceFailure = {
  readonly code: 'INFERRED_LABELED_AUTHORITATIVE' | 'USER_DECLARED_MASQUERADE' | 'INVALID_CONFIDENCE';
  readonly message: string;
};

const CANONICAL_SOURCES: readonly SourceType[] = [
  'CANONICAL_LEDGER',
  'SOLSTICE_PAYMENT',
  'SOLSTICE_CARD',
  'IDENTITY',
];

/**
 * Inferred and user-declared facts cannot masquerade as verified or
 * authoritative. Amounts projected into PEG are never AUTHORITATIVE —
 * the ledger remains the balance source of truth.
 */
export function assertFactConfidence(
  sourceType: SourceType,
  confidence: FactConfidence,
  factKey?: string,
): Result<void, ProvenanceFailure> {
  if (confidence === 'AUTHORITATIVE' && !CANONICAL_SOURCES.includes(sourceType)) {
    return err({
      code: 'INFERRED_LABELED_AUTHORITATIVE',
      message: `${sourceType} facts cannot be labeled AUTHORITATIVE`,
    });
  }
  if (
    (sourceType === 'DERIVED' || sourceType === 'MODEL_INFERENCE_FUTURE' || sourceType === 'EXTERNAL_CONNECTOR') &&
    (confidence === 'AUTHORITATIVE' || confidence === 'VERIFIED')
  ) {
    return err({
      code: 'INFERRED_LABELED_AUTHORITATIVE',
      message: `${sourceType} facts cannot be labeled ${confidence}`,
    });
  }
  if (sourceType === 'USER_DECLARED' && (confidence === 'AUTHORITATIVE' || confidence === 'VERIFIED')) {
    return err({
      code: 'USER_DECLARED_MASQUERADE',
      message: 'USER_DECLARED facts cannot masquerade as verified or authoritative',
    });
  }
  if (confidence === 'INFERRED' && (sourceType === 'CANONICAL_LEDGER' || sourceType === 'IDENTITY')) {
    return err({
      code: 'INVALID_CONFIDENCE',
      message: 'canonical sources are not INFERRED',
    });
  }
  if (
    confidence === 'AUTHORITATIVE' &&
    factKey !== undefined &&
    /^(balance|position|available|liquid_total|cross_currency_total)$/i.test(factKey)
  ) {
    return err({
      code: 'INFERRED_LABELED_AUTHORITATIVE',
      message: 'PEG must not store an AUTHORITATIVE balance; the ledger wins',
    });
  }
  return ok(undefined);
}

export function freezeProvenance(input: Provenance): Provenance {
  return Object.freeze({ ...input });
}

export function sourcesDisagree(
  left: { readonly confidence: FactConfidence; readonly valueKey: string },
  right: { readonly confidence: FactConfidence; readonly valueKey: string },
): boolean {
  const ranked = (c: FactConfidence): number => {
    switch (c) {
      case 'AUTHORITATIVE':
        return 4;
      case 'VERIFIED':
        return 3;
      case 'USER_DECLARED':
        return 2;
      case 'DERIVED':
        return 1;
      case 'INFERRED':
        return 0;
    }
  };
  return left.valueKey !== right.valueKey && ranked(left.confidence) === ranked(right.confidence);
}
