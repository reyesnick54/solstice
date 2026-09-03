import { deriveCanonicalEventId } from '../../../sunrey-chain/src/economic-proof/event-identity.ts';
import { deriveObservationFingerprint } from '../../../sunrey-chain/src/economic-proof/observation-fingerprint.ts';
import { buildDuplicateCluster } from '../../../sunrey-chain/src/economic-proof/duplicate-cluster.ts';
import type { EconomicObservation } from '../../../sunrey-chain/src/economic-proof/types.ts';
import { multipleResponsesAreNotConsensus } from '../authority/fail-closed.ts';

export type CorroborationInput = {
  readonly observations: readonly EconomicObservation[];
  readonly quorumRequired: number;
};

export type CorroborationResult =
  | {
      readonly status: 'corroborated';
      readonly clusterId: string;
      readonly observationFingerprints: readonly string[];
      readonly corroborationCount: number;
    }
  | { readonly status: 'insufficient'; readonly corroborationCount: number; readonly quorumRequired: number }
  | { readonly status: 'conflict'; readonly conflictingFingerprints: readonly string[] };

export function corroborateObservations(input: CorroborationInput): CorroborationResult {
  const fingerprints = input.observations.map((o) =>
    deriveObservationFingerprint({
      providerId: o.providerId,
      sourceClass: o.sourceClass,
      providerRecordId: o.observationId,
      payloadDigest: o.provenanceRef.provenanceId,
      observedAtUtc: o.observedAtUtc,
    }),
  );
  const unique = [...new Set(fingerprints)];

  if (unique.length > 1 && input.observations.length > 1) {
    const quantities = new Set(input.observations.map((o) => o.quantity.value.toString()));
    if (quantities.size > 1) {
      return { status: 'conflict', conflictingFingerprints: Object.freeze(unique) };
    }
  }

  const consensus = multipleResponsesAreNotConsensus(input.observations.length, input.quorumRequired);
  if (!consensus.ok) {
    return {
      status: 'insufficient',
      corroborationCount: input.observations.length,
      quorumRequired: input.quorumRequired,
    };
  }

  const first = input.observations[0]!;
  const canonicalEventId = deriveCanonicalEventId({
    canonicalEntityId: first.subjectRef as never,
    economicAction: first.metric,
    quantity: first.quantity.value,
    unit: first.quantity.unit,
    validFromUtc: first.observedAtUtc as never,
    validUntilUtc: first.receivedAtUtc as never,
    domainIdentifierCommitment: `${first.providerId}:${first.sourceClass}`,
  });

  const cluster = buildDuplicateCluster({
    canonicalEventId,
    economy: first.economicDomain === 'HUMAN_ECONOMIC' ? 'HUMAN' : 'PRODUCTIVE',
    observations: input.observations as never,
  });

  return Object.freeze({
    status: 'corroborated',
    clusterId: cluster.clusterId,
    observationFingerprints: Object.freeze(fingerprints),
    corroborationCount: input.observations.length,
  });
}
