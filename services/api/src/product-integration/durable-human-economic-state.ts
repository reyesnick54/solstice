import { err, ok, type Result } from '../../../../packages/domain/src/result.ts';
import type { UtcInstant } from '../../../../packages/domain/src/time.ts';
import { createHumanContributionEvent } from '../../../../packages/human-economic-contribution/src/event.ts';
import { registryRecordFromEvent } from '../../../../packages/human-economic-contribution/src/record.ts';
import { HumanContributionRegistry } from '../../../../packages/human-economic-contribution/src/registry.ts';
import {
  HumanContributionResolutionEngine,
  type HumanContributionResolutionSnapshot,
  type SubmitObservationInput,
} from '../../../../packages/human-economic-contribution/src/resolution/engine.ts';
import { evidenceObservationIdFor, monetizationKeyOf, observationReplayKey } from '../../../../packages/human-economic-contribution/src/resolution/ids.ts';
import type {
  EvidenceObservation,
  HumanEconomicClaim,
  MonetizationContextId,
  MonetizationLock,
  ResolutionFailure,
} from '../../../../packages/human-economic-contribution/src/resolution/types.ts';
import type {
  ContributionFailure,
  HumanContributionRegistryRecord,
  HumanContributionRegistrySnapshot,
  RecordContributionInput,
  VerifyContributionInput,
} from '../../../../packages/human-economic-contribution/src/types.ts';
import type { CanonicalEconomicClaim } from '../../../../packages/sunrey-chain/src/economics/proof-bound/types.ts';
import {
  deserializeClaimRegistry,
  emptyClaimRegistry,
  getClaim,
  markClaimMonetized,
  registerEconomicClaim,
  type ClaimRegistry,
} from '../../../../packages/sunrey-chain/src/economics/proof-bound/claims.ts';
import type { HumanEconomicPersistencePort } from '../../../accounts/src/human-economic-persistence.ts';

export class DurableStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DurableStoreUnavailableError';
  }
}

export type DurableHumanEconomicStateOptions = {
  readonly requireDurable?: boolean;
};

type SerializedClaimRegistry = {
  readonly claims: ReadonlyArray<readonly [string, CanonicalEconomicClaim]>;
  readonly fingerprints: ReadonlyArray<readonly [string, string]>;
  readonly monetizedClaimIds: ReadonlyArray<string>;
};

export type DurableHumanEconomicSnapshot = {
  readonly registry: HumanContributionRegistrySnapshot;
  readonly resolution: HumanContributionResolutionSnapshot;
  readonly proofBoundClaims: SerializedClaimRegistry;
};

function serializeProofBoundClaims(registry: ClaimRegistry): SerializedClaimRegistry {
  return Object.freeze({
    claims: [...registry.claims.entries()],
    fingerprints: [...registry.fingerprints.entries()],
    monetizedClaimIds: [...registry.monetizedClaimIds],
  });
}

function deserializeProofBoundClaims(raw: unknown): ClaimRegistry {
  if (typeof raw === 'string') {
    return deserializeClaimRegistry(raw);
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as Partial<SerializedClaimRegistry> & ClaimRegistry;
    if (candidate.claims instanceof Map) {
      return {
        claims: new Map(candidate.claims),
        fingerprints: new Map(candidate.fingerprints),
        monetizedClaimIds: new Set(candidate.monetizedClaimIds),
      };
    }
    return {
      claims: new Map(Array.isArray(candidate.claims) ? candidate.claims : []),
      fingerprints: new Map(Array.isArray(candidate.fingerprints) ? candidate.fingerprints : []),
      monetizedClaimIds: new Set(Array.isArray(candidate.monetizedClaimIds) ? candidate.monetizedClaimIds : []),
    };
  }
  return emptyClaimRegistry();
}

/**
 * Coordinates Human Contribution registry and resolution with PostgreSQL-backed
 * uniqueness gates injected through services/accounts.
 */
