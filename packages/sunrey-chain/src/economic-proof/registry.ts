import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { deriveClaimFingerprint } from './claim-fingerprint.ts';
import { buildDuplicateCluster, deriveDuplicateClusterId, mergeClusterObservations } from './duplicate-cluster.ts';
import { deriveCanonicalEntityId } from './entity-identity.ts';
import { deriveCanonicalEventId } from './event-identity.ts';
import { buildLineageRecord } from './lineage.ts';
import {
  authorizeMonetization,
  consumeMonetization,
  deriveConsumptionCommitment,
  emptyMonetizationLock,
  initialChallengeState,
  markChallenged,
  openChallenge,
  proposeMonetization,
  rejectMonetization,
  resolveChallenge,
} from './monetization-lock.ts';
import { deriveObservationFingerprint } from './observation-fingerprint.ts';
import type {
  CanonicalEntityMaterial,
  CanonicalEventMaterial,
  ChallengeState,
  ClaimFingerprint,
  DuplicateCluster,
  EconomicClaim,
  EconomicClaimId,
  EconomicObservation,
  EconomicObservationId,
  EntityAliasResolver,
  LineageEdge,
  MonetizationContextId,
  MonetizationLock,
  MonetizationPolicy,
} from './types.ts';
import { DEFAULT_MONETIZATION_POLICY, ECONOMIC_PROOF_SCHEMA_VERSION } from './types.ts';

export type RegistryFailure = {
  readonly code:
    | 'OBSERVATION_REPLAY'
    | 'CLAIM_ALREADY_EXISTS'
    | 'CLUSTER_ALREADY_MONETIZED'
    | 'CLAIM_NOT_FOUND'
    | 'OBSERVATION_NOT_FOUND'
    | 'LINEAGE_INVALID'
    | 'MONETIZATION_BLOCKED'
    | 'ALREADY_CONSUMED'
    | 'INVALID_CHALLENGE_TRANSITION';
  readonly message: string;
};

function failure(code: RegistryFailure['code'], message: string): RegistryFailure {
  return Object.freeze({ code, message });
}

function asClaimId(value: string): EconomicClaimId {
  return value as EconomicClaimId;
}

function asObservationId(value: string): EconomicObservationId {
  return value as EconomicObservationId;
}

export type RegisterObservationInput = {
  readonly observationId: string;
  readonly economy: EconomicObservation['economy'];
  readonly providerId: string;
  readonly sourceClass: string;
  readonly providerRecordId: string;
  readonly payloadDigest: string;
  readonly observedAtUtc: string;
  readonly entityMaterial: CanonicalEntityMaterial;
  readonly eventMaterial: Omit<CanonicalEventMaterial, 'canonicalEntityId'>;
  readonly aliasResolver?: EntityAliasResolver;
};

export type RegisterClaimInput = {
  readonly claimId: string;
  readonly economy: EconomicClaim['economy'];
  readonly entityMaterial: CanonicalEntityMaterial;
  readonly eventMaterial: Omit<CanonicalEventMaterial, 'canonicalEntityId'>;
  readonly economicAction: string;
  readonly validFromUtc: string;
  readonly validUntilUtc: string | null;
  readonly jurisdictionCommitment?: string;
  readonly categoryCommitment?: string;
  readonly observationIds: readonly string[];
  readonly lineageEdges: readonly LineageEdge[];
  readonly methodologyVersion: string;
  readonly producedRefs?: readonly string[];
};

export type EconomicClaimRegistrySnapshot = {
  readonly observations: readonly EconomicObservation[];
  readonly claims: readonly EconomicClaim[];
  readonly clusters: readonly DuplicateCluster[];
  readonly consumptionCommitments: readonly string[];
};

export class EconomicClaimRegistry {
  readonly #observations = new Map<EconomicObservationId, EconomicObservation>();
  readonly #observationFingerprints = new Map<string, EconomicObservationId>();
  readonly #claims = new Map<EconomicClaimId, EconomicClaim>();
  readonly #claimFingerprints = new Map<ClaimFingerprint, EconomicClaimId>();
  readonly #clusters = new Map<string, DuplicateCluster>();
  readonly #consumptionCommitments = new Set<string>();
  readonly #policy: MonetizationPolicy;
  readonly #aliasResolver?: EntityAliasResolver;

  constructor(options?: { readonly policy?: MonetizationPolicy; readonly aliasResolver?: EntityAliasResolver }) {
    this.#policy = options?.policy ?? DEFAULT_MONETIZATION_POLICY;
    this.#aliasResolver = options?.aliasResolver;
  }

