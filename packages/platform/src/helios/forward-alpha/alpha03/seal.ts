import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA03_PREQUENTIAL_SCHEMA } from './taxonomy.ts';
import { digestPrequentialContent, stableStringify } from './digest.ts';
import type { PrequentialPredictedLabel } from './taxonomy.ts';
import type { PrequentialDecision, PrequentialDecisionSeal } from './types.ts';

export function digestPrequentialContext(input: {
  readonly decisionTime: UtcInstant;
  readonly instrumentId: string;
  readonly observationEventIds: readonly string[];
  readonly midsByEventId: Readonly<Record<string, string>>;
}): string {
  return digestPrequentialContent({
    decisionTime: input.decisionTime,
    instrumentId: input.instrumentId,
    observationEventIds: [...input.observationEventIds].sort(),
    midsByEventId: input.midsByEventId,
  });
}

export function sealPrequentialDecision(input: {
  readonly decisionId: string;
  readonly campaignId: string;
  readonly decisionTime: UtcInstant;
  readonly predictedLabel: PrequentialPredictedLabel;
  readonly predictedReferenceMidMinor: string;
  readonly instrumentId: string;
  readonly contextDigest: string;
  readonly observationEventIdsAtDecision: readonly string[];
  readonly outcomeHorizonMs: number;
  readonly modelVersion: string;
  readonly sealedAt: UtcInstant;
}): PrequentialDecision {
  const core = {
    schema: HELIOS_ALPHA03_PREQUENTIAL_SCHEMA,
    decisionId: input.decisionId,
    campaignId: input.campaignId,
    decisionTime: input.decisionTime,
    predictedLabel: input.predictedLabel,
    predictedReferenceMidMinor: input.predictedReferenceMidMinor,
    instrumentId: input.instrumentId,
    contextDigest: input.contextDigest,
    observationEventIdsAtDecision: input.observationEventIdsAtDecision,
    outcomeHorizonMs: input.outcomeHorizonMs,
    modelVersion: input.modelVersion,
    outcome: null,
    score: null,
    immutableAfterSeal: true as const,
    grantsExecutionAuthority: false as const,
  };
  const contentHash = createHash('sha256')
    .update(stableStringify(core))
    .digest('hex')
    .slice(0, 64);
  const seal: PrequentialDecisionSeal = Object.freeze({
    sealedAt: input.sealedAt,
    contentHash,
  });
  return Object.freeze({
    ...core,
    seal,
  });
}

export function assertPrequentialDecisionUnchanged(
  prior: PrequentialDecision,
  attempted: PrequentialDecision,
): boolean {
  return prior.seal.contentHash === attempted.seal.contentHash;
}

/** Labels used by the default midpoint momentum predictor. */
export function labelFromMidDelta(
  priorMidMinor: string | null,
  currentMidMinor: string,
): PrequentialPredictedLabel {
  if (priorMidMinor === null) {
    return 'FLAT';
  }
  const prior = BigInt(priorMidMinor);
  const current = BigInt(currentMidMinor);
  if (current > prior) {
    return 'UP';
  }
  if (current < prior) {
    return 'DOWN';
  }
  return 'FLAT';
}
