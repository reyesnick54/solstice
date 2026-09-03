// @ts-nocheck
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import { expectedTotal } from '../supply.ts';
import {
  createEconomicProofBundle,
  swapDomain,
  tamperEvidenceHash,
  tamperPolicyHash,
} from './bundle.ts';
import {
  emptyClaimRegistry,
  getClaim,
  isClaimMonetized,
  registerEconomicClaim,
  serializeClaimRegistry,
  deserializeClaimRegistry,
} from './claims.ts';
import {
  evidenceCommitment,
  policyCommitment,
  rightsCommitment,
} from './commitments.ts';
import {
  attemptConsume,
  emptyConsumptionStore,
  isMonetizationKeyConsumed,
  loadConsumptionStore,
  persistConsumptionStore,
  replayConsumptionLog,
  serializeConsumptionStore,
  deserializeConsumptionStore,
} from './consumption.ts';
import {
  executeProofBoundMoonReyIssuance,
  executeProofBoundSunReyIssuance,
  burnRequiresGovernance,
  transferRequiresEconomicProof,
} from './pipeline.ts';
import { receiptExplainsSupplyChange } from './receipt.ts';
import { computeCommitmentRoots } from './roots.ts';
import { verifyProofBundle } from './verification.ts';

const NOW = 1_700_000_000n;
const EXPIRES = NOW + 86_400n;

