// @ts-nocheck
/**
 * Information-layer verified economic fact.
 *
 * Produced only by successful Information Consensus. Zero monetary authority.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type { CandidateEconomicProposition, NormalizedEconomicObservation } from '../types.ts';
import type { MethodologyReference } from './types.ts';
import type { VerifiedEconomicFact, FixedQuantity } from '../../oracle/types.ts';
import { INFORMATION_CONSENSUS_SCHEMA_VERSION } from './types.ts';

export const INFORMATION_VERIFIED_FACT_SCHEMA = 'sunrey.information-verified-fact.v1' as const;

export type InformationVerifiedEconomicFact = {
  readonly schemaVersion: typeof INFORMATION_VERIFIED_FACT_SCHEMA;
  readonly factId: string;
  readonly propositionId: string;
  readonly subjectRef: string;
  readonly factType: CandidateEconomicProposition['factType'];
  readonly domain: CandidateEconomicProposition['domain'];
  readonly verifiedNumericValue: number | null;
  readonly verifiedCategoricalValue: string | null;
  readonly unit: CandidateEconomicProposition['unit'];
  readonly sourceObservationIds: readonly string[];
  readonly independentLineageRootIds: readonly string[];
  readonly methodology: MethodologyReference;
  readonly informationConsensusReceiptId: string;
  readonly validUntil: string;
  readonly verifiedAt: string;
  readonly grantsMonetaryAuthority: false;
  readonly grantsExecutionAuthority: false;
};

export function informationFactIdOf(
  propositionId: string,
  observationIds: readonly string[],
  methodology: MethodologyReference,
): string {
  return sha256Hex(
    `ic.fact.v1:${propositionId}:${[...observationIds].sort().join(',')}:${methodology.methodologyId}:${methodology.version}`,
  );
}

export function createInformationVerifiedEconomicFact(input: {
  readonly candidate: CandidateEconomicProposition;
  readonly observations: readonly NormalizedEconomicObservation[];
  readonly independentLineageRootIds: readonly string[];
  readonly methodology: MethodologyReference;
  readonly receiptId: string;
  readonly verifiedAt: string;
  readonly validUntil: string;
  readonly selectedNumericValue: number | null;
  readonly selectedCategoricalValue: string | null;
}): InformationVerifiedEconomicFact {
  const observationIds = [...input.observations.map((row) => row.observationId)].sort();
  return Object.freeze({
    schemaVersion: INFORMATION_VERIFIED_FACT_SCHEMA,
    factId: informationFactIdOf(input.candidate.propositionId, observationIds, input.methodology),
    propositionId: input.candidate.propositionId,
    subjectRef: input.candidate.subjectRef,
    factType: input.candidate.factType,
    domain: input.candidate.domain,
    verifiedNumericValue: input.selectedNumericValue,
    verifiedCategoricalValue: input.selectedCategoricalValue,
    unit: input.candidate.unit,
    sourceObservationIds: Object.freeze(observationIds),
    independentLineageRootIds: Object.freeze([...input.independentLineageRootIds].sort()),
    methodology: input.methodology,
    informationConsensusReceiptId: input.receiptId,
    validUntil: input.validUntil,
    verifiedAt: input.verifiedAt,
    grantsMonetaryAuthority: false,
    grantsExecutionAuthority: false,
  });
}

export function toOracleVerifiedEconomicFactCandidate(
  fact: InformationVerifiedEconomicFact,
): VerifiedEconomicFact | null {
  if (fact.verifiedNumericValue === null || fact.unit === null) {
    return null;
  }
  const aggregatedValue: FixedQuantity = Object.freeze({
    mantissa: BigInt(Math.round(fact.verifiedNumericValue)),
    scale: 0,
    unit: fact.unit,
  });
  const validUntilUnix = BigInt(Math.floor(Date.parse(fact.validUntil) / 1000));
  const windowStart = BigInt(Math.floor(Date.parse(fact.verifiedAt) / 1000) - 3600);
  const windowEnd = validUntilUnix;
  return Object.freeze({
    schemaVersion: 1,
    factId: fact.factId,
    feedId: `information-consensus:${fact.methodology.methodologyId}`,
    subject: fact.subjectRef,
    aggregatedValue,
    sourceObservationIds: fact.sourceObservationIds,
    aggregationPolicy: 'QUORUM_MATCH',
    observationWindow: Object.freeze({ startUnix: windowStart, endUnix: windowEnd }),
    validUntilUnix,
    qualityStatus: 'VERIFIED',
    finalizedHeight: 0,
    conflictReason: null,
  });
}

export function informationConsensusCreatesMoney(): false {
  return false;
}
