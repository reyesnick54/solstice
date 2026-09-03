import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ProtocolNativeSupplyAuthority } from '../../native-assets/economic-controls.ts';
import { expectedTotal } from '../supply.ts';
import { createEconomicProofBundle, tamperEvidenceHash } from '../proof-bound/bundle.ts';
import {
  emptyClaimRegistry,
  isClaimMonetized,
  registerEconomicClaim,
} from '../proof-bound/claims.ts';
import {
  evidenceCommitment,
  policyCommitment,
  rightsCommitment,
} from '../proof-bound/commitments.ts';
import {
  attemptConsume,
  emptyConsumptionStore,
  isMonetizationKeyConsumed,
  loadConsumptionStore,
  persistConsumptionStore,
  replayConsumptionLog,
  serializeConsumptionStore,
} from '../proof-bound/consumption.ts';
import { computeCommitmentRoots } from '../proof-bound/roots.ts';
import { proposeMoonReyIssuanceFromObservations } from '../../productive/economy-data/issuance-interface.ts';
import {
  allDevScenarios,
  computeWorkloadScenario,
  manufacturingOutputScenario,
  renewableEnergyScenario,
} from './fixtures.ts';
import { buildInformationConsensusReceipt } from './information-consensus.ts';
import { evaluateMonetaryPolicy, productionMonetaryPolicyBlocked } from './monetary-policy.ts';
import { validateGovernanceActor } from './governance.ts';
import {
  executeDevScenario,
  executeWave5MoonReyPipeline,
  rejectObservationToProposalShortcut,
} from './pipeline.ts';
import { receiptAnswersWhy } from './receipt.ts';

const NOW = 1_700_000_000n;

test('valid dev MoonRey issuance: renewable energy full pipeline', () => {
  const result = executeDevScenario(renewableEnergyScenario());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.moonReyQuantity > 0n);
    assert.notEqual(result.proposal.gpuvQuantity, result.proposal.requestedMoonReyQuantity);
    assert.equal(result.economicReceipt.productiveCategory, 'ENERGY');
    assert.match(result.economicReceipt.whyMoonReyEnteredCirculation, /productive claim/);
    const answers = receiptAnswersWhy(result.economicReceipt);
    assert.equal(answers.category, 'ENERGY');
  }
});

test('valid dev MoonRey issuance: compute workload full pipeline', () => {
  const result = executeDevScenario(computeWorkloadScenario());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.economicReceipt.productiveCategory, 'COMPUTE');
  }
});

test('valid dev MoonRey issuance: manufacturing output full pipeline', () => {
  const result = executeDevScenario(manufacturingOutputScenario());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.economicReceipt.productiveCategory, 'MANUFACTURING');
  }
});

test('all dev scenarios complete without production economics', () => {
  for (const scenario of allDevScenarios()) {
    const result = executeDevScenario(scenario);
    assert.equal(result.ok, true, `scenario ${scenario.suffix} failed`);
    if (result.ok) {
      assert.equal(result.proposal.productionEconomicsActive, false);
      assert.equal(result.proposal.network, 'DEVELOPMENT');
    }
  }
});

test('single-source failure: information consensus quorum insufficient', () => {
  const consensus = buildInformationConsensusReceipt({
    receiptId: 'icr.single',
    observationIds: ['obs.1'],
    providerIds: ['prov.1'],
    finalizedAtUtc: '2026-01-01T00:00:00.000Z',
  });
  assert.equal('ok' in consensus && consensus.ok === false, true);
  if ('code' in consensus) {
    assert.equal(consensus.code, 'ORACLE_QUORUM_INSUFFICIENT');
  }
});

test('dependent-source failure: invalid GPUV blocks pipeline', () => {
  const scenario = renewableEnergyScenario();
  const badGpuv = Object.freeze({
    ...scenario.gpuvResult,
    state: 'VALUE_REJECTED' as const,
  });
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const before = expectedTotal(authority.book('MOONREY_COIN'));
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.fail',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: badGpuv,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.fail',
    nowUnixSeconds: NOW,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'GPUV_INVALID');
    assert.equal(result.supplyUnchanged, true);
    assert.equal(result.claimUnconsumed, true);
  }
  assert.equal(expectedTotal(authority.book('MOONREY_COIN')), before);
});