export class DurableHumanEconomicStateService {
  readonly registry: HumanContributionRegistry;
  readonly resolution: HumanContributionResolutionEngine;
  readonly proofBoundClaims: ClaimRegistry;
  private readonly persistence: HumanEconomicPersistencePort;
  private readonly requireDurable: boolean;

  private constructor(
    persistence: HumanEconomicPersistencePort,
    registry: HumanContributionRegistry,
    resolution: HumanContributionResolutionEngine,
    proofBoundClaims: ClaimRegistry,
    options: DurableHumanEconomicStateOptions,
  ) {
    this.persistence = persistence;
    this.registry = registry;
    this.resolution = resolution;
    this.proofBoundClaims = proofBoundClaims;
    this.requireDurable = options.requireDurable ?? true;
  }

  static async create(
    persistence: HumanEconomicPersistencePort,
    options: DurableHumanEconomicStateOptions = {},
  ): Promise<DurableHumanEconomicStateService> {
    const registry = new HumanContributionRegistry();
    const resolution = new HumanContributionResolutionEngine();
    const proofBoundClaims = emptyClaimRegistry();
    const service = new DurableHumanEconomicStateService(
      persistence,
      registry,
      resolution,
      proofBoundClaims,
      options,
    );
    await service.hydrate();
    return service;
  }

  async hydrate(): Promise<void> {
    const loaded = await this.persistence.load();
    if (!loaded) {
      return;
    }
    const snapshot = loaded as DurableHumanEconomicSnapshot;
    this.registry.restore(snapshot.registry);
    this.resolution.restore(snapshot.resolution);
    if (snapshot.proofBoundClaims) {
      this.hydrateProofBoundClaims(snapshot.proofBoundClaims);
    }
  }

  private hydrateProofBoundClaims(raw: unknown): void {
    const claims = deserializeProofBoundClaims(raw);
    for (const [, claim] of claims.claims) {
      registerEconomicClaim(this.proofBoundClaims, {
        economicClaimId: claim.economicClaimId,
        economicDomain: claim.economicDomain,
        contributionClass: claim.contributionClass,
        fingerprint: claim.fingerprint,
        subjectCommitment: '',
        registeredAtUtc: claim.registeredAtUtc,
        lifecycleState: claim.lifecycleState,
      });
      if (claims.monetizedClaimIds.has(claim.economicClaimId)) {
        markClaimMonetized(this.proofBoundClaims, claim.economicClaimId);
      }
    }
  }

  snapshot(): DurableHumanEconomicSnapshot {
    return Object.freeze({
      registry: this.registry.snapshot(),
      resolution: this.resolution.snapshot(),
      proofBoundClaims: serializeProofBoundClaims(this.proofBoundClaims),
    });
  }

