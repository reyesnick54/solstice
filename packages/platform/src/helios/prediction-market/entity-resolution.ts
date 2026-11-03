/**
 * Entity resolution — Polymarket native IDs → canonical HELIOS prediction instruments.
 */

import type { UtcInstant } from '@solstice/domain';
import { entityResolutionKey, yesNoContractInstrumentId } from './ids.ts';
import type { PredictionOutcomeSide } from './taxonomy.ts';
import type { EntityResolutionBinding } from './types.ts';
import { POLYMARKET_RESEARCH_PROVIDER_ID } from './taxonomy.ts';

export type ResolveEntityInput = {
  readonly providerNativeConditionId: string;
  readonly providerNativeTokenId: string;
  readonly side: PredictionOutcomeSide;
  readonly resolvedAt: UtcInstant;
};

export function resolvePolymarketTokenEntity(input: ResolveEntityInput): EntityResolutionBinding {
  const canonicalInstrumentId = yesNoContractInstrumentId(input.providerNativeConditionId, input.side);
  return Object.freeze({
    resolutionKey: entityResolutionKey(input.providerNativeConditionId, input.providerNativeTokenId),
    providerId: POLYMARKET_RESEARCH_PROVIDER_ID,
    providerNativeConditionId: input.providerNativeConditionId,
    providerNativeTokenId: input.providerNativeTokenId,
    canonicalInstrumentId,
    resolvedAt: input.resolvedAt,
  });
}

export function lookupCanonicalInstrument(
  bindings: readonly EntityResolutionBinding[],
  providerNativeConditionId: string,
  providerNativeTokenId: string,
): string | null {
  const key = entityResolutionKey(providerNativeConditionId, providerNativeTokenId);
  return bindings.find((b) => b.resolutionKey === key)?.canonicalInstrumentId ?? null;
}
