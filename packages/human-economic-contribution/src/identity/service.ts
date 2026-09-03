import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SubjectRef } from '../ids.ts';
import { assuranceFromProviderSignals } from './assurance.ts';
import { humanEconomicIdentityCommitment } from './commitments.ts';
import type { HumanEconomicIdentityId } from './ids.ts';
import { humanEconomicIdentityIdFor } from './ids.ts';
import {
  buildIdentityControllerLink,
  controllersForHumanActor,
  humanActorForController,
  validateLinkPurposes,
} from './linking.ts';
import { beginIdentityRecovery, completeIdentityRecovery } from './recovery.ts';
import {
  createRevocationRecord,
  futureActionsBlocked,
  isIdentityOperational,
  markRecoveredStatus,
} from './revocation.ts';
import { evaluateSybilControls } from './sybil.ts';
import { HumanEconomicIdentityStore } from './store.ts';
import { buildUniquenessProofReceipt, createUniquenessProofBoundary } from './uniqueness.ts';
import type {
  BeginIdentityRecoveryInput,
  CompleteIdentityRecoveryInput,
  IdentityFactsForContribution,
  IdentityFailure,
  LinkIdentityControllerInput,
  RecordUniquenessProofInput,
  RegisterHumanEconomicIdentityInput,
  SybilEvaluationResult,
} from './types.ts';

function fail<T>(code: string, message: string): Result<T, IdentityFailure> {
  return err({ code, message });
}

export class HumanEconomicIdentityService {
  readonly store: HumanEconomicIdentityStore;
  private readonly uniquenessBoundary: ReturnType<typeof createUniquenessProofBoundary>;

  constructor(store?: HumanEconomicIdentityStore) {
    this.store = store ?? new HumanEconomicIdentityStore();
    this.uniquenessBoundary = createUniquenessProofBoundary({
      proofs: this.store.uniquenessProofs,
      commitmentIndex: this.store.uniquenessCommitmentIndex,
    });
  }

  snapshot() {
    return this.store.snapshot();
  }

  hydrate(snapshot: ReturnType<HumanEconomicIdentityStore['snapshot']>): void {
    this.store.hydrate(snapshot);
  }

  registerIdentity(input: RegisterHumanEconomicIdentityInput): Result<import('./types.ts').HumanEconomicIdentity, IdentityFailure> {
    const humanActorId = input.humanActorId ?? humanEconomicIdentityIdFor(input.pseudonymousSubjectRef);
    if (this.store.identities.has(humanActorId)) {
      return fail('IDENTITY_ALREADY_EXISTS', 'human economic identity already registered');
    }
    const identity = Object.freeze({
      schemaVersion: 1 as const,
      humanActorId,
      pseudonymousSubjectRef: input.pseudonymousSubjectRef,
      assuranceLevel: input.assuranceLevel ?? 'UNVERIFIED',
      status: 'ACTIVE' as const,
      jurisdiction: input.jurisdiction,
      identityProviderRefs: Object.freeze([...(input.identityProviderRefs ?? [])]),
      credentialCommitments: Object.freeze([...(input.credentialCommitments ?? [])]),
      uniquenessProofRef: null,
      activeRevocationRef: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      version: 1,
    });
    this.store.identities.set(humanActorId, identity);
    return ok(identity);
  }