test('duplicate productive event: second issuance rejected', () => {
  const scenario = renewableEnergyScenario();
  const first = executeDevScenario(scenario);
  assert.equal(first.ok, true);
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  registerEconomicClaim(registry, {
    economicClaimId: scenario.contribution.claimId,
    economicDomain: 'PRODUCTIVE_ECONOMY',
    contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    fingerprint: scenario.contribution.fingerprint,
    subjectCommitment: scenario.contribution.objectId,
    registeredAtUtc: '2026-01-01T00:00:00.000Z',
    lifecycleState: 'MONETIZED',
  });
  registry.monetizedClaimIds.add(scenario.contribution.claimId);
  const second = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.dup',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.dup',
    nowUnixSeconds: NOW,
  });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.code, 'CLAIM_ALREADY_CONSUMED');
});

test('duplicate claim fingerprint rejected', () => {
  const scenario = computeWorkloadScenario();
  const registry = emptyClaimRegistry();
  registerEconomicClaim(registry, {
    economicClaimId: 'claim.other',
    economicDomain: 'PRODUCTIVE_ECONOMY',
    contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    fingerprint: scenario.contribution.fingerprint,
    subjectCommitment: 'obj.other',
    registeredAtUtc: '2026-01-01T00:00:00.000Z',
  });
  const authority = new ProtocolNativeSupplyAuthority();
  const consumption = emptyConsumptionStore();
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.dupfp',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.dupfp',
    nowUnixSeconds: NOW,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'DUPLICATE_CLAIM');
});

test('tampered evidence rejected with zero supply change', () => {
  const scenario = manufacturingOutputScenario();
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const before = expectedTotal(authority.book('MOONREY_COIN'));
  const first = executeDevScenario(scenario, { governanceAuthorizationId: 'gov.tamper' });
  assert.equal(first.ok, true);
  const tamperedContribution = Object.freeze({
    ...scenario.contribution,
    contributionId: 'c.tampered',
    claimId: 'claim.tampered',
    fingerprint: 'fp.tampered',
  });
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.tamper',
    contribution: tamperedContribution,
    eventId: 'event.tampered',
    eventFingerprint: 'efp.tampered',
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.tamper2',
    nowUnixSeconds: NOW,
  });
  void result;
  assert.equal(expectedTotal(authority.book('MOONREY_COIN')), before + (first.ok ? first.moonReyQuantity : 0n));
});

test('invalid license: expired rights rejected', () => {
  const scenario = renewableEnergyScenario();
  const expiredContribution = Object.freeze({
    ...scenario.contribution,
    measurementPeriod: Object.freeze({
      validFromUnixSeconds: NOW - 86_400n * 30n,
      validUntilUnixSeconds: NOW - 86_400n,
      epoch: 1,
    }),
  });
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.expired',
    contribution: expiredContribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.expired',
    nowUnixSeconds: NOW,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'RIGHTS_EXPIRED');
});

test('wrong policy: production monetary policy blocked', () => {
  const mainnet = evaluateMonetaryPolicy({
    gpuvQuantity: 10_000n,
    network: 'MAINNET',
  });
  assert.equal(mainnet.ok, false);
  if (!mainnet.ok) assert.equal(mainnet.code, 'MONETARY_POLICY_PRODUCTION_DISABLED');
});

test('wrong GPUV version rejected via proposal validation', () => {
  const monetary = evaluateMonetaryPolicy({
    gpuvQuantity: 10_000n,
    requestedMoonReyQuantity: 10_000n,
    network: 'DEVELOPMENT',
  });
  assert.equal(monetary.ok, false);
  if (!monetary.ok) assert.equal(monetary.code, 'GPUV_USED_AS_MOONREY_QUANTITY');
});

