import { sha256Hex } from '../../../../../security/src/hash.ts';
import { lookupUnit } from '../../../units/convert.ts';
import {
  ATTRIBUTION_ACCOUNTING_DOMAIN,
  TIME_WINDOW_QUANTUM_SECONDS,
  type AttributionEventObservation,
  type AttributionReplayKeys,
  type ProductiveAttributionDecision,
} from './types.ts';

export function canonicalUnitId(unitId: string): string {
  return lookupUnit(unitId)?.canonicalBaseUnit ?? lookupUnit(unitId)?.unitId ?? unitId;
}

export function quantizeUnixSeconds(value: bigint): bigint {
  if (value < 0n) {
    return 0n;
  }
  return (value / TIME_WINDOW_QUANTUM_SECONDS) * TIME_WINDOW_QUANTUM_SECONDS;
}

function sortedJoin(values: readonly string[]): string {
  return [...values].sort().join(',');
}

function digest(parts: readonly string[]): string {
  return sha256Hex([ATTRIBUTION_ACCOUNTING_DOMAIN, ...parts].join('|'));
}

/**
 * Canonical event identity used for replay. Superficial claim, contribution,
 * category, object, controller, provider, and unit-alias labels are excluded
 * from the observation fingerprint so relabel attacks collide.
 */
export function observationFingerprint(observation: AttributionEventObservation): string {
  return digest([
    'observation',
    observation.geographyId,
    observation.batchId ?? '',
    observation.lotId ?? '',
    quantizeUnixSeconds(observation.validFromUnixSeconds).toString(),
    quantizeUnixSeconds(observation.validUntilUnixSeconds).toString(),
    observation.sourceQuantity.toString(),
    canonicalUnitId(observation.sourceUnitId),
    observation.independentlyEvidenced === true ? 'independent' : 'tied',
  ]);
}

export function evidenceFingerprint(observation: AttributionEventObservation): string {
  return digest([
    'evidence',
    sortedJoin(observation.oracleFactIds),
    observation.sourceQuantity.toString(),
    canonicalUnitId(observation.sourceUnitId),
    quantizeUnixSeconds(observation.validFromUnixSeconds).toString(),
    quantizeUnixSeconds(observation.validUntilUnixSeconds).toString(),
  ]);
}

export function categoryStrippedFingerprint(observation: AttributionEventObservation): string {
  return digest([
    'category-stripped',
    observationFingerprint(observation),
    evidenceFingerprint(observation),
  ]);
}

export function objectStrippedFingerprint(observation: AttributionEventObservation): string {
  return digest([
    'object-stripped',
    observation.geographyId,
    observation.sourceQuantity.toString(),
    canonicalUnitId(observation.sourceUnitId),
    quantizeUnixSeconds(observation.validFromUnixSeconds).toString(),
    quantizeUnixSeconds(observation.validUntilUnixSeconds).toString(),
    sortedJoin(observation.oracleFactIds),
    observation.batchId ?? '',
  ]);
}

export function controllerStrippedFingerprint(observation: AttributionEventObservation): string {
  return digest([
    'controller-stripped',
    observation.objectId,
    observation.geographyId,
    observation.sourceQuantity.toString(),
    canonicalUnitId(observation.sourceUnitId),
    quantizeUnixSeconds(observation.validFromUnixSeconds).toString(),
    quantizeUnixSeconds(observation.validUntilUnixSeconds).toString(),
    sortedJoin(observation.oracleFactIds),
  ]);
}

export function claimReplayKey(observation: AttributionEventObservation): string {
  return digest(['claim', observation.claimId, evidenceFingerprint(observation)]);
}

export function contributionReplayKey(observation: AttributionEventObservation): string {
  return digest(['contribution', observation.contributionId, evidenceFingerprint(observation)]);
}

export function quantizedWindowKey(observation: AttributionEventObservation): string {
  return digest([
    'window',
    observationFingerprint(observation),
    quantizeUnixSeconds(observation.validFromUnixSeconds).toString(),
    quantizeUnixSeconds(observation.validUntilUnixSeconds).toString(),
  ]);
}

export function idempotencyKey(
  observation: AttributionEventObservation,
  decision: ProductiveAttributionDecision,
): string {
  return digest([
    'idempotency',
    decision.economicEventId,
    decision.eventFingerprint,
    decision.claimId,
    decision.contributionId,
    String(decision.attributionPolicyVersion),
    decision.attributionDecisionId,
    observation.claimId,
    observation.contributionId,
  ]);
}

export function buildReplayKeys(
  observation: AttributionEventObservation,
  decision: ProductiveAttributionDecision,
): AttributionReplayKeys {
  return Object.freeze({
    idempotencyKey: idempotencyKey(observation, decision),
    eventFingerprint: decision.eventFingerprint,
    observationFingerprint: observationFingerprint(observation),
    evidenceFingerprint: evidenceFingerprint(observation),
    categoryStrippedFingerprint: categoryStrippedFingerprint(observation),
    objectStrippedFingerprint: objectStrippedFingerprint(observation),
    controllerStrippedFingerprint: controllerStrippedFingerprint(observation),
    claimReplayKey: claimReplayKey(observation),
    contributionReplayKey: contributionReplayKey(observation),
    quantizedWindowKey: quantizedWindowKey(observation),
  });
}

export function deriveEconomicEventId(observation: AttributionEventObservation): string {
  return observationFingerprint(observation);
}