  snapshot(): EconomicClaimRegistrySnapshot {
    return Object.freeze({
      observations: Object.freeze([...this.#observations.values()]),
      claims: Object.freeze([...this.#claims.values()]),
      clusters: Object.freeze([...this.#clusters.values()]),
      consumptionCommitments: Object.freeze([...this.#consumptionCommitments]),
    });
  }

  getObservation(observationId: string): EconomicObservation | undefined {
    return this.#observations.get(asObservationId(observationId));
  }

  getClaim(claimId: string): EconomicClaim | undefined {
    return this.#claims.get(asClaimId(claimId));
  }

  getClaimByFingerprint(fingerprint: ClaimFingerprint): EconomicClaim | undefined {
    const claimId = this.#claimFingerprints.get(fingerprint);
    return claimId ? this.#claims.get(claimId) : undefined;
  }

  getClusterForEvent(canonicalEventId: string): DuplicateCluster | undefined {
    return this.#clusters.get(deriveDuplicateClusterId(canonicalEventId as DuplicateCluster['canonicalEventId']));
  }

  registerObservation(input: RegisterObservationInput): Result<EconomicObservation, RegistryFailure> {
    const canonicalEntityId = deriveCanonicalEntityId(input.entityMaterial);
    const canonicalEventId = deriveCanonicalEventId({
      ...input.eventMaterial,
      canonicalEntityId,
    });
    const observationFingerprint = deriveObservationFingerprint({
      providerId: input.providerId,
      sourceClass: input.sourceClass,
      providerRecordId: input.providerRecordId,
      payloadDigest: input.payloadDigest,
      observedAtUtc: input.observedAtUtc,
    });

    const existingId = this.#observationFingerprints.get(observationFingerprint);
    if (existingId) {
      return err({
        code: 'OBSERVATION_REPLAY',
        message: `Observation replay detected: ${existingId}`,
      });
    }

    const observation: EconomicObservation = Object.freeze({
      schemaVersion: ECONOMIC_PROOF_SCHEMA_VERSION,
      observationId: asObservationId(input.observationId),
      economy: input.economy,
      providerId: input.providerId,
      sourceClass: input.sourceClass,
      providerRecordId: input.providerRecordId,
      observationFingerprint,
      payloadDigest: input.payloadDigest,
      observedAtUtc: input.observedAtUtc,
      canonicalEntityId,
      canonicalEventId,
    });

    this.#observations.set(observation.observationId, observation);
    this.#observationFingerprints.set(observationFingerprint, observation.observationId);

    const clusterId = deriveDuplicateClusterId(canonicalEventId);
    const existingCluster = this.#clusters.get(clusterId);
    if (existingCluster) {
      this.#clusters.set(clusterId, mergeClusterObservations(existingCluster, [observation]));
    } else {
      this.#clusters.set(clusterId, buildDuplicateCluster({
        canonicalEventId,
        economy: input.economy,
        observations: [observation],
        claimId: undefined,
      }));
    }

    return ok(observation);
  }

  registerClaim(input: RegisterClaimInput): Result<EconomicClaim, RegistryFailure> {
    const canonicalEntityId = deriveCanonicalEntityId(input.entityMaterial);
    const canonicalEventId = deriveCanonicalEventId({
      ...input.eventMaterial,
      canonicalEntityId,
    });
    const claimFingerprint = deriveClaimFingerprint({
      economy: input.economy,
      canonicalEntityId,
      canonicalEventId,
      economicAction: input.economicAction,
      quantity: input.eventMaterial.quantity,
      unit: input.eventMaterial.unit,
      validFromUtc: input.validFromUtc,
      validUntilUtc: input.validUntilUtc,
      jurisdictionCommitment: input.jurisdictionCommitment,
      categoryCommitment: input.categoryCommitment,
    });

    if (this.#claimFingerprints.has(claimFingerprint)) {
      return err({
        code: 'CLAIM_ALREADY_EXISTS',
        message: `Claim fingerprint already registered: ${claimFingerprint}`,
      });
    }

    const clusterId = deriveDuplicateClusterId(canonicalEventId);
    const cluster = this.#clusters.get(clusterId);
    if (cluster?.claimId) {
      return err({
        code: 'CLUSTER_ALREADY_MONETIZED',
        message: `Cluster already has claim ${cluster.claimId}`,
      });
    }

    const observations: EconomicObservation[] = [];
    for (const observationId of input.observationIds) {
      const observation = this.#observations.get(asObservationId(observationId));
      if (!observation) {
        return err({ code: 'OBSERVATION_NOT_FOUND', message: `Missing observation ${observationId}` });
      }
      observations.push(observation);
    }

    const lineageResult = buildLineageRecord({
      edges: [
        ...input.lineageEdges,
        ...observations.map((observation) =>
          Object.freeze({
            kind: 'OBSERVED_FROM' as const,
            parentRef: observation.observationId,
            childRef: input.claimId,
            methodologyVersion: input.methodologyVersion,
          }),
        ),
      ],
      methodologyVersion: input.methodologyVersion,
      producedRefs: input.producedRefs,
    });
    if (!lineageResult.ok) {
      return err({ code: 'LINEAGE_INVALID', message: lineageResult.error.message });
    }

    const now = asUtcInstant(new Date().toISOString());
    const claim: EconomicClaim = Object.freeze({
      schemaVersion: ECONOMIC_PROOF_SCHEMA_VERSION,
      claimId: asClaimId(input.claimId),
      economy: input.economy,
      canonicalEntityId,
      canonicalEventId,
      claimFingerprint,
      duplicateClusterId: clusterId,
      observationIds: Object.freeze([...input.observationIds] as EconomicObservationId[]),
      sourceClasses: Object.freeze([...new Set(observations.map((o) => o.sourceClass))].sort()),
      lineage: lineageResult.value,
      monetizationLock: emptyMonetizationLock(now),
      challengeState: initialChallengeState(),
      economicAction: input.economicAction,
      quantity: input.eventMaterial.quantity,
      unit: input.eventMaterial.unit,
    });

    this.#claims.set(claim.claimId, claim);
    this.#claimFingerprints.set(claimFingerprint, claim.claimId);

    const updatedCluster = buildDuplicateCluster({
      canonicalEventId,
      economy: input.economy,
      observations,
      claimId: claim.claimId,
    });
    this.#clusters.set(clusterId, updatedCluster);

    return ok(claim);
  }

  addObservationToClaim(
    claimId: string,
    observationId: string,
  ): Result<EconomicClaim, RegistryFailure> {
    const claim = this.#claims.get(asClaimId(claimId));
    if (!claim) {
      return err({ code: 'CLAIM_NOT_FOUND', message: `Claim not found: ${claimId}` });
    }
    const observation = this.#observations.get(asObservationId(observationId));
    if (!observation) {
      return err({ code: 'OBSERVATION_NOT_FOUND', message: `Observation not found: ${observationId}` });
    }
    if (observation.canonicalEventId !== claim.canonicalEventId) {
      return err({
        code: 'LINEAGE_INVALID',
        message: 'Observation canonical event does not match claim',
      });
    }

    const observationIds = Object.freeze(
      [...new Set([...claim.observationIds, observation.observationId])].sort(),
    ) as readonly EconomicObservationId[];
    const sourceClasses = Object.freeze(
      [...new Set([...claim.sourceClasses, observation.sourceClass])].sort(),
    );

    const lineageResult = buildLineageRecord({
      edges: [
        ...claim.lineage.edges,
        Object.freeze({
          kind: 'OBSERVED_FROM' as const,
          parentRef: observation.observationId,
          childRef: claim.claimId,
          methodologyVersion: claim.lineage.methodologyVersion,
        }),
      ],
      methodologyVersion: claim.lineage.methodologyVersion,
      producedRefs: claim.lineage.producedRefs,
    });
    if (!lineageResult.ok) {
      return err({ code: 'LINEAGE_INVALID', message: lineageResult.error.message });
    }

    const updated: EconomicClaim = Object.freeze({
      ...claim,
      observationIds,
      sourceClasses,
      lineage: lineageResult.value,
    });
    this.#claims.set(updated.claimId, updated);

    const cluster = this.#clusters.get(claim.duplicateClusterId);
    if (cluster) {
      this.#clusters.set(claim.duplicateClusterId, Object.freeze({
        ...cluster,
        observationIds,
        sourceClasses,
      }));
    }

    return ok(updated);
  }

  proposeMonetization(claimId: string, contextId: MonetizationContextId): Result<EconomicClaim, RegistryFailure> {
    return this.#transitionMonetization(claimId, (claim, lock) =>
      proposeMonetization(lock, contextId, claim.challengeState, this.#policy, asUtcInstant(new Date().toISOString())),
    );
  }

  authorizeMonetization(claimId: string, contextId: MonetizationContextId): Result<EconomicClaim, RegistryFailure> {
    return this.#transitionMonetization(claimId, (claim, lock) =>
      authorizeMonetization(lock, contextId, claim.challengeState, this.#policy, asUtcInstant(new Date().toISOString())),
    );
  }

  consumeMonetization(input: {
    readonly claimId: string;
    readonly contextId: MonetizationContextId;
    readonly replayKey: string;
  }): Result<EconomicClaim, RegistryFailure> {
    const claim = this.#claims.get(asClaimId(input.claimId));
    if (!claim) {
      return err({ code: 'CLAIM_NOT_FOUND', message: `Claim not found: ${input.claimId}` });
    }

    const commitment = deriveConsumptionCommitment({
      claimFingerprint: claim.claimFingerprint,
      contextId: input.contextId,
      replayKey: input.replayKey,
    });
    if (this.#consumptionCommitments.has(commitment)) {
      return err({ code: 'ALREADY_CONSUMED', message: 'Consumption commitment already recorded' });
    }

    const result = consumeMonetization({
      lock: claim.monetizationLock,
      claimFingerprint: claim.claimFingerprint,
      contextId: input.contextId,
      replayKey: input.replayKey,
      challenge: claim.challengeState,
      policy: this.#policy,
    });
    if (!result.ok) {
      return err({ code: 'MONETIZATION_BLOCKED', message: result.message });
    }

    this.#consumptionCommitments.add(commitment);
    const updated: EconomicClaim = Object.freeze({
      ...claim,
      monetizationLock: result.lock,
    });
    this.#claims.set(updated.claimId, updated);
    return ok(updated);
  }

  openChallenge(claimId: string, reason: string, material = false): Result<EconomicClaim, RegistryFailure> {
    const claim = this.#claims.get(asClaimId(claimId));
    if (!claim) {
      return err({ code: 'CLAIM_NOT_FOUND', message: `Claim not found: ${claimId}` });
    }
    if (claim.challengeState.status !== 'NONE' && claim.challengeState.status !== 'RESOLVED_INVALIDATED') {
      return err({ code: 'INVALID_CHALLENGE_TRANSITION', message: 'Challenge already open' });
    }
    const now = asUtcInstant(new Date().toISOString());
    const updated: EconomicClaim = Object.freeze({
      ...claim,
      challengeState: openChallenge(claim.challengeState, reason, now, material),
      monetizationLock: markChallenged(claim.monetizationLock, now),
    });
    this.#claims.set(updated.claimId, updated);
    return ok(updated);
  }

  resolveChallenge(claimId: string, upheld: boolean): Result<EconomicClaim, RegistryFailure> {
    const claim = this.#claims.get(asClaimId(claimId));
    if (!claim) {
      return err({ code: 'CLAIM_NOT_FOUND', message: `Claim not found: ${claimId}` });
    }
    const now = asUtcInstant(new Date().toISOString());
    const updated: EconomicClaim = Object.freeze({
      ...claim,
      challengeState: resolveChallenge(claim.challengeState, upheld, now),
      monetizationLock: upheld ? rejectMonetization(claim.monetizationLock, now) : claim.monetizationLock,
    });
    this.#claims.set(updated.claimId, updated);
    return ok(updated);
  }

  totalClusterQuantity(canonicalEventId: string): bigint {
    const cluster = this.getClusterForEvent(canonicalEventId);
    if (!cluster?.claimId) {
      return 0n;
    }
    const claim = this.#claims.get(cluster.claimId);
    return claim?.quantity ?? 0n;
  }

  #transitionMonetization(
    claimId: string,
    transition: (claim: EconomicClaim, lock: MonetizationLock) => ReturnType<typeof proposeMonetization>,
  ): Result<EconomicClaim, RegistryFailure> {
    const claim = this.#claims.get(asClaimId(claimId));
    if (!claim) {
      return err({ code: 'CLAIM_NOT_FOUND', message: `Claim not found: ${claimId}` });
    }
    const result = transition(claim, claim.monetizationLock);
    if (!result.ok) {
      return err({ code: 'MONETIZATION_BLOCKED', message: result.message });
    }
    const updated: EconomicClaim = Object.freeze({
      ...claim,
      monetizationLock: result.lock,
    });
    this.#claims.set(updated.claimId, updated);
    return ok(updated);
  }
}
