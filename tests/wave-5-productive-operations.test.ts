import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ProductiveOperationsPlatform,
  challengeBlocksFutureMonetization,
  createProductiveClaimChallenge,
  detectProductiveAnomalies,
  refuseAiHardRuleOverride,
  refuseAutomaticClawback,
  transfersRemainIndependentFromProductiveOutage,
  transitionChallenge,
} from '../packages/sunrey-chain/src/productive/operations/index.ts';
import {
  activeFacilityObject,
  computeClusterObject,
  energyOperationsFixture,
  manufacturingFacilityObject,
  retiredFacilityObject,
  waterFacilityObject,
} from '../packages/sunrey-chain/src/productive/operations/fixtures.ts';
import { ProductiveEconomyEngine } from '../packages/sunrey-chain/src/productive/engine.ts';
import { DEV_CLOCK } from '../packages/sunrey-chain/src/productive/fixtures.ts';

describe('Wave 5 — productive claim challenge', () => {
  it('supports OPEN → UNDER_REVIEW → UPHELD lifecycle', () => {
    const challenge = createProductiveClaimChallenge({
      challengeId: 'chal.1',
      claimId: 'claim.energy.1',
      reason: 'DATA_INTEGRITY',
      challengerId: 'auditor.1',
      evidenceCommitment: 'evd.chal.1',
    });
    assert.equal(challenge.status, 'OPEN');

    const reviewed = transitionChallenge(challenge, 'UNDER_REVIEW');
    assert.ok(reviewed.ok);
    assert.equal(reviewed.value.status, 'UNDER_REVIEW');

    const upheld = transitionChallenge(reviewed.value, 'UPHELD', { resolutionNote: 'material defect confirmed' });
    assert.ok(upheld.ok);
    assert.equal(upheld.value.status, 'UPHELD');
    assert.ok(challengeBlocksFutureMonetization(upheld.value));
  });

  it('supports CORRECTED and SUPERSEDED terminal states', () => {
    const challenge = createProductiveClaimChallenge({
      challengeId: 'chal.2',
      claimId: 'claim.energy.2',
      reason: 'PROVIDER_CORRECTION',
      challengerId: 'provider.ops',
      evidenceCommitment: 'evd.chal.2',
    });
    const reviewed = transitionChallenge(challenge, 'UNDER_REVIEW');
    assert.ok(reviewed.ok);

    const corrected = transitionChallenge(reviewed.value, 'CORRECTED', {
      correctingClaimId: 'claim.energy.2.corrected',
    });
    assert.ok(corrected.ok);
    assert.equal(corrected.value.correctingClaimId, 'claim.energy.2.corrected');

    const superseded = transitionChallenge(
      createProductiveClaimChallenge({
        challengeId: 'chal.3',
        claimId: 'claim.energy.3',
        reason: 'DUPLICATE_EVENT',
        challengerId: 'mesh.reviewer',
        evidenceCommitment: 'evd.chal.3',
      }),
      'UNDER_REVIEW',
    );
    assert.ok(superseded.ok);
    const resolved = transitionChallenge(superseded.value, 'SUPERSEDED', {
      supersedingClaimId: 'claim.energy.3.v2',
    });
    assert.ok(resolved.ok);
    assert.equal(resolved.value.supersedingClaimId, 'claim.energy.3.v2');
  });
});

describe('Wave 5 — post-finality challenges', () => {
  it('records challenge state without rewriting history or clawback', () => {
    const platform = energyOperationsFixture();
    platform.openChallenge({
      challengeId: 'chal.post.1',
      claimId: 'claim.historical.1',
      reason: 'POST_FINALITY_REVIEW',
      challengerId: 'governance.reviewer',
      evidenceCommitment: 'evd.post.1',
      postFinality: true,
    });
    platform.reviewChallenge('chal.post.1');
    const resolved = platform.resolveChallenge('chal.post.1', 'UPHELD', {
      issuanceReceiptId: 'receipt.moonrey.1',
      historicalBlockHeight: 42,
      historicalBlockId: 'blk_42',
    });
    assert.ok(resolved.ok);

    assert.equal(platform.postFinalityRecords.length, 1);
    const record = platform.postFinalityRecords[0]!;
    assert.equal(record.historyRewritten, false);
    assert.equal(record.automaticClawback, false);
    assert.equal(record.silentBurn, false);
    assert.ok(record.requiredCorrectiveActions.includes('GOVERNANCE_REVIEW'));
    assert.ok(record.requiredCorrectiveActions.includes('MULTI_PARTY_AUTHORIZATION'));

    const clawback = platform.refuseAutomaticClawback();
    assert.equal(clawback.ok, false);
    assert.equal(clawback.code, 'AUTOMATIC_CLAWBACK_FORBIDDEN');

    const rewrite = platform.refuseHistoryRewrite();
    assert.equal(rewrite.ok, false);
    assert.equal(rewrite.code, 'POST_FINALITY_HISTORY_IMMUTABLE');
  });
});