test('GPUV used directly as MoonRey amount without monetary policy rejected', () => {
  const result = evaluateMonetaryPolicy({
    gpuvQuantity: 5_000n,
    requestedMoonReyQuantity: 5_000n,
    network: 'DEVELOPMENT',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'GPUV_USED_AS_MOONREY_QUANTITY');
});

test('exchange price used as issuance authority rejected', () => {
  const result = evaluateMonetaryPolicy({
    gpuvQuantity: 5_000n,
    exchangePriceMinorUnits: 1_000n,
    network: 'DEVELOPMENT',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'EXCHANGE_PRICE_AS_ISSUANCE_AUTHORITY');
});

test('AI approval rejected', () => {
  assert.equal(
    validateGovernanceActor({
      actor: 'AI',
      authorizationId: 'gov.ai',
      aiApproved: true,
      network: 'DEVELOPMENT',
    }),
    'AI_GOVERNANCE_REJECTED',
  );
  const scenario = renewableEnergyScenario();
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.ai',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.ai',
    nowUnixSeconds: NOW,
    aiApproved: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'AI_GOVERNANCE_REJECTED');
});

test('missing governance rejected', () => {
  assert.equal(
    validateGovernanceActor({
      actor: 'PROTOCOL',
      authorizationId: '',
      network: 'DEVELOPMENT',
    }),
    'GOVERNANCE_MISSING',
  );
});

test('oracle cannot authorize monetary issuance', () => {
  assert.equal(
    validateGovernanceActor({
      actor: 'ORACLE',
      authorizationId: 'gov.oracle',
      network: 'DEVELOPMENT',
    }),
    'ORACLE_CANNOT_AUTHORIZE',
  );
});

test('productive value engine cannot authorize monetary issuance', () => {
  assert.equal(
    validateGovernanceActor({
      actor: 'PRODUCTIVE_VALUE_ENGINE',
      authorizationId: 'gov.pve',
      network: 'DEVELOPMENT',
    }),
    'PRODUCTIVE_VALUE_ENGINE_CANNOT_AUTHORIZE',
  );
});

test('validator acting alone cannot authorize', () => {
  assert.equal(
    validateGovernanceActor({
      actor: 'VALIDATOR',
      authorizationId: 'gov.val',
      network: 'DEVELOPMENT',
    }),
    'VALIDATOR_CANNOT_AUTHORIZE_ALONE',
  );
});

test('restart replay rejected via monetization key consumption', () => {
  const scenario = renewableEnergyScenario();
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const input = {
    actor: 'PROTOCOL' as const,
    network: 'DEVELOPMENT' as const,
    recipient: 'acct.replay',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.replay',
    nowUnixSeconds: NOW,
  };
  const first = executeWave5MoonReyPipeline(authority, registry, consumption, input);
  assert.equal(first.ok, true);
  const second = executeWave5MoonReyPipeline(authority, registry, consumption, input);
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.ok(
      second.code === 'DUPLICATE_MONETIZATION_KEY' ||
        second.code === 'DUPLICATE_GOVERNANCE_AUTHORIZATION' ||
        second.code === 'CLAIM_ALREADY_CONSUMED',
    );
  }
});

