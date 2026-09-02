import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { buildResolutionCluster, generateHumanEconomicClaim } from './claim-generation.ts';
import { groupObservationsByCanonicalEvent, resolveCrossSourceObservations } from './cross-source.ts';
import { createCrossIdentityIndex, registerAuthoritativeIdentity, commitmentKindFromObservation } from './cross-identity.ts';
import { observationReplayKey, evidenceObservationIdFor } from './ids.ts';
import { HumanContributionMonetizationStore } from './monetization-lock.ts';
import { timestampAlterationSuspected } from './splitting.ts';
import { createEconomicIdentityRegistry, resolveEconomicIdentity } from './wallet.ts';
import type {
  CrossIdentityConflict,
  EvidenceObservation,
  HumanEconomicClaim,
  MonetizationContextId,
  MonetizationLock,
  ResolutionFailure,
  ResolutionCluster,
} from './types.ts';

function failure(code: ResolutionFailure['code'], message: string): ResolutionFailure {
  return Object.freeze({ code, message });
}

export type SubmitObservationInput = Omit<EvidenceObservation, 'observationId'> & {
  readonly observationId?: EvidenceObservation['observationId'];
};

export type HumanContributionResolutionSnapshot = {
  readonly observations: readonly EvidenceObservation[];
  readonly clusters: readonly ResolutionCluster[];
  readonly claims: readonly HumanEconomicClaim[];
  readonly conflicts: readonly CrossIdentityConflict[];
  readonly consumedMonetizationKeys: readonly string[];
};

/**
 * Wave 6 Human Contribution Resolution engine.
 *
 * MULTIPLE RECORDS OF ONE HUMAN CONTRIBUTION != MULTIPLE HUMAN CONTRIBUTIONS.
 */
export class HumanContributionResolutionEngine {
  private readonly observations = new Map<string, EvidenceObservation>();
  private readonly replayKeys = new Set<string>();
  private readonly authoritativeReplay = new Set<string>();
  private readonly clusters = new Map<string, ResolutionCluster>();
  private readonly claims = new Map<string, HumanEconomicClaim>();
  private readonly fingerprintToCluster = new Map<string, string>();
  private readonly conflicts: CrossIdentityConflict[] = [];
  private readonly crossIdentityIndex = createCrossIdentityIndex();
  readonly identityRegistry = createEconomicIdentityRegistry();
  readonly monetizationStore = new HumanContributionMonetizationStore();

  submitObservation(input: SubmitObservationInput): Result<EvidenceObservation, ResolutionFailure> {
    const replayKey = observationReplayKey(input.providerId, input.providerRecordId, input.contentCommitment);
    if (this.replayKeys.has(replayKey)) {
      return err(failure('OBSERVATION_REPLAY', `provider record ${input.providerRecordId} was already submitted`));
    }
    const observation: EvidenceObservation = Object.freeze({
      ...input,
      observationId: input.observationId ?? evidenceObservationIdFor(replayKey),
    });
    const identityConflicts = registerAuthoritativeIdentity(
      commitmentKindFromObservation(observation),
      observation.humanEconomicIdentityId,
      this.crossIdentityIndex,
      observation.observedAtUtc,
    );
    if (identityConflicts.length > 0) {
      this.conflicts.push(...identityConflicts);
      const top = identityConflicts[0]!;
      if (top.code === 'FRAUD_SUSPECTED') {
        return err(failure('FRAUD_SUSPECTED', `authoritative id claimed by multiple identities: ${top.authoritativeIdCommitment}`));
      }
      if (top.code === 'MANUAL_REVIEW_REQUIRED') {
        return err(failure('MANUAL_REVIEW_REQUIRED', `cross-identity claim requires manual review: ${top.authoritativeIdCommitment}`));
      }
      return err(failure('CROSS_IDENTITY_CONFLICT', `authoritative id conflict: ${top.authoritativeIdCommitment}`));
    }
    for (const tagged of commitmentKindFromObservation(observation)) {
      if (tagged.kind !== 'credential') {
        continue;
      }
      const globalReplay = `${tagged.kind}:${String(tagged.commitment)}`;
      if (this.authoritativeReplay.has(globalReplay)) {
        return err(failure('OBSERVATION_REPLAY', `authoritative ${tagged.kind} ${tagged.commitment} was already submitted`));
      }
    }
    for (const existing of this.observations.values()) {
      if (timestampAlterationSuspected(existing, observation)) {
        return err(failure('UNRESOLVED_DUPLICATE', 'timestamp alteration on identical contribution content detected'));
      }
    }
    this.replayKeys.add(replayKey);
    for (const tagged of commitmentKindFromObservation(observation)) {
      if (tagged.kind === 'credential') {
        this.authoritativeReplay.add(`${tagged.kind}:${String(tagged.commitment)}`);
      }
    }
    this.observations.set(observation.observationId, observation);
    return ok(observation);
  }