  async persist(): Promise<void> {
    try {
      await this.persistence.persist(this.snapshot());
    } catch (error) {
      if (this.requireDurable) {
        throw new DurableStoreUnavailableError(
          `durable store persist failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      throw error;
    }
  }

  async restart(): Promise<DurableHumanEconomicStateService> {
    await this.persist();
    return DurableHumanEconomicStateService.create(this.persistence, { requireDurable: this.requireDurable });
  }

  async submitContribution(
    input: RecordContributionInput,
  ): Promise<Result<HumanContributionRegistryRecord, ContributionFailure>> {
    if (input.contributionId) {
      const existing = this.registry.getRecord(input.contributionId);
      if (existing) {
        return ok(existing);
      }
    }
    const created = createHumanContributionEvent(input);
    if (!created.ok) {
      return created;
    }
    const record = registryRecordFromEvent(created.value);
    const existing = this.registry.getRecord(record.contributionId);
    if (existing) {
      return ok(existing);
    }
    const reserved = await this.persistence.reserveActiveFingerprint(record.fingerprint, record.contributionId);
    if (!reserved.ok) {
      return err({
        code: 'DUPLICATE_FINGERPRINT',
        message: `active contribution fingerprint ${record.fingerprint} is already held in durable store`,
      });
    }
    const submitted = this.registry.submit(input);
    if (!submitted.ok) {
      await this.persistence.releaseActiveFingerprint(record.fingerprint);
      return submitted;
    }
    await this.persist();
    return submitted;
  }

  async submitObservation(
    input: SubmitObservationInput,
  ): Promise<Result<EvidenceObservation, ResolutionFailure>> {
    const replayKey = observationReplayKey(input.providerId, input.providerRecordId, input.contentCommitment);
    const observationId = input.observationId ?? evidenceObservationIdFor(replayKey);
    const reserved = await this.persistence.reserveObservationReplayKey(replayKey, observationId);
    if (!reserved.ok) {
      return err({ code: 'OBSERVATION_REPLAY', message: `provider record replay key ${replayKey} already consumed` });
    }
    const submitted = this.resolution.submitObservation(input);
    if (!submitted.ok) {
      await this.hydrate();
      return submitted;
    }
    await this.persist();
    return submitted;
  }

  async attemptMonetization(input: {
    readonly claimId: HumanEconomicClaim['claimId'];
    readonly contextId: MonetizationContextId;
    readonly now: UtcInstant;
  }): Promise<Result<MonetizationLock, ResolutionFailure>> {
    const claim = this.resolution.getClaim(input.claimId);
    if (!claim) {
      return err({ code: 'CLAIM_NOT_RESOLVED', message: `claim ${input.claimId} does not exist` });
    }
    const key = monetizationKeyOf(claim.resolutionFingerprint, input.contextId);
    const reserved = await this.persistence.reserveMonetizationKey(key, input.claimId);
    if (!reserved.ok) {
      return err({ code: 'DUPLICATE_MONETIZATION_KEY', message: `monetization key ${key} already consumed` });
    }
    const result = this.resolution.attemptMonetization(input);
    if (!result.ok) {
      await this.hydrate();
      return result;
    }
    await this.persist();
    return result;
  }

  async registerProofBoundClaim(input: {
    readonly economicClaimId: string;
    readonly economicDomain: 'HUMAN' | 'PRODUCTIVE';
    readonly contributionClass: string;
    readonly fingerprint: string;
    readonly subjectCommitment: string;
    readonly registeredAtUtc: string;
  }): Promise<{ readonly ok: true } | { readonly ok: false; readonly code: string }> {
    const existing = getClaim(this.proofBoundClaims, input.economicClaimId);
    if (existing) {
      return { ok: true };
    }
    const reserved = await this.persistence.reserveProofBoundClaimFingerprint(
      input.fingerprint,
      input.economicClaimId,
      JSON.stringify(input),
    );
    if (!reserved.ok) {
      return { ok: false, code: reserved.code };
    }
    const registered = registerEconomicClaim(this.proofBoundClaims, input);
    if (!registered.ok) {
      await this.hydrate();
      return { ok: false, code: registered.code };
    }
    await this.persist();
    return { ok: true };
  }

  async verifyContribution(
    input: VerifyContributionInput,
  ): Promise<Result<HumanContributionRegistryRecord, ContributionFailure>> {
    const current = this.registry.getRecord(input.contributionId);
    if (!current) {
      return err({ code: 'CONTRIBUTION_NOT_FOUND', message: `contribution ${input.contributionId} was not recorded` });
    }
    if (current.status === 'VERIFIED') {
      return ok(current);
    }
    const reserved = await this.persistence.reserveVerifiedFingerprint(current.fingerprint, current.contributionId);
    if (!reserved.ok) {
      return err({
        code: 'DUPLICATE_FINGERPRINT',
        message: `verified fingerprint ${current.fingerprint} is already held in durable store`,
      });
    }
    const verified = this.registry.verify(input);
    if (!verified.ok) {
      await this.hydrate();
      return verified;
    }
    await this.persist();
    return verified;
  }
}
