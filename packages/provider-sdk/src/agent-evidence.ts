/**
 * Financial Agent evidence compatibility.
 *
 * ExternalObservation → Agent Evidence → recommendation → approval → Execution Authority
 * ExternalObservation must never imply Execution Authority or trade execution.
 */

import type { ExternalObservation } from './types.ts';
import { provenanceDigestMaterial } from './provenance.ts';

export const EXTERNAL_OBSERVATION_EVIDENCE_KIND = 'external.observation.reference' as const;

export type ExternalObservationEvidenceRef = {
  readonly kind: typeof EXTERNAL_OBSERVATION_EVIDENCE_KIND;
  readonly observationId: string;
  readonly providerId: string;
  readonly capability: string;
  readonly dataset: string;
  readonly authorityClass: ExternalObservation<unknown>['authority']['authorityClass'];
  readonly rawPayloadHash: string;
  readonly provenanceDigest: string;
  readonly freshnessStatus: ExternalObservation<unknown>['quality']['freshnessStatus'];
  readonly confidenceScore: number | null;
  readonly retrievedAt: string;
  readonly sourceTimestamp: string | null;
  /** Evidence reference only — never execution authority. */
  readonly grantsExecutionAuthority: false;
  /** Provider data is not a trade instruction. */
  readonly treatedAsTradeInstruction: false;
};

export function toAgentEvidenceRef<T>(observation: ExternalObservation<T>): ExternalObservationEvidenceRef {
  return Object.freeze({
    kind: EXTERNAL_OBSERVATION_EVIDENCE_KIND,
    observationId: observation.observationId,
    providerId: observation.providerId,
    capability: observation.capability,
    dataset: observation.source.dataset,
    authorityClass: observation.authority.authorityClass,
    rawPayloadHash: observation.provenance.rawPayloadHash,
    provenanceDigest: provenanceDigestMaterial(observation.provenance),
    freshnessStatus: observation.quality.freshnessStatus,
    confidenceScore: observation.quality.confidence.score,
    retrievedAt: observation.time.retrievedAt,
    sourceTimestamp: observation.time.sourceTimestamp,
    grantsExecutionAuthority: false,
    treatedAsTradeInstruction: false,
  });
}

export type AgentEvidenceBundle = {
  readonly refs: readonly ExternalObservationEvidenceRef[];
  readonly grantsExecutionAuthority: false;
};

export function bundleObservationEvidence(
  observations: readonly ExternalObservation<unknown>[],
): AgentEvidenceBundle {
  return Object.freeze({
    refs: Object.freeze(observations.map((observation) => toAgentEvidenceRef(observation))),
    grantsExecutionAuthority: false,
  });
}