  resolveAll(): readonly ResolutionCluster[] {
    const groups = groupObservationsByCanonicalEvent([...this.observations.values()]);
    const resolved: ResolutionCluster[] = [];
    for (const group of groups) {
      const result = resolveCrossSourceObservations(group);
      const existingClusterId = this.fingerprintToCluster.get(result.canonicalEvent.resolutionFingerprint);
      if (existingClusterId) {
        const existing = this.clusters.get(existingClusterId);
        if (existing) {
          const merged = buildResolutionCluster({
            canonicalEvent: result.canonicalEvent,
            observationIds: [...new Set([...existing.observationIds, ...result.observationIds])],
            sourceClasses: [...new Set([...existing.sourceClasses, ...result.sourceClasses])],
            resolutionStatus: result.resolutionStatus === 'RESOLVED' ? 'RESOLVED' : existing.resolutionStatus,
            claimId: existing.claimId,
          });
          this.clusters.set(merged.clusterId, merged);
          this.fingerprintToCluster.set(merged.resolutionFingerprint, merged.clusterId);
          resolved.push(merged);
          continue;
        }
      }
      const cluster = buildResolutionCluster({
        canonicalEvent: result.canonicalEvent,
        observationIds: result.observationIds,
        sourceClasses: result.sourceClasses,
        resolutionStatus: result.resolutionStatus,
      });
      this.clusters.set(cluster.clusterId, cluster);
      this.fingerprintToCluster.set(cluster.resolutionFingerprint, cluster.clusterId);
      resolved.push(cluster);
    }
    return Object.freeze(resolved);
  }

  generateClaimForCluster(clusterId: string, createdAtUtc: UtcInstant, forcePendingCorroboration = false): Result<HumanEconomicClaim, ResolutionFailure> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return err(failure('CLUSTER_NOT_FOUND', `cluster ${clusterId} was not resolved`));
    }
    const observations = cluster.observationIds
      .map((id) => this.observations.get(id))
      .filter((observation): observation is EvidenceObservation => observation !== undefined);
    if (observations.length === 0) {
      return err(failure('CLUSTER_NOT_FOUND', `cluster ${clusterId} has no observations`));
    }
    const resolved = resolveCrossSourceObservations(observations);
    const generated = generateHumanEconomicClaim({
      canonicalEvent: resolved.canonicalEvent,
      cluster,
      createdAtUtc,
      forcePendingCorroboration,
    });
    if (!generated.ok) {
      return generated;
    }
    if (this.claims.has(generated.value.claimId)) {
      return err(failure('CLAIM_ALREADY_EXISTS', `claim ${generated.value.claimId} already exists`));
    }
    this.claims.set(generated.value.claimId, generated.value);
    const updatedCluster = buildResolutionCluster({
      canonicalEvent: resolved.canonicalEvent,
      observationIds: cluster.observationIds,
      sourceClasses: cluster.sourceClasses,
      resolutionStatus: cluster.resolutionStatus,
      claimId: generated.value.claimId,
    });
    this.clusters.set(updatedCluster.clusterId, updatedCluster);
    return ok(generated.value);
  }

  attemptMonetization(input: {
    readonly claimId: HumanEconomicClaim['claimId'];
    readonly contextId: MonetizationContextId;
    readonly now: UtcInstant;
  }): Result<MonetizationLock, ResolutionFailure> {
    const claim = this.claims.get(input.claimId);
    if (!claim) {
      return err(failure('CLAIM_NOT_RESOLVED', `claim ${input.claimId} does not exist`));
    }
    const currentLock = this.monetizationStore.getLock(input.claimId);
    if (currentLock.status === 'CONSUMED') {
      return err(failure('ALREADY_CONSUMED', 'Claim already crossed monetary boundary'));
    }
    if (this.monetizationStore.isConsumed(claim.resolutionFingerprint, input.contextId)) {
      return err(failure('DUPLICATE_MONETIZATION_KEY', 'monetization key already consumed'));
    }
    const proposed = this.monetizationStore.propose(input.claimId, input.contextId, input.now);
    if (!proposed.ok) {
      return err(failure(proposed.code as ResolutionFailure['code'], proposed.message));
    }
    const authorized = this.monetizationStore.authorize(input.claimId, input.contextId, input.now);
    if (!authorized.ok) {
      return err(failure(authorized.code as ResolutionFailure['code'], authorized.message));
    }
    const consumed = this.monetizationStore.consume({
      claimId: input.claimId,
      resolutionFingerprint: claim.resolutionFingerprint,
      contextId: input.contextId,
      now: input.now,
    });
    if (!consumed.ok) {
      return err(failure(consumed.code as ResolutionFailure['code'], consumed.message));
    }
    return ok(consumed.lock);
  }

  bindWalletAndSubmit(input: {
    readonly walletCommitment: string;
    readonly actorCommitment: string;
    readonly jurisdiction?: string;
    readonly observation: Omit<SubmitObservationInput, 'humanEconomicIdentityId' | 'walletBindingRef'>;
  }): Result<EvidenceObservation, ResolutionFailure> {
    const identity = resolveEconomicIdentity({
      walletCommitment: input.walletCommitment,
      actorCommitment: input.actorCommitment,
      jurisdiction: input.jurisdiction,
      registry: this.identityRegistry,
    });
    return this.submitObservation({
      ...input.observation,
      humanEconomicIdentityId: identity.humanEconomicIdentityId,
      walletBindingRef: identity.walletBindingRef,
    });
  }

  getClaim(claimId: string): HumanEconomicClaim | undefined {
    return this.claims.get(claimId);
  }

  getCluster(clusterId: string): ResolutionCluster | undefined {
    return this.clusters.get(clusterId);
  }

  listConflicts(): readonly CrossIdentityConflict[] {
    return Object.freeze([...this.conflicts]);
  }

  snapshot(): HumanContributionResolutionSnapshot {
    return Object.freeze({
      observations: Object.freeze([...this.observations.values()]),
      clusters: Object.freeze([...this.clusters.values()]),
      claims: Object.freeze([...this.claims.values()]),
      conflicts: Object.freeze([...this.conflicts]),
      consumedMonetizationKeys: Object.freeze(this.monetizationStore.listConsumedKeys()),
    });
  }
}
