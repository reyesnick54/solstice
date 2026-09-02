/**
 * Wave 7 — Versioned JurisdictionContext.
 *
 * Supports distinct jurisdiction signals per dimension. Does not assume
 * user, entity, data, service, and transaction jurisdictions are identical.
 */

import { randomUUID } from 'node:crypto';

import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS } from './taxonomy.ts';
import {
  JURISDICTION_CONTEXT_SCHEMA_VERSION,
  type JurisdictionContext,
  type JurisdictionSignal,
} from './types.ts';

export type BuildJurisdictionContextInput = {
  readonly version?: string;
  readonly effectiveFrom: UtcInstant;
  readonly signals: readonly JurisdictionSignal[];
};

export function buildJurisdictionContext(input: BuildJurisdictionContextInput): JurisdictionContext {
  const jurisdictions = input.signals.map((signal) => signal.jurisdiction);
  const unique = [...new Set(jurisdictions)];

  let resolvedPrimary: string | null = null;
  let ambiguous = false;
  let ambiguityReason: string | null = null;

  if (unique.length === 0) {
    ambiguous = true;
    ambiguityReason = 'no jurisdiction signals provided';
  } else if (unique.length === 1) {
    resolvedPrimary = unique[0]!;
  } else {
    ambiguous = true;
    ambiguityReason = `conflicting jurisdiction signals: ${unique.join(', ')}`;
    resolvedPrimary = null;
  }

  return Object.freeze({
    schemaVersion: JURISDICTION_CONTEXT_SCHEMA_VERSION,
    contextId: `jctx_${randomUUID()}`,
    version: input.version ?? '1.0.0',
    effectiveFrom: input.effectiveFrom,
    signals: Object.freeze([...input.signals]),
    resolvedPrimary,
    ambiguous,
    ambiguityReason,
    legalStatus: LEGAL_REVIEW_STATUS,
  });
}

export function jurisdictionSignal(
  dimension: JurisdictionSignal['dimension'],
  countryCode: string,
  sourceRef: string,
): JurisdictionSignal {
  return Object.freeze({
    dimension,
    jurisdiction: asJurisdiction(countryCode),
    sourceRef,
  });
}

export function primaryJurisdictionOrDefer(context: JurisdictionContext): {
  readonly status: 'RESOLVED' | 'DEFER';
  readonly jurisdiction: string | null;
  readonly reasonCode: string;
} {
  if (context.ambiguous || context.resolvedPrimary === null) {
    return {
      status: 'DEFER',
      jurisdiction: null,
      reasonCode: 'JURISDICTION_CONTEXT_AMBIGUOUS',
    };
  }
  return {
    status: 'RESOLVED',
    jurisdiction: context.resolvedPrimary,
    reasonCode: 'JURISDICTION_CONTEXT_RESOLVED',
  };
}

export function jurisdictionsForDimension(
  context: JurisdictionContext,
  dimension: JurisdictionSignal['dimension'],
): readonly string[] {
  return Object.freeze(
    context.signals.filter((signal) => signal.dimension === dimension).map((signal) => signal.jurisdiction),
  );
}

export function hasCrossBorderSignal(context: JurisdictionContext): boolean {
  const user = jurisdictionsForDimension(context, 'USER');
  const storage = jurisdictionsForDimension(context, 'DATA_STORAGE');
  const transaction = jurisdictionsForDimension(context, 'TRANSACTION');
  const all = [...user, ...storage, ...transaction];
  return new Set(all).size > 1;
}
