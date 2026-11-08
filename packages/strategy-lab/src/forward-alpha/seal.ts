import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import {
  asForwardAlphaDecisionId,
  forwardAlphaDecisionMaterial,
  type ForwardAlphaCampaignId,
} from './ids.ts';
import type { ForwardAlphaEvidenceLane } from './taxonomy.ts';
import type { ForwardAlphaDecision } from './types.ts';
import { HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA } from './taxonomy.ts';
import type { ForwardAlphaStrategyId } from './ids.ts';

export function digestForwardAlphaFeatureVersions(featureVersions: Readonly<Record<string, string>>): string {
  const ordered = Object.keys(featureVersions).sort();
  const payload = ordered.map((key) => `${key}=${featureVersions[key]}`).join(';');
  return createHash('sha256').update(payload).digest('hex');
}

export function digestForwardAlphaMarketDataSequence(observationDigests: readonly string[]): string {
  return createHash('sha256').update(observationDigests.join(':')).digest('hex');
}

export function sealForwardAlphaDecision(input: {
  readonly campaignId: ForwardAlphaCampaignId;
  readonly strategyId: ForwardAlphaStrategyId;
  readonly strategyVersion: string;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly decisionAt: UtcInstant;
  readonly earliestOutcomeKnowableAt: UtcInstant;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly observationDigests: readonly string[];
  readonly sealedAt: UtcInstant;
  readonly liveCapital?: boolean;
}): ForwardAlphaDecision {
  const featureVersionsDigest = digestForwardAlphaFeatureVersions(input.featureVersions);
  const marketDataSequenceDigest = digestForwardAlphaMarketDataSequence(input.observationDigests);
  const material = forwardAlphaDecisionMaterial({
    campaignId: input.campaignId,
    lane: input.evidenceLane,
    decisionAt: input.decisionAt,
    strategyVersion: input.strategyVersion,
    featureVersionsDigest,
    marketDataSequenceDigest,
  });
  const sealDigest = createHash('sha256').update(material).digest('hex');
  const decisionId = asForwardAlphaDecisionId(`fade_${sealDigest.slice(0, 24)}`);
  return Object.freeze({
    schemaVersion: HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
    decisionId,
    campaignId: input.campaignId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    evidenceLane: input.evidenceLane,
    decisionAt: input.decisionAt,
    earliestOutcomeKnowableAt: input.earliestOutcomeKnowableAt,
    featureVersions: Object.freeze({ ...input.featureVersions }),
    sealDigest,
    sealedAt: input.sealedAt,
    immutableAfterSeal: true,
    outcomeId: null,
    outcomeAttachedAt: null,
    liveCapital: input.liveCapital ?? false,
  });
}

export function attachForwardAlphaOutcomeRef(input: {
  readonly decision: ForwardAlphaDecision;
  readonly outcomeId: import('./ids.ts').ForwardAlphaOutcomeId;
  readonly attachedAt: UtcInstant;
}): ForwardAlphaDecision {
  if (!input.decision.immutableAfterSeal) {
    throw new Error('forward alpha decision must be sealed before outcome attachment');
  }
  if (Date.parse(input.attachedAt) < Date.parse(input.decision.sealedAt)) {
    throw new Error('outcome cannot precede decision seal');
  }
  return Object.freeze({
    ...input.decision,
    outcomeId: input.outcomeId,
    outcomeAttachedAt: input.attachedAt,
  });
}