describe('Wave 5 — source reputation', () => {
  it('influences review thresholds without establishing truth', () => {
    const platform = energyOperationsFixture();
    const reputation = platform.reputation.get('provider.energy.a', 'UTILITY_METER');
    assert.ok(reputation);
    assert.equal(reputation.establishesTruth, false);
    assert.ok(reputation.compositeScore > 0);
    assert.ok(reputation.reviewThresholdAdjustment >= 0);
  });

  it('lists degraded source classes in audit view', () => {
    const platform = energyOperationsFixture();
    platform.reputation.upsert({
      providerId: 'provider.bad',
      sourceClass: 'COMPROMISED_FEED',
      domain: 'ENERGY',
      acceptedObservations: 1,
      rejectedObservations: 99,
      verifiedIncidentCount: 10,
      outageCount: 10,
      schemaChangeCount: 10,
      correctionCount: 20,
      disagreementRate: 0.9,
      conflictsParticipated: 10,
    });
    const view = platform.auditView();
    assert.ok(view.degradedSourceClasses.includes('COMPROMISED_FEED'));
  });
});

describe('Wave 5 — productive asset anomalies', () => {
  it('flags capacity and throughput anomalies as review signals only', () => {
    const object = activeFacilityObject();
    const capacitySignals = detectProductiveAnomalies({
      anomalyId: 'anom.capacity.1',
      object,
      claimId: 'claim.capacity.1',
      reportedQuantity: 2_000n,
      configuredCapacity: 1_000n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.anom.1',
    });
    assert.ok(capacitySignals.some((row) => row.kind === 'PRODUCTION_EXCEEDS_CAPACITY'));
    assert.equal(capacitySignals[0]?.reviewSignalOnly, true);
    assert.equal(capacitySignals[0]?.automaticMonetaryJudgment, false);

    const retired = detectProductiveAnomalies({
      anomalyId: 'anom.retired.1',
      object: { ...retiredFacilityObject(), status: 'SUPERSEDED' },
      reportedQuantity: 100n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.anom.2',
    });
    assert.ok(retired.some((row) => row.kind === 'RETIRED_FACILITY_OUTPUT'));

    const manufacturing = detectProductiveAnomalies({
      anomalyId: 'anom.mfg.1',
      object: manufacturingFacilityObject(),
      reportedQuantity: 500n,
      configuredThroughput: 100n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.anom.3',
    });
    assert.ok(manufacturing.some((row) => row.kind === 'MANUFACTURING_EXCEEDS_THROUGHPUT'));

    const compute = detectProductiveAnomalies({
      anomalyId: 'anom.compute.1',
      object: computeClusterObject(),
      reportedQuantity: 600n,
      configuredCapacity: 100n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.anom.4',
    });
    assert.ok(compute.some((row) => row.kind === 'EXTREME_COMPUTE_OUTPUT'));

    const water = detectProductiveAnomalies({
      anomalyId: 'anom.water.1',
      object: waterFacilityObject(),
      reportedQuantity: 900n,
      configuredWaterBounds: 500n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.anom.5',
    });
    assert.ok(water.some((row) => row.kind === 'WATER_OUTPUT_EXCEEDS_BOUNDS'));
  });
});

describe('Wave 5 — AI role boundaries', () => {
  it('cannot override hard rules or approve issuance', () => {
    const platform = new ProductiveOperationsPlatform();
    const override = platform.refuseAiOverride('OVERRIDE_SOURCE_QUORUM');
    assert.equal(override.ok, false);
    assert.equal(override.rejection.code, 'AI_CANNOT_OVERRIDE_HARD_RULE');

    const direct = refuseAiHardRuleOverride('APPROVE_ISSUANCE');
    assert.equal(direct.ok, false);
    assert.equal(direct.rejection.code, 'AI_CANNOT_OVERRIDE_HARD_RULE');
  });
});