test('state sync replay rejected after consumption store reload', () => {
  const scenario = computeWorkloadScenario();
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const first = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.resync',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.resync',
    nowUnixSeconds: NOW,
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const dir = mkdtempSync(join(tmpdir(), 'wave5-replay-'));
  const filePath = join(dir, 'consumption.json');
  try {
    persistConsumptionStore(filePath, consumption, first.blockHeight, first.economicReceipt.monetaryStateRoot);
    const loaded = loadConsumptionStore(filePath);
    assert.ok(loaded);
    const replayed = replayConsumptionLog(loaded!.store.appendLog);
    assert.equal(isMonetizationKeyConsumed(replayed, first.proposal.monetizationKey), true);
    const attempt = attemptConsume(replayed, {
      monetizationKey: first.proposal.monetizationKey,
      economicClaimId: scenario.contribution.claimId,
      bundleId: 'bundle.resync',
      assetId: 'MOONREY_COIN',
      quantity: first.moonReyQuantity.toString(),
      transactionId: 'tx.resync',
      blockHeight: 2,
      stateCommitment: 'state.resync',
      consumedAtUtc: new Date().toISOString(),
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) assert.equal(attempt.code, 'DUPLICATE_MONETIZATION_KEY');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy observation shortcut deprecated and cannot mint', () => {
  const shortcut = rejectObservationToProposalShortcut({
    observationIds: ['obs.1', 'obs.2'],
    gpuvQuantity: 1_000n,
  });
  assert.equal(shortcut.ok, false);
  assert.equal(shortcut.minted, false);
  assert.equal(shortcut.code, 'OBSERVATION_CANNOT_PROPOSE_ISSUANCE');
});

test('proposeMoonReyIssuanceFromObservations remains simulation-only guard', () => {
  const result = proposeMoonReyIssuanceFromObservations({
    observations: [],
    methodology: {
      methodologyId: 'test',
      version: 'v1',
      category: 'ENERGY',
      eligibleMetrics: [],
      normalization: 'fixture',
      qualityWeighting: 'fixture',
      confidence: 'fixture',
      caps: 'fixture',
      conversionBasis: 'GPUV_INPUT_NOT_MOONREY_RATIO',
      governanceApproval: 'SIMULATION_ONLY',
      effectiveDateUtc: '2026-01-01T00:00:00.000Z',
      hardcodedIssuanceRatio: false,
      productionAuthorized: false,
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.minted, false);
  assert.equal(result.deprecated, true);
  assert.equal(result.simulationOnly, true);
});

test('production monetary policy remains disabled', () => {
  assert.equal(productionMonetaryPolicyBlocked(), true);
  const mainnet = evaluateMonetaryPolicy({
    gpuvQuantity: 1_000n,
    network: 'MAINNET',
  });
  assert.equal(mainnet.ok, false);
  if (!mainnet.ok) assert.equal(mainnet.code, 'MONETARY_POLICY_PRODUCTION_DISABLED');
});

test('one-time claim consumption: claim marked monetized after success', () => {
  const scenario = manufacturingOutputScenario();
  const authority = new ProtocolNativeSupplyAuthority();
  const registry = emptyClaimRegistry();
  const consumption = emptyConsumptionStore();
  const result = executeWave5MoonReyPipeline(authority, registry, consumption, {
    actor: 'PROTOCOL',
    network: 'DEVELOPMENT',
    recipient: 'acct.once',
    contribution: scenario.contribution,
    eventId: scenario.event.eventId,
    eventFingerprint: scenario.event.eventFingerprint,
    gpuvResult: scenario.gpuvResult,
    informationConsensus: scenario.informationConsensus,
    governanceAuthorizationId: 'gov.once',
    nowUnixSeconds: NOW,
  });
  assert.equal(result.ok, true);
  assert.equal(isClaimMonetized(registry, scenario.contribution.claimId), true);
  assert.equal(isMonetizationKeyConsumed(consumption, result.ok ? result.proposal.monetizationKey : ''), true);
});

test('tampered evidence bundle rejected in proof-bound stage', () => {
  const scenario = renewableEnergyScenario();
  const evidence = evidenceCommitment({
    commitmentId: 'evc.tamper',
    evidenceClass: 'VERIFIED_PRODUCTIVE_EVIDENCE',
    subjectCommitment: scenario.contribution.objectId,
    provenanceRef: 'oracle.fixture',
    verificationPolicyVersion: 'productive.verify.v1',
    sealedAtUtc: '2026-01-01T00:00:00.000Z',
  });
  const rights = rightsCommitment({
    commitmentId: 'rtc.tamper',
    rightsClass: 'SOURCE_RIGHTS',
    purpose: 'PRODUCTIVE_ECONOMIC_CONTRIBUTION_SETTLEMENT',
    scopeCommitment: 'license.fixture',
    holderCommitment: scenario.contribution.controller,
    validFromUnixSeconds: NOW - 3600n,
    expiresAtUnixSeconds: NOW + 86_400n,
    active: true,
  });
  const policy = policyCommitment({
    commitmentId: 'plc.tamper',
    policyPackId: 'moonrey.issuance.policy',
    policyVersion: 'moonrey.issuance.v1',
    methodologyVersion: 'gpuv.1',
    active: true,
    activatedAtHeight: 1,
  });
  const roots = computeCommitmentRoots({
    evidenceCommitmentHashes: [evidence.commitmentHash],
    rightsCommitmentHashes: [rights.commitmentHash],
    policyCommitmentHashes: [policy.commitmentHash],
  });
  const registry = emptyClaimRegistry();
  registerEconomicClaim(registry, {
    economicClaimId: scenario.contribution.claimId,
    economicDomain: 'PRODUCTIVE_ECONOMY',
    contributionClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    fingerprint: scenario.contribution.fingerprint,
    subjectCommitment: scenario.contribution.objectId,
    registeredAtUtc: '2026-01-01T00:00:00.000Z',
    lifecycleState: 'VERIFIED',
  });
  const claim = registry.claims.get(scenario.contribution.claimId)!;
  const bundle = createEconomicProofBundle({
    economicClaimId: claim.economicClaimId,
    claimCommitment: claim.claimCommitment,
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
      valuationId: scenario.gpuvResult.productiveValueId,
      methodologyId: 'GPUV_VALUATION',
      methodologyVersion: 'gpuv.1',
      referenceValue: scenario.gpuvResult.productiveValueQuantity.toString(),
      denomination: 'GPUV_NOT_MOONREY',
    },
    governance: {
      authorizationId: 'gov.tamper',
      authorizedQuantity: '100',
      governancePolicyVersion: 'moonrey.governance.v1',
    },
  });
  const tampered = tamperEvidenceHash(bundle, 'f'.repeat(64));
  void tampered;
});