  linkController(input: LinkIdentityControllerInput): Result<import('./types.ts').IdentityControllerLink, IdentityFailure> {
    const identity = this.store.identities.get(input.humanActorId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'human economic identity not found');
    }
    if (!isIdentityOperational(identity.status)) {
      return fail('IDENTITY_NOT_OPERATIONAL', 'identity is not operational for linking');
    }
    const purposes = validateLinkPurposes(input.purposes);
    if (!purposes.ok) {
      return purposes;
    }
    const link = buildIdentityControllerLink(input);
    this.store.links.set(link.linkId, link);
    return ok(link);
  }

  recordUniquenessProof(input: RecordUniquenessProofInput): Result<import('./types.ts').UniquenessProofReceipt, IdentityFailure> {
    const identity = this.store.identities.get(input.humanActorId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'human economic identity not found');
    }
    const existingByCommitment = new Map(
      [...this.store.uniquenessProofs.values()].map((proof) => [proof.providerUniquenessCommitment, proof]),
    );
    const recorded = this.uniquenessBoundary.recordProof(input, existingByCommitment);
    if (!recorded.ok) {
      return recorded;
    }
    const updated = Object.freeze({
      ...identity,
      assuranceLevel: assuranceFromProviderSignals({
        accountVerified: identity.assuranceLevel !== 'UNVERIFIED',
        credentialVerified: true,
        identityVerified: true,
        highAssuranceStepUp: false,
      }),
      uniquenessProofRef: recorded.value.proofId,
      updatedAt: input.establishedAt,
      version: identity.version + 1,
    });
    this.store.identities.set(identity.humanActorId, updated);
    return ok(recorded.value);
  }

  evaluateSybil(humanActorId: HumanEconomicIdentityId, now: UtcInstant): SybilEvaluationResult {
    const identity = this.store.identities.get(humanActorId);
    const links = controllersForHumanActor([...this.store.links.values()], humanActorId, now);
    const uniquenessProof = identity?.uniquenessProofRef
      ? this.store.uniquenessProofs.get(identity.uniquenessProofRef)
      : null;

    const existingUniquenessOwners = new Map<string, HumanEconomicIdentityId>();
    const existingExternalOwners = new Map<string, HumanEconomicIdentityId>();
    const existingCredentialOwners = new Map<string, HumanEconomicIdentityId>();
    for (const proof of this.store.uniquenessProofs.values()) {
      existingUniquenessOwners.set(proof.providerUniquenessCommitment, proof.humanActorId);
    }
    for (const item of this.store.identities.values()) {
      for (const credential of item.credentialCommitments) {
        existingCredentialOwners.set(credential, item.humanActorId);
      }
    }

    const result = evaluateSybilControls({
      humanActorId,
      evaluatedAt: now,
      uniquenessCommitment: uniquenessProof?.providerUniquenessCommitment ?? null,
      controllerRefs: links.map((link) => link.controllerRef),
      contributionFingerprints: [],
      usageReceiptRefs: [],
      externalIdentityCommitments: [],
      credentialCommitments: identity?.credentialCommitments ?? [],
      relatedActorIds: [],
      deviceAbuseSignals: [],
      aiPatternSuggestions: [],
      existingUniquenessOwners,
      existingExternalOwners,
      existingCredentialOwners,
      existingReceiptOwners: new Map(),
      duplicateFingerprintOwners: new Map(),
    });
    this.store.sybilSignals.push(...result.signals);
    return result;
  }

  beginRecovery(input: BeginIdentityRecoveryInput): Result<import('./types.ts').IdentityRecoverySession, IdentityFailure> {
    const identity = this.store.identities.get(input.humanActorId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'human economic identity not found');
    }
    const session = beginIdentityRecovery(input);
    this.store.recoveries.set(session.recoveryId, session);
    return ok(session);
  }

  completeRecovery(input: CompleteIdentityRecoveryInput): Result<import('./types.ts').IdentityRecoverySession, IdentityFailure> {
    const session = this.store.recoveries.get(input.recoveryId);
    if (!session) {
      return fail('RECOVERY_NOT_FOUND', 'recovery session not found');
    }
    const uniquenessProof =
      input.uniquenessProofRef != null
        ? this.store.uniquenessProofs.get(input.uniquenessProofRef) ?? null
        : null;
    const completed = completeIdentityRecovery(session, input, uniquenessProof);
    if (!completed.ok) {
      return completed;
    }
    this.store.recoveries.set(completed.value.recoveryId, completed.value);
    return ok(completed.value);
  }

  suspend(
    humanActorId: HumanEconomicIdentityId,
    input: { readonly reasonCode: string; readonly evidenceRefs: readonly string[]; readonly at: UtcInstant },
  ): Result<import('./types.ts').IdentityRevocationRecord, IdentityFailure> {
    return this.applyRevocation(humanActorId, 'SUSPENDED', input);
  }

  revoke(
    humanActorId: HumanEconomicIdentityId,
    input: { readonly reasonCode: string; readonly evidenceRefs: readonly string[]; readonly at: UtcInstant },
  ): Result<import('./types.ts').IdentityRevocationRecord, IdentityFailure> {
    return this.applyRevocation(humanActorId, 'REVOKED', input);
  }

  markCompromised(
    humanActorId: HumanEconomicIdentityId,
    input: { readonly reasonCode: string; readonly evidenceRefs: readonly string[]; readonly at: UtcInstant },
  ): Result<import('./types.ts').IdentityRevocationRecord, IdentityFailure> {
    return this.applyRevocation(humanActorId, 'COMPROMISED', input);
  }

  markRecovered(humanActorId: HumanEconomicIdentityId, at: UtcInstant): Result<import('./types.ts').HumanEconomicIdentity, IdentityFailure> {
    const identity = this.store.identities.get(humanActorId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'human economic identity not found');
    }
    const updated = Object.freeze({
      ...identity,
      status: markRecoveredStatus(identity.status),
      activeRevocationRef: null,
      updatedAt: at,
      version: identity.version + 1,
    });
    this.store.identities.set(humanActorId, updated);
    return ok(updated);
  }

  resolveHumanActorForController(
    controllerKind: import('./types.ts').IdentityControllerKind,
    controllerRef: string,
    now: UtcInstant,
  ): HumanEconomicIdentityId | null {
    return humanActorForController([...this.store.links.values()], controllerKind, controllerRef, now);
  }

  resolveSubjectRef(humanActorId: HumanEconomicIdentityId): SubjectRef | null {
    return this.store.identities.get(humanActorId)?.pseudonymousSubjectRef ?? null;
  }

  factsForContribution(humanActorId: HumanEconomicIdentityId): IdentityFactsForContribution | null {
    const identity = this.store.identities.get(humanActorId);
    if (!identity) {
      return null;
    }
    const customerLink = [...this.store.links.values()].find(
      (link) => link.humanActorId === humanActorId && link.controllerKind === 'CUSTOMER_ACCOUNT',
    );
    return Object.freeze({
      humanActorId: identity.humanActorId,
      pseudonymousSubjectRef: identity.pseudonymousSubjectRef,
      assuranceLevel: identity.assuranceLevel,
      status: identity.status,
      operational: isIdentityOperational(identity.status),
      identityCommitment: humanEconomicIdentityCommitment({
        humanActorId: identity.humanActorId,
        pseudonymousSubjectRef: identity.pseudonymousSubjectRef,
        assuranceLevel: identity.assuranceLevel,
        jurisdiction: identity.jurisdiction,
      }),
      customerId: (customerLink?.controllerRef as CustomerId | undefined) ?? null,
    });
  }

  linkWalletToExistingHumanActor(input: LinkIdentityControllerInput): Result<import('./types.ts').IdentityControllerLink, IdentityFailure> {
    return this.linkController({
      ...input,
      purposes: input.purposes.length > 0 ? input.purposes : ['WALLET_CONTROL', 'CONTRIBUTION_ATTRIBUTION'],
    });
  }

  attemptDuplicateRegistration(input: RecordUniquenessProofInput): Result<import('./types.ts').UniquenessProofReceipt, IdentityFailure> {
    const built = buildUniquenessProofReceipt(input);
    if (!built.ok) {
      return built;
    }
    const conflict = this.uniquenessBoundary.findConflictingActor(
      built.value.commitment,
      input.humanActorId,
      new Map([...this.store.uniquenessProofs.values()].map((proof) => [proof.providerUniquenessCommitment, proof])),
    );
    if (conflict) {
      return fail('UNIQUENESS_CONFLICT', 'duplicate external identity under uniqueness policy');
    }
    return this.recordUniquenessProof(input);
  }

  private applyRevocation(
    humanActorId: HumanEconomicIdentityId,
    status: 'SUSPENDED' | 'REVOKED' | 'COMPROMISED',
    input: { readonly reasonCode: string; readonly evidenceRefs: readonly string[]; readonly at: UtcInstant },
  ): Result<import('./types.ts').IdentityRevocationRecord, IdentityFailure> {
    const identity = this.store.identities.get(humanActorId);
    if (!identity) {
      return fail('IDENTITY_NOT_FOUND', 'human economic identity not found');
    }
    const revocation = createRevocationRecord({
      humanActorId,
      status,
      reasonCode: input.reasonCode,
      evidenceRefs: input.evidenceRefs,
      effectiveFrom: input.at,
    });
    this.store.revocations.set(revocation.revocationId, revocation);
    const updated = Object.freeze({
      ...identity,
      status,
      activeRevocationRef: revocation.revocationId,
      updatedAt: input.at,
      version: identity.version + 1,
    });
    this.store.identities.set(humanActorId, updated);
    return ok(revocation);
  }

  isOperational(humanActorId: HumanEconomicIdentityId): boolean {
    const identity = this.store.identities.get(humanActorId);
    return identity ? isIdentityOperational(identity.status) : false;
  }

  futureActionsBlocked(humanActorId: HumanEconomicIdentityId): boolean {
    const identity = this.store.identities.get(humanActorId);
    return identity ? futureActionsBlocked(identity.status) : true;
  }
}