describe('Wave 5 — provider incidents and domain circuit breakers', () => {
  it('disables compromised provider without pausing blockchain', () => {
    const platform = energyOperationsFixture();
    const incident = platform.openIncident({
      incidentId: 'inc.compromise.1',
      providerId: 'provider.energy.a',
      classification: 'SOURCE_COMPROMISE_SUSPECTED',
      evidenceCommitment: 'evd.inc.1',
      domainScope: 'ENERGY',
    });
    assert.equal(incident.blockchainPaused, false);
    assert.ok(incident.containmentActions.includes('DISABLE_PROVIDER'));
    assert.ok(platform.incidents.isProviderDisabled('provider.energy.a'));
  });

  it('pauses one domain verification without affecting unrelated domains', () => {
    const platform = energyOperationsFixture();
    platform.domainCircuits.updateCoverage('ENERGY', 1);
    const energyPaused = platform.domainCircuits.assertVerificationAllowed('ENERGY');
    assert.equal(energyPaused.ok, false);

    const computeAllowed = platform.domainCircuits.assertVerificationAllowed('COMPUTE');
    assert.equal(computeAllowed.ok, true);
    assert.equal(transfersRemainIndependentFromProductiveOutage(), true);
  });

  it('blocks MoonRey proposals under challenge or anomaly without affecting ordinary transfers', () => {
    const platform = energyOperationsFixture();
    platform.openChallenge({
      challengeId: 'chal.block.1',
      claimId: 'claim.block.1',
      reason: 'DATA_INTEGRITY',
      challengerId: 'reviewer.1',
      evidenceCommitment: 'evd.block.1',
    });
    const blocked = platform.evaluateProposal({
      proposalId: 'prop.1',
      claimId: 'claim.block.1',
      domain: 'ENERGY',
      providerIds: ['provider.energy.a', 'provider.energy.b'],
      independentSourceCount: 2,
    });
    assert.equal(blocked.ok, false);

    const engine = new ProductiveEconomyEngine(DEV_CLOCK);
    assert.equal(engine.supplyIsReconciled(), true);
  });
});

describe('Wave 5 — observability and audit views', () => {
  it('exposes operational read models without sensitive raw data', () => {
    const platform = energyOperationsFixture();
    platform.openChallenge({
      challengeId: 'chal.audit.1',
      claimId: 'claim.audit.1',
      reason: 'METHODOLOGY_DISPUTE',
      challengerId: 'auditor.audit',
      evidenceCommitment: 'evd.audit.1',
    });
    platform.detectAnomalies({
      anomalyId: 'anom.audit.1',
      object: activeFacilityObject(),
      claimId: 'claim.audit.2',
      reportedQuantity: 5_000n,
      configuredCapacity: 1_000n,
      height: 10,
      blockTimeUnixSeconds: 1_800_000_000n,
      evidenceCommitment: 'evd.audit.anom',
    });
    const view = platform.auditView();
    assert.ok(view.energyVerificationProviders.includes('provider.energy.a'));
    assert.ok(view.challengedClaims.some((row) => row.challengeId === 'chal.audit.1'));
    assert.ok(view.anomalyFlags.length > 0);
    const metrics = platform.metrics.snapshot();
    assert.ok(metrics.productive_claims_challenged >= 1);
    assert.ok(typeof metrics.conflict_rate_bps === 'number');
  });
});

describe('Wave 5 — provider correction and recovery', () => {
  it('supports provider disable, corrected data, and re-enable recovery', () => {
    const platform = energyOperationsFixture();
    platform.openIncident({
      incidentId: 'inc.outage.1',
      providerId: 'provider.energy.b',
      classification: 'PROVIDER_OUTAGE',
      evidenceCommitment: 'evd.outage.1',
    });
    assert.ok(platform.incidents.isProviderDisabled('provider.energy.b'));

    const challenge = platform.openChallenge({
      challengeId: 'chal.correct.1',
      claimId: 'claim.correct.1',
      reason: 'PROVIDER_CORRECTION',
      challengerId: 'provider.energy.b',
      evidenceCommitment: 'evd.correct.1',
    });
    platform.reviewChallenge(challenge.challengeId);
    platform.resolveChallenge(challenge.challengeId, 'CORRECTED', {
      correctingClaimId: 'claim.correct.1.v2',
    });

    const reenabled = platform.incidents.reEnableProvider('provider.energy.b');
    assert.equal(reenabled.ok, true);
    assert.equal(platform.incidents.isProviderDisabled('provider.energy.b'), false);
  });
});
