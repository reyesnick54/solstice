import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EconomicSourceId } from './ids.ts';
import type { FactKind, VerificationState } from './taxonomy.ts';

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

export const VERIFICATION_FROM_SOURCE: Readonly<Record<SourceType, VerificationState>> = {
  CANONICAL_LEDGER: 'LEDGER_BACKED',
  SOLSTICE_PAYMENT: 'SOURCE_VERIFIED',
  SOLSTICE_CARD: 'SOURCE_VERIFIED',
  USER_DECLARED: 'USER_DECLARED',
  IDENTITY: 'SOURCE_VERIFIED',
  EXTERNAL_CONNECTOR: 'UNVERIFIED',
  DERIVED: 'UNVERIFIED',
  MODEL_INFERENCE_FUTURE: 'UNVERIFIED',
};

export function factKindOf(sourceType: SourceType, confidence: FactConfidence): FactKind {
  if (sourceType === 'MODEL_INFERENCE_FUTURE' || confidence === 'INFERRED') {
    return 'AI_INFERENCE';
  }
  if (sourceType === 'USER_DECLARED' || confidence === 'USER_DECLARED') {
    return 'USER_DECLARATION';
  }
  if (sourceType === 'DERIVED' || confidence === 'DERIVED') {
    return 'DERIVED_INSIGHT';
  }
  return 'FACT';
}

export type MaterialFactProvenance = Provenance & {
  readonly source: SourceType;
  readonly sourceReference: string;
  readonly updatedAt: UtcInstant;
  readonly verificationState: VerificationState;
  readonly userDeclared: boolean;
  readonly derived: boolean;
  readonly factKind: FactKind;
};

export function materializeProvenance(input: Provenance, updatedAt?: UtcInstant): MaterialFactProvenance {
  const factKind = factKindOf(input.sourceType, input.confidence);
  return Object.freeze({
    ...input,
    source: input.sourceType,
    sourceReference: input.sourceRef,
    updatedAt: updatedAt ?? input.observedAt,
    verificationState: VERIFICATION_FROM_SOURCE[input.sourceType],
    userDeclared: input.sourceType === 'USER_DECLARED' || input.confidence === 'USER_DECLARED',
    derived: input.sourceType === 'DERIVED' || input.confidence === 'DERIVED' || factKind === 'DERIVED_INSIGHT',
    factKind,
  });
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
