// @ts-nocheck
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../domain/src/time.ts';
import { subjectRefFor } from '../ids.ts';
import {
  assuranceFromProviderSignals,
  identityAssuranceAtLeast,
} from './assurance.ts';
import {
  humanEconomicIdentityCommitment,
  providerUniquenessCommitment,
  rejectsLowEntropyIdentityMaterial,
} from './commitments.ts';
import { humanEconomicIdentityIdFor } from './ids.ts';
import { HumanEconomicIdentityService } from './service.ts';
import { evaluateSybilControls } from './sybil.ts';
import { buildUniquenessProofReceipt } from './uniqueness.ts';

const NOW = asUtcInstant('2026-09-02T12:00:00.000Z');
const LATER = asUtcInstant('2026-09-02T13:00:00.000Z');

function service(): HumanEconomicIdentityService {
  return new HumanEconomicIdentityService();
}

function registerAlice(service: HumanEconomicIdentityService, seed = 'alice') {
  const subjectRef = subjectRefFor(seed);
  const registered = service.registerIdentity({
    pseudonymousSubjectRef: subjectRef,
    jurisdiction: 'US',
    createdAt: NOW,
  });
  assert.equal(registered.ok, true);
  return { subjectRef, identity: registered.value! };
}

describe('Wave 6 — Human Economic Identity and Sybil resistance', () => {
  it('registers a durable pseudonymous HumanEconomicIdentity without raw legal identity', () => {
    const { identity, subjectRef } = registerAlice(service());
    assert.equal(identity.pseudonymousSubjectRef, subjectRef);
    assert.equal(identity.assuranceLevel, 'UNVERIFIED');
    assert.equal(identity.status, 'ACTIVE');
    assert.equal(identity.schemaVersion, 1);
    assert.equal('legalName' in identity, false);
    assert.equal('email' in identity, false);
  });

  it('supports assurance level ordering', () => {
    assert.equal(identityAssuranceAtLeast('IDENTITY_VERIFIED', 'ACCOUNT_VERIFIED'), true);
    assert.equal(identityAssuranceAtLeast('ACCOUNT_VERIFIED', 'IDENTITY_VERIFIED'), false);
    assert.equal(
      assuranceFromProviderSignals({
        accountVerified: true,
        credentialVerified: true,
        identityVerified: true,
        highAssuranceStepUp: true,
      }),
      'HIGH_ASSURANCE',
    );
  });

  it('allows same person with multiple wallets under one human actor', () => {
    const svc = service();
    const { identity } = registerAlice(svc);
    const walletA = svc.linkWalletToExistingHumanActor({
      humanActorId: identity.humanActorId,
      controllerKind: 'WALLET',
      controllerRef: 'wallet_a',
      purposes: ['WALLET_CONTROL'],
      effectiveFrom: NOW,
    });
    const walletB = svc.linkWalletToExistingHumanActor({
      humanActorId: identity.humanActorId,
      controllerKind: 'WALLET',
      controllerRef: 'wallet_b',
      purposes: ['WALLET_CONTROL'],
      effectiveFrom: NOW,
    });
    assert.equal(walletA.ok, true);
    assert.equal(walletB.ok, true);
    assert.equal(svc.resolveHumanActorForController('WALLET', 'wallet_a', NOW), identity.humanActorId);
    assert.equal(svc.resolveHumanActorForController('WALLET', 'wallet_b', NOW), identity.humanActorId);
    assert.equal(svc.resolveSubjectRef(identity.humanActorId), identity.pseudonymousSubjectRef);
  });

  it('links same identity to a new login account without changing contribution subject', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'login-change');
    const oldLogin = svc.linkController({
      humanActorId: identity.humanActorId,
      controllerKind: 'SUNREY_IDENTITY',
      controllerRef: 'idn_old_login',
      purposes: ['AUTHENTICATION'],
      effectiveFrom: NOW,
      effectiveUntil: LATER,
    });
    const newLogin = svc.linkController({
      humanActorId: identity.humanActorId,
      controllerKind: 'SUNREY_IDENTITY',
      controllerRef: 'idn_new_login',
      purposes: ['AUTHENTICATION'],
      effectiveFrom: LATER,
    });
    assert.equal(oldLogin.ok, true);
    assert.equal(newLogin.ok, true);
    assert.equal(svc.resolveSubjectRef(identity.humanActorId), identity.pseudonymousSubjectRef);
  });

  it('treats two different people with similar names as distinct identities', () => {
    const svc = service();
    const alice = registerAlice(svc, 'similar-alice');
    const bob = svc.registerIdentity({
      pseudonymousSubjectRef: subjectRefFor('similar-bob'),
      jurisdiction: 'US',
      createdAt: NOW,
    });
    assert.equal(bob.ok, true);
    assert.notEqual(alice.identity.humanActorId, bob.value!.humanActorId);
    assert.notEqual(alice.identity.pseudonymousSubjectRef, bob.value!.pseudonymousSubjectRef);
  });

  it('rejects reused identity credential across human actors', () => {
    const svc = service();
    const alice = registerAlice(svc, 'cred-alice');
    const bob = registerAlice(svc, 'cred-bob');
    const credential = humanEconomicIdentityCommitment({
      humanActorId: alice.identity.humanActorId,
      pseudonymousSubjectRef: alice.identity.pseudonymousSubjectRef,
      assuranceLevel: 'CREDENTIAL_VERIFIED',
      jurisdiction: 'US',
    });
    svc.store.identities.set(alice.identity.humanActorId, {
      ...alice.identity,
      credentialCommitments: Object.freeze([credential]),
    });
    const sybil = evaluateSybilControls({
      humanActorId: bob.identity.humanActorId,
      evaluatedAt: NOW,
      uniquenessCommitment: null,
      controllerRefs: [],
      contributionFingerprints: [],
      usageReceiptRefs: [],
      externalIdentityCommitments: [],
      credentialCommitments: [credential],
      relatedActorIds: [],
      deviceAbuseSignals: [],
      aiPatternSuggestions: [],
      existingUniquenessOwners: new Map(),
      existingExternalOwners: new Map(),
      existingCredentialOwners: new Map([[credential, alice.identity.humanActorId]]),
      existingReceiptOwners: new Map(),
      duplicateFingerprintOwners: new Map(),
    });
    assert.equal(sybil.policyOutcome, 'DENY_FUTURE_ACTION');
    assert.equal(sybil.signals.some((signal) => signal.kind === 'REUSED_CREDENTIAL'), true);
    assert.equal(sybil.autonomousBan, false);
  });

  it('rejects duplicate external identity under uniqueness policy', () => {
    const svc = service();
    const alice = registerAlice(svc, 'ext-alice');
    const bob = registerAlice(svc, 'ext-bob');
    const proofInput = {
      humanActorId: alice.identity.humanActorId,
      policyId: 'wave6-uniqueness-default',
      providerRef: 'fixture-kyc-provider',
      providerSubjectToken: 'opaque-provider-token-1234567890',
      saltRef: 'salt:fixture',
      evidenceCommitment: 'ev:fixture:alice',
      jurisdiction: 'US' as const,
      establishedAt: NOW,
    };
    const first = svc.recordUniquenessProof(proofInput);
    assert.equal(first.ok, true);
    const duplicate = svc.attemptDuplicateRegistration({
      ...proofInput,
      humanActorId: bob.identity.humanActorId,
      evidenceCommitment: 'ev:fixture:bob',
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'UNIQUENESS_CONFLICT');
    }
  });

  it('supports lost wallet recovery with uniqueness proof and preserves economic history subject', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'wallet-recovery');
    const proof = svc.recordUniquenessProof({
      humanActorId: identity.humanActorId,
      policyId: 'wave6-uniqueness-default',
      providerRef: 'fixture-kyc-provider',
      providerSubjectToken: 'opaque-provider-token-wallet',
      saltRef: 'salt:fixture',
      evidenceCommitment: 'ev:wallet-recovery',
      jurisdiction: 'US',
      establishedAt: NOW,
    });
    assert.equal(proof.ok, true);
    const started = svc.beginRecovery({
      humanActorId: identity.humanActorId,
      targetControllerKind: 'WALLET',
      targetControllerRef: 'wallet_new',
      priorControllerRef: 'wallet_lost',
      createdAt: NOW,
    });
    assert.equal(started.ok, true);
    const completed = svc.completeRecovery({
      recoveryId: started.value!.recoveryId,
      evidenceRefs: ['ev:recovery:step-up'],
      uniquenessProofRef: proof.value!.proofId,
      completedAt: LATER,
    });
    assert.equal(completed.ok, true);
    assert.equal(completed.value!.state, 'APPROVED');
    assert.equal(svc.resolveSubjectRef(identity.humanActorId), identity.pseudonymousSubjectRef);
  });

  it('blocks future actions for revoked identity without rewriting history', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'revoked');
    const revoked = svc.revoke(identity.humanActorId, {
      reasonCode: 'POLICY_REVOCATION',
      evidenceRefs: ['ev:revoke'],
      at: NOW,
    });
    assert.equal(revoked.ok, true);
    assert.equal(revoked.value!.rewritesHistoricalChain, false);
    assert.equal(revoked.value!.futureActionsBlocked, true);
    assert.equal(svc.futureActionsBlocked(identity.humanActorId), true);
    const link = svc.linkController({
      humanActorId: identity.humanActorId,
      controllerKind: 'WALLET',
      controllerRef: 'wallet_after_revoke',
      purposes: ['WALLET_CONTROL'],
      effectiveFrom: NOW,
    });
    assert.equal(link.ok, false);
  });

  it('marks compromised accounts and allows recovered status after remediation', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'compromised');
    const compromised = svc.markCompromised(identity.humanActorId, {
      reasonCode: 'CREDENTIAL_COMPROMISE',
      evidenceRefs: ['ev:compromise'],
      at: NOW,
    });
    assert.equal(compromised.ok, true);
    assert.equal(svc.futureActionsBlocked(identity.humanActorId), true);
    const recovered = svc.markRecovered(identity.humanActorId, LATER);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.value!.status, 'ACTIVE');
    assert.equal(svc.isOperational(identity.humanActorId), true);
  });

  it('links a new wallet to an existing human actor', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'new-wallet');
    const linked = svc.linkWalletToExistingHumanActor({
      humanActorId: identity.humanActorId,
      controllerKind: 'WALLET',
      controllerRef: 'wallet_linked',
      purposes: ['WALLET_CONTROL', 'CONTRIBUTION_ATTRIBUTION'],
      effectiveFrom: NOW,
    });
    assert.equal(linked.ok, true);
    assert.equal(svc.resolveHumanActorForController('WALLET', 'wallet_linked', NOW), identity.humanActorId);
  });

  it('detects Sybil attempts through many accounts as review-required, not autonomous ban', () => {
    const svc = service();
    const { identity } = registerAlice(svc, 'sybil-many');
    const controllers = Array.from({ length: 8 }, (_, index) => `wallet_${index}`);
    const sybil = evaluateSybilControls({
      humanActorId: identity.humanActorId,
      evaluatedAt: NOW,
      uniquenessCommitment: null,
      controllerRefs: controllers,
      contributionFingerprints: [],
      usageReceiptRefs: [],
      externalIdentityCommitments: [],
      credentialCommitments: [],
      relatedActorIds: [],
      deviceAbuseSignals: [],
      aiPatternSuggestions: [
        {
          kind: 'AI_PATTERN_SUGGESTION',
          severity: 'HIGH',
          evidenceCommitment: 'ai:suggestion:cluster',
          relatedActorIds: [],
        },
      ],
      existingUniquenessOwners: new Map(),
      existingExternalOwners: new Map(),
      existingCredentialOwners: new Map(),
      existingReceiptOwners: new Map(),
      duplicateFingerprintOwners: new Map(),
    });
    assert.equal(sybil.autonomousBan, false);
    assert.equal(sybil.policyOutcome, 'REQUIRE_REVIEW');
    assert.equal(sybil.signals.some((signal) => signal.aiSuggested && signal.autonomousBan === false), true);
  });

  it('keeps raw legal identity absent from identity commitments and rejects low-entropy material', () => {
    assert.equal(rejectsLowEntropyIdentityMaterial('ada@example.com'), true);
    assert.equal(rejectsLowEntropyIdentityMaterial('opaque-provider-token-abcdef0123456789'), false);
    const commitment = humanEconomicIdentityCommitment({
      humanActorId: humanEconomicIdentityIdFor('chain-check'),
      pseudonymousSubjectRef: subjectRefFor('chain-check'),
      assuranceLevel: 'IDENTITY_VERIFIED',
      jurisdiction: 'US',
    });
    assert.equal(commitment.length, 64);
    assert.equal(commitment.includes('ada@example.com'), false);
    const uniqueness = providerUniquenessCommitment({
      providerRef: 'fixture-kyc',
      providerSubjectToken: 'opaque-token-abcdef0123456789',
      jurisdiction: 'US',
      saltRef: 'salt:fixture',
    });
    assert.equal(uniqueness.includes('@'), false);
    const lowEntropy = buildUniquenessProofReceipt({
      humanActorId: humanEconomicIdentityIdFor('low-entropy'),
      policyId: 'wave6-uniqueness-default',
      providerRef: 'fixture-kyc',
      providerSubjectToken: 'ada@example.com',
      saltRef: 'salt:fixture',
      evidenceCommitment: 'ev:bad',
      jurisdiction: 'US',
      establishedAt: NOW,
    });
    assert.equal(lowEntropy.ok, false);
  });

  it('hydrates and snapshots identity state for restart survival', () => {
    const svc = service();
    registerAlice(svc, 'snapshot');
    const snap = svc.snapshot();
    const restored = new HumanEconomicIdentityService();
    restored.hydrate(snap);
    assert.equal(restored.store.identities.size, 1);
  });
});