function fixtureRoots() {
  const evidence = evidenceCommitment({
    commitmentId: 'evc.fixture',
    evidenceClass: 'VERIFIED_CONTRIBUTION_EVIDENCE',
    subjectCommitment: 'subj.fixture',
    provenanceRef: 'prov.fixture',
    verificationPolicyVersion: 'hec.verify.v1',
    sealedAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const rights = rightsCommitment({
    commitmentId: 'rtc.fixture',
    rightsClass: 'CONSENT',
    purpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: 'scope.fixture',
    holderCommitment: 'holder.fixture',
    validFromUnixSeconds: NOW - 3600n,
    expiresAtUnixSeconds: EXPIRES,
    active: true,
  });
  const policy = policyCommitment({
    commitmentId: 'plc.fixture',
    policyPackId: 'human.issuance.policy',
    policyVersion: 'sunrey.human.issuance.v1',
    methodologyVersion: 'hin.valuation.v1',
    active: true,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  return { evidence, rights, policy, roots };
}

function fixtureProductiveRoots() {
  const evidence = evidenceCommitment({
    commitmentId: 'evc.prod',
    evidenceClass: 'VERIFIED_PRODUCTIVE_EVIDENCE',
    subjectCommitment: 'obj.prod',
    provenanceRef: 'oracle.fixture',
    verificationPolicyVersion: 'productive.verify.v1',
    sealedAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const rights = rightsCommitment({
    commitmentId: 'rtc.prod',
    rightsClass: 'SOURCE_RIGHTS',
    purpose: 'PRODUCTIVE_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: 'license.fixture',
    holderCommitment: 'controller.fixture',
    validFromUnixSeconds: NOW - 3600n,
    expiresAtUnixSeconds: EXPIRES,
    active: true,
  });
  const policy = policyCommitment({
    commitmentId: 'plc.prod',
    policyPackId: 'moonrey.issuance.policy',
    policyVersion: 'moonrey.issuance.v1',
    methodologyVersion: 'gpuv.valuation.v1',
    active: true,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  return { evidence, rights, policy, roots };
}

function humanBundle(claimId: string, claimCommitment: string, authId: string, quantity: bigint) {
  const { evidence, rights, policy, roots } = fixtureRoots();
  const bundle = createEconomicProofBundle({
    economicClaimId: claimId,
    claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: roots.evidenceRoot,
      rightsRoot: roots.rightsRoot,
      policyRoot: roots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state.fixture',
    },
    valuation: {
      valuationId: `val.${claimId}`,
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: quantity.toString(),
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: authId,
      authorizedQuantity: quantity.toString(),
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  return { bundle, evidence, rights, policy, roots };
}

function productiveBundle(claimId: string, claimCommitment: string, authId: string, quantity: bigint) {
  const { evidence, rights, policy, roots } = fixtureProductiveRoots();
  const bundle = createEconomicProofBundle({
    economicClaimId: claimId,
    claimCommitment,
    economicDomain: 'PRODUCTIVE_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: roots.evidenceRoot,
      rightsRoot: roots.rightsRoot,
      policyRoot: roots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state.fixture',
    },
    valuation: {
      valuationId: `val.${claimId}`,
      methodologyId: 'GPUV_VALUATION',
      methodologyVersion: 'gpuv.valuation.v1',
      referenceValue: quantity.toString(),
      denomination: 'PRODUCTIVE_VALUE_UNITS',
    },
    governance: {
      authorizationId: authId,
      authorizedQuantity: quantity.toString(),
      governancePolicyVersion: 'moonrey.governance.v1',
    },
  });
  return { bundle, evidence, rights, policy, roots };
}

test('VALID SUNREY DEV/SIMULATION ISSUANCE: claim → evidence → rights → policy → governance → issuance → finality', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const registered = registerEconomicClaim(registry, {
    economicClaimId: 'claim.sunrey.1',
    economicDomain: 'HUMAN_ECONOMY',
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.sunrey.1',
    subjectCommitment: 'subj.sunrey.1',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
    lifecycleState: 'VERIFIED',
  });
  assert.equal(registered.ok, true);
  const claim = getClaim(registry, 'claim.sunrey.1')!;
  const { bundle, evidence, rights, policy, roots } = humanBundle(
    claim.economicClaimId,
    claim.claimCommitment,
    'gov.sunrey.1',
    500n,
  );
  const result = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_human_1',
    quantity: 500n,
    replayIdentifier: bundle.monetizationKey,
    bundle,
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.book.issuedPostGenesis, 500n);
    assert.equal(result.receipt.assetId, 'SUNREY_COIN');
    assert.equal(result.receipt.economicClaimId, 'claim.sunrey.1');
    assert.ok(result.receipt.evidenceRoot.length > 0);
    assert.ok(result.receipt.rightsRoot.length > 0);
    assert.ok(result.receipt.policyRoot.length > 0);
    const explanation = receiptExplainsSupplyChange(result.receipt);
    assert.match(explanation.why, /claim.sunrey.1/);
    assert.equal(isClaimMonetized(registry, 'claim.sunrey.1'), true);
    assert.equal(isMonetizationKeyConsumed(consumption, bundle.monetizationKey), true);
  }
});

test('VALID MOONREY DEV/SIMULATION ISSUANCE: claim → evidence → source rights → policy → governance → issuance → finality', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const registered = registerEconomicClaim(registry, {
    economicClaimId: 'claim.moonrey.1',
    economicDomain: 'PRODUCTIVE_ECONOMY',
    contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    fingerprint: 'fp.moonrey.1',
    subjectCommitment: 'obj.moonrey.1',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
    lifecycleState: 'VERIFIED',
  });
  assert.equal(registered.ok, true);
  const claim = getClaim(registry, 'claim.moonrey.1')!;
  const { bundle, evidence, rights, policy, roots } = productiveBundle(
    claim.economicClaimId,
    claim.claimCommitment,
    'gov.moonrey.1',
    300n,
  );
  const result = executeProofBoundMoonReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct_prod_1',
    quantity: 300n,
    replayIdentifier: bundle.monetizationKey,
    bundle,
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'PRODUCTIVE_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    contributionId: 'contrib.moonrey.1',
    fingerprint: 'fp.moonrey.1',
    authorizationId: 'gov.moonrey.1',
    category: 'COMPUTE',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.book.issuedPostGenesis, 300n);
    assert.equal(result.receipt.assetId, 'MOONREY_COIN');
    assert.equal(isClaimMonetized(registry, 'claim.moonrey.1'), true);
  }
});

test('failure cases: missing/tampered evidence, rights, policy, governance', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  registerEconomicClaim(registry, {
    economicClaimId: 'claim.fail',
    economicDomain: 'HUMAN_ECONOMY',
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.fail',
    subjectCommitment: 'subj.fail',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const claim = getClaim(registry, 'claim.fail')!;
  const base = humanBundle(claim.economicClaimId, claim.claimCommitment, 'gov.fail', 100n);

  const missingEvidence = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.missing.ev',
    bundle: base.bundle,
    evidence: evidenceCommitment({
      commitmentId: 'evc.other',
      evidenceClass: 'OTHER',
      subjectCommitment: 'x',
      provenanceRef: 'y',
      verificationPolicyVersion: 'v1',
      sealedAtUtc: '2024-01-01T00:00:00.000Z',
    }),
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(missingEvidence.ok, false);
  if (!missingEvidence.ok) assert.equal(missingEvidence.code, 'EVIDENCE_COMMITMENT_TAMPERED');

  const tampered = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.tamper.ev',
    bundle: tamperEvidenceHash(base.bundle, '0'.repeat(64)),
    evidence: base.evidence,
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(tampered.ok, false);
  if (!tampered.ok) assert.equal(tampered.code, 'EVIDENCE_COMMITMENT_TAMPERED');

  const expiredRights = rightsCommitment({
    commitmentId: 'rtc.expired',
    rightsClass: base.rights.rightsClass,
    purpose: base.rights.purpose,
    scopeCommitment: base.rights.scopeCommitment,
    holderCommitment: base.rights.holderCommitment,
    validFromUnixSeconds: NOW - 7200n,
    expiresAtUnixSeconds: NOW - 3600n,
    active: true,
  });
  const expiredRoots = computeCommitmentRoots({
    evidenceCommitmentHashes: [base.evidence.commitmentHash],
    rightsCommitmentHashes: [expiredRights.commitmentHash],
    policyCommitmentHashes: [base.policy.commitmentHash],
  });
  const expiredBundle = createEconomicProofBundle({
    economicClaimId: claim.economicClaimId,
    claimCommitment: claim.claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence: base.evidence,
    rights: expiredRights,
    policy: base.policy,
    roots: {
      evidenceRoot: expiredRoots.evidenceRoot,
      rightsRoot: expiredRoots.rightsRoot,
      policyRoot: expiredRoots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state.fixture',
    },
    valuation: {
      valuationId: 'val.exp',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '100',
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: 'gov.exp',
      authorizedQuantity: '100',
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  const expired = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.expired',
    bundle: expiredBundle,
    evidence: base.evidence,
    rights: expiredRights,
    policy: base.policy,
    roots: expiredRoots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.code, 'RIGHTS_EXPIRED');

  const wrongPurpose = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.wrong.purpose',
    bundle: base.bundle,
    evidence: base.evidence,
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'WRONG_PURPOSE',
  });
  assert.equal(wrongPurpose.ok, false);
  if (!wrongPurpose.ok) assert.equal(wrongPurpose.code, 'RIGHTS_WRONG_PURPOSE');

  const inactivePolicy = policyCommitment({
    commitmentId: 'plc.inactive',
    policyPackId: base.policy.policyPackId,
    policyVersion: base.policy.policyVersion,
    methodologyVersion: base.policy.methodologyVersion,
    active: false,
    activatedAtHeight: base.policy.activatedAtHeight,
  });
  const inactiveRoots = computeCommitmentRoots({
    evidenceCommitmentHashes: [base.evidence.commitmentHash],
    rightsCommitmentHashes: [base.rights.commitmentHash],
    policyCommitmentHashes: [inactivePolicy.commitmentHash],
  });
  const inactiveBundle = createEconomicProofBundle({
    economicClaimId: claim.economicClaimId,
    claimCommitment: claim.claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence: base.evidence,
    rights: base.rights,
    policy: inactivePolicy,
    roots: {
      evidenceRoot: inactiveRoots.evidenceRoot,
      rightsRoot: inactiveRoots.rightsRoot,
      policyRoot: inactiveRoots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state.fixture',
    },
    valuation: {
      valuationId: 'val.inactive',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '100',
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: 'gov.inactive',
      authorizedQuantity: '100',
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  const inactive = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.inactive.policy',
    bundle: inactiveBundle,
    evidence: base.evidence,
    rights: base.rights,
    policy: inactivePolicy,
    roots: inactiveRoots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.equal(inactive.code, 'POLICY_INACTIVE');

  const policyMismatch = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.policy.mismatch',
    bundle: tamperPolicyHash(base.bundle, 'f'.repeat(64)),
    evidence: base.evidence,
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(policyMismatch.ok, false);
  if (!policyMismatch.ok) assert.equal(policyMismatch.code, 'POLICY_COMMITMENT_TAMPERED');

  const aiGov = createEconomicProofBundle({
    economicClaimId: claim.economicClaimId,
    claimCommitment: claim.claimCommitment,
    economicDomain: 'HUMAN_ECONOMY',
    evidence: base.evidence,
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    valuation: {
      valuationId: 'val.ai',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'wrong.version',
      referenceValue: '100',
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: 'gov.ai',
      authorizedQuantity: '100',
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  const aiAttempt = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: 'replay.ai.gov',
    bundle: aiGov,
    evidence: base.evidence,
    rights: base.rights,
    policy: base.policy,
    roots: base.roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(aiAttempt.ok, false);
  if (!aiAttempt.ok) assert.equal(aiAttempt.code, 'POLICY_HASH_MISMATCH');
});

test('duplicate claim monetization and duplicate issuance authorization are blocked', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  registerEconomicClaim(registry, {
    economicClaimId: 'claim.dup',
    economicDomain: 'HUMAN_ECONOMY',
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.dup',
    subjectCommitment: 'subj.dup',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const claim = getClaim(registry, 'claim.dup')!;
  const { bundle, evidence, rights, policy, roots } = humanBundle(
    claim.economicClaimId,
    claim.claimCommitment,
    'gov.dup',
    50n,
  );
  const first = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 50n,
    replayIdentifier: bundle.monetizationKey,
    bundle,
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(first.ok, true);
  const second = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 50n,
    replayIdentifier: bundle.monetizationKey,
    bundle,
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, 'CLAIM_ALREADY_MONETIZED');
});

test('wrong asset domain: SunRey proof for MoonRey and MoonRey proof for SunRey', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  registerEconomicClaim(registry, {
    economicClaimId: 'claim.domain',
    economicDomain: 'HUMAN_ECONOMY',
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.domain',
    subjectCommitment: 'subj.domain',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const claim = getClaim(registry, 'claim.domain')!;
  const { bundle, evidence, rights, policy, roots } = humanBundle(
    claim.economicClaimId,
    claim.claimCommitment,
    'gov.domain',
    10n,
  );
  const moonreyAttempt = executeProofBoundMoonReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 10n,
    replayIdentifier: bundle.monetizationKey,
    bundle,
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    contributionId: 'c1',
    fingerprint: 'fp.domain',
    authorizationId: 'gov.domain',
    category: 'COMPUTE',
  });
  assert.equal(moonreyAttempt.ok, false);
  if (!moonreyAttempt.ok) assert.equal(moonreyAttempt.code, 'SUNREY_PROOF_FOR_MOONREY');

  registerEconomicClaim(registry, {
    economicClaimId: 'claim.prod.domain',
    economicDomain: 'PRODUCTIVE_ECONOMY',
    contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    fingerprint: 'fp.prod.domain',
    subjectCommitment: 'obj.domain',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const prodClaim = getClaim(registry, 'claim.prod.domain')!;
  const prod = productiveBundle(prodClaim.economicClaimId, prodClaim.claimCommitment, 'gov.prod', 10n);
  const sunreyAttempt = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 10n,
    replayIdentifier: prod.bundle.monetizationKey,
    bundle: prod.bundle,
    evidence: prod.evidence,
    rights: prod.rights,
    policy: prod.policy,
    roots: prod.roots,
    nowUnixSeconds: NOW,
  });
  assert.equal(sunreyAttempt.ok, false);
  if (!sunreyAttempt.ok) assert.equal(sunreyAttempt.code, 'MOONREY_PROOF_FOR_SUNREY');
});

test('failed issuance does not consume claim', () => {
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  registerEconomicClaim(registry, {
    economicClaimId: 'claim.noconsume',
    economicDomain: 'HUMAN_ECONOMY',
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.noconsume',
    subjectCommitment: 'subj.noconsume',
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
  });
  const claim = getClaim(registry, 'claim.noconsume')!;
  const { bundle, evidence, rights, policy, roots } = humanBundle(
    claim.economicClaimId,
    claim.claimCommitment,
    'gov.noconsume',
    100n,
  );
  const supplyBefore = expectedTotal(authority.book('SUNREY_COIN'));
  const failed = executeProofBoundSunReyIssuance(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct',
    quantity: 100n,
    replayIdentifier: bundle.monetizationKey,
    bundle: tamperEvidenceHash(bundle, 'a'.repeat(64)),
    evidence,
    rights,
    policy,
    roots,
    nowUnixSeconds: NOW,
    expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
  });
  assert.equal(failed.ok, false);
  assert.equal(expectedTotal(authority.book('SUNREY_COIN')), supplyBefore);
  assert.equal(isClaimMonetized(registry, 'claim.noconsume'), false);
  assert.equal(isMonetizationKeyConsumed(consumption, bundle.monetizationKey), false);
});

test('restart then duplicate remains blocked via durable consumption store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wave3-consumption-'));
  const filePath = join(dir, 'consumption.json');
  try {
    const authority = new ProtocolNativeSupplyAuthority();
    const registry = emptyClaimRegistry();
    const consumption = emptyConsumptionStore();
    registerEconomicClaim(registry, {
      economicClaimId: 'claim.restart',
      economicDomain: 'HUMAN_ECONOMY',
      contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
      fingerprint: 'fp.restart',
      subjectCommitment: 'subj.restart',
      registeredAtUtc: '2024-01-01T00:00:00.000Z',
    });
    const claim = getClaim(registry, 'claim.restart')!;
    const { bundle, evidence, rights, policy, roots } = humanBundle(
      claim.economicClaimId,
      claim.claimCommitment,
      'gov.restart',
      25n,
    );
    const first = executeProofBoundSunReyIssuance(authority, registry, consumption, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 25n,
      replayIdentifier: bundle.monetizationKey,
      bundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: NOW,
      expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    }, 42);
    assert.equal(first.ok, true);
    persistConsumptionStore(filePath, consumption, 42, 'state.restart');

    const loaded = loadConsumptionStore(filePath);
    assert.ok(loaded);
    const replayed = replayConsumptionLog(loaded!.store.appendLog);
    assert.equal(isMonetizationKeyConsumed(replayed, bundle.monetizationKey), true);

    const registry2 = deserializeClaimRegistry(serializeClaimRegistry(registry));
    const authority2 = new ProtocolNativeSupplyAuthority();
    const retry = executeProofBoundSunReyIssuance(authority2, registry2, replayed, {
      actor: 'PROTOCOL',
      network: 'DEVELOPMENT',
      recipient: 'acct',
      quantity: 25n,
      replayIdentifier: bundle.monetizationKey,
      bundle,
      evidence,
      rights,
      policy,
      roots,
      nowUnixSeconds: NOW,
      expectedPurpose: 'HUMAN_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    });
    assert.equal(retry.ok, false);
    if (!retry.ok) assert.equal(retry.code, 'CLAIM_ALREADY_MONETIZED');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('root verification rejects evidence not in committed root', () => {
  const { evidence, rights, policy, roots } = fixtureRoots();
  const fakeRoots = computeCommitmentRoots({
    evidenceCommitmentHashes: ['deadbeef'.repeat(8)],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  const claim = {
    schema: 'sunrey.economic-claim.v1' as const,
    economicClaimId: 'claim.root',
    claimCommitment: 'cc.root',
    economicDomain: 'HUMAN_ECONOMY' as const,
    contributionClass: 'VERIFIED_HUMAN_CONTRIBUTION',
    fingerprint: 'fp.root',
    lifecycleState: 'VERIFIED' as const,
    registeredAtUtc: '2024-01-01T00:00:00.000Z',
    containsRawPersonalData: false as const,
  };
  const bundle = createEconomicProofBundle({
    economicClaimId: 'claim.root',
    claimCommitment: 'cc.root',
    economicDomain: 'HUMAN_ECONOMY',
    evidence,
    rights,
    policy,
    roots: {
      evidenceRoot: fakeRoots.evidenceRoot,
      rightsRoot: fakeRoots.rightsRoot,
      policyRoot: fakeRoots.policyRoot,
      blockHeight: 1,
      stateCommitment: 'state',
    },
    valuation: {
      valuationId: 'val.root',
      methodologyId: 'HIN_VALUATION',
      methodologyVersion: 'hin.valuation.v1',
      referenceValue: '1',
      denomination: 'REFERENCE_UNITS',
    },
    governance: {
      authorizationId: 'gov.root',
      authorizedQuantity: '1',
      governancePolicyVersion: 'sunrey.human.governance.v1',
    },
  });
  const result = verifyProofBundle(bundle, {
    roots: fakeRoots,
    evidence,
    rights,
    policy,
    claim,
    nowUnixSeconds: NOW,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'EVIDENCE_NOT_IN_ROOT');
});

test('ordinary transfers do not require economic proof; burn governance semantics', () => {
  assert.equal(transferRequiresEconomicProof(), false);
  assert.equal(burnRequiresGovernance('VOLUNTARY_USER_BURN'), false);
  assert.equal(burnRequiresGovernance('FEE_BURN'), false);
  assert.equal(burnRequiresGovernance('PROTOCOL_ECONOMIC_PENALTY'), true);
});

test('consumption store serializes and replays deterministically', () => {
  const store = emptyConsumptionStore();
  const record = {
    monetizationKey: 'mk.test',
    economicClaimId: 'claim.test',
    bundleId: 'bundle.test',
    assetId: 'SUNREY_COIN' as const,
    quantity: '10',
    transactionId: 'tx.test',
    blockHeight: 5,
    stateCommitment: 'state.test',
    consumedAtUtc: '2024-01-01T00:00:00.000Z',
  };
  assert.equal(attemptConsume(store, record).ok, true);
  const serialized = serializeConsumptionStore(store, 5, 'state.test');
  const restored = deserializeConsumptionStore(serialized);
  assert.equal(isMonetizationKeyConsumed(restored, 'mk.test'), true);
  const replayed = replayConsumptionLog(serialized.consumption.appendLog);
  assert.equal(isMonetizationKeyConsumed(replayed, 'mk.test'), true);
});
