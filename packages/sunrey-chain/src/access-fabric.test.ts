import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACCESS_FABRIC_INVARIANTS,
  ACCESS_FORBIDDEN_CHAIN_KEYS,
  AccessFabricEngine,
  DevelopmentAccessOracleAdapter,
  DevelopmentSettlementProposalAdapter,
  buildCompletionSummary,
  computeSession,
  deliveryClaimCommitment,
  developmentAccessPorts,
  energySession,
  foodDeliverySession,
  hotelSession,
  isAccessRejection,
  ORACLE_GPU_FACT,
  publicAnchorFields,
  SELF_REPORT_GPU_FACT,
  usageProofCommitment,
  vehicleRentalSession,
} from './access-fabric/index.ts';

function openEngine(): {
  readonly engine: AccessFabricEngine;
  readonly oracles: DevelopmentAccessOracleAdapter;
  readonly settlement: DevelopmentSettlementProposalAdapter;
} {
  const oracles = new DevelopmentAccessOracleAdapter();
  const settlement = new DevelopmentSettlementProposalAdapter();
  const engine = new AccessFabricEngine(developmentAccessPorts(oracles, settlement));
  return { engine, oracles, settlement };
}

function activateSession(engine: AccessFabricEngine, sessionId: string, input = vehicleRentalSession(sessionId)): void {
  const opened = engine.openSession(input);
  assert.equal(opened.ok, true);
  const activated = engine.accessActivated(sessionId);
  assert.equal(activated.ok, true);
  const started = engine.serviceStarted(sessionId);
  assert.equal(started.ok, true);
}

describe('ACCESS-11 SunRey Access Fabric completion and evidence', () => {
  it('1. full delivery — vehicle pickup through return completion', () => {
    const { engine, oracles } = openEngine();
    const sessionId = 'vehicle_full_1';
    const opened = engine.openSession(vehicleRentalSession(sessionId));
    assert.equal(opened.ok, true);
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    oracles.record({
      factId: 'oracle_vehicle_mileage',
      sessionId,
      quantity: 120n,
      unit: 'km',
      source: 'ORACLE_NETWORK',
      finalized: true,
      conflicted: false,
      oracleRefs: ['oracle.fleet.odometer'],
    });

    const usage = engine.measureUsage({
      sessionId,
      proofId: 'usage_vehicle_1',
      measuredQuantity: 120n,
      sourceClass: 'ORACLE_NETWORK',
      sourceSystem: 'oracle.fleet.odometer',
      payloadDigest: 'digest_vehicle_usage',
      nonce: 'nonce_vehicle_1',
      oracleFactRefs: ['oracle_vehicle_mileage'],
      settlementGrade: true,
    });
    assert.equal(usage.ok, true);
    if (!usage.ok) {
      throw new Error('expected usage proof');
    }
    assert.equal(usage.value.evidenceQuality, 'INDEPENDENT_ORACLE');

    const delivery = engine.deliverCapacity({
      sessionId,
      claimId: 'delivery_vehicle_1',
      deliveredQuantity: 120n,
      claimStatus: 'FULL',
      sourceClass: 'ORACLE_NETWORK',
      sourceSystem: 'oracle.fleet.odometer',
      payloadDigest: 'digest_vehicle_delivery',
      nonce: 'nonce_vehicle_delivery_1',
      oracleFactRefs: ['oracle_vehicle_mileage'],
      settlementGrade: true,
    });
    assert.equal(delivery.ok, true);

    const completed = engine.returnCompleted(sessionId);
    assert.equal(completed.ok, true);

    const session = engine.getSession(sessionId)!;
    const summary = buildCompletionSummary(session);
    assert.match(summary.whyAccessGranted, /access\.policy\.simulation\.v1/);
    assert.equal(summary.whatWasReserved, '500 km');
    assert.match(summary.howMuchUsed, /120 km/);
    assert.match(summary.considerationExchanged, /25000 SAR/);
    assert.equal(engine.listChainAnchors().length > 0, true);
    assert.equal(engine.evidenceVault.verifyChain().ok, true);
  });

  it('2. partial delivery — hotel room-night shortfall', () => {
    const { engine } = openEngine();
    const sessionId = 'hotel_partial_1';
    engine.openSession(hotelSession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    const delivery = engine.deliverCapacity({
      sessionId,
      claimId: 'delivery_hotel_1',
      deliveredQuantity: 1n,
      claimStatus: 'PARTIAL',
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'pms.hotel_beta',
      payloadDigest: 'digest_hotel_partial',
      nonce: 'nonce_hotel_partial_1',
      settlementGrade: true,
    });
    assert.equal(delivery.ok, true);
    if (!delivery.ok) {
      throw new Error('expected partial delivery');
    }
    assert.equal(delivery.value.claimStatus, 'PARTIAL');
    assert.equal(delivery.value.deliveredQuantity, 1n);
    assert.equal(delivery.value.reservedQuantity, 2n);
  });

  it('3. failed delivery — food fulfilment not delivered', () => {
    const { engine } = openEngine();
    const sessionId = 'food_failed_1';
    engine.openSession(foodDeliverySession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    const delivery = engine.deliverCapacity({
      sessionId,
      claimId: 'delivery_food_fail_1',
      deliveredQuantity: 0n,
      claimStatus: 'FAILED',
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'kitchen.delta.ops',
      payloadDigest: 'digest_food_failed',
      nonce: 'nonce_food_failed_1',
      settlementGrade: true,
    });
    assert.equal(delivery.ok, true);
    if (!delivery.ok) {
      throw new Error('expected failed delivery claim');
    }
    assert.equal(delivery.value.claimStatus, 'FAILED');
    const workflow = engine.getSession(sessionId);
    assert.equal(workflow?.deliveryClaimIds.length, 1);
  });

  it('4. fraudulent/replayed proof — nonce reuse is refused', () => {
    const { engine } = openEngine();
    const sessionId = 'replay_test_1';
    activateSession(engine, sessionId);

    const first = engine.measureUsage({
      sessionId,
      proofId: 'usage_replay_1',
      measuredQuantity: 10n,
      sourceClass: 'PROVIDER_SELF_REPORT',
      sourceSystem: 'provider.self',
      payloadDigest: 'digest_replay',
      nonce: 'shared_nonce_1',
    });
    assert.equal(first.ok, true);

    const replay = engine.measureUsage({
      sessionId,
      proofId: 'usage_replay_2',
      measuredQuantity: 10n,
      sourceClass: 'PROVIDER_SELF_REPORT',
      sourceSystem: 'provider.self',
      payloadDigest: 'digest_replay_2',
      nonce: 'shared_nonce_1',
    });
    assert.equal(replay.ok, false);
    if (replay.ok) {
      throw new Error('expected replay refusal');
    }
    assert.equal(replay.code, 'PROOF_REPLAY');
  });

  it('5. inconsistent meter — provider self-report disagrees with oracle', () => {
    const { engine, oracles } = openEngine();
    const sessionId = 'meter_conflict_1';
    engine.openSession(computeSession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    oracles.record({ ...ORACLE_GPU_FACT, sessionId, factId: 'oracle_meter_conflict' });
    oracles.record({ ...SELF_REPORT_GPU_FACT, sessionId, factId: 'self_meter_conflict' });

    const measured = engine.measureUsage({
      sessionId,
      proofId: 'usage_meter_conflict',
      measuredQuantity: 10n,
      sourceClass: 'PROVIDER_SELF_REPORT',
      sourceSystem: 'provider.gpu_cloud',
      payloadDigest: 'digest_meter_conflict',
      nonce: 'nonce_meter_conflict',
      settlementGrade: true,
    });
    assert.equal(measured.ok, false);
    if (measured.ok) {
      throw new Error('expected meter inconsistency refusal');
    }
    assert.equal(measured.code, 'METER_INCONSISTENT');
  });

  it('6. dispute — opens dispute with evidence and chain anchor', () => {
    const { engine } = openEngine();
    const sessionId = 'dispute_test_1';
    activateSession(engine, sessionId);
    engine.measureUsage({
      sessionId,
      proofId: 'usage_dispute_1',
      measuredQuantity: 50n,
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'provider.fleet_alpha',
      payloadDigest: 'digest_dispute',
      nonce: 'nonce_dispute_usage',
    });
    engine.serviceCompleted(sessionId);

    const dispute = engine.openDispute({
      sessionId,
      disputeId: 'dispute_1',
      reason: 'DELIVERY_MISMATCH',
      openedBy: 'subject.traveler_1',
    });
    assert.equal(dispute.ok, true);
    if (!dispute.ok) {
      throw new Error('expected dispute');
    }
    assert.equal(dispute.value.status, 'OPEN');
    assert.equal(engine.getSession(sessionId)?.status, 'DISPUTED');
    assert.equal(engine.listChainAnchors().some((anchor) => anchor.event === 'DISPUTE'), true);
  });

  it('7. refund — adjustment proposal routes through financial authority', () => {
    const { engine, settlement } = openEngine();
    const sessionId = 'refund_test_1';
    activateSession(engine, sessionId);
    engine.measureUsage({
      sessionId,
      proofId: 'usage_refund_1',
      measuredQuantity: 30n,
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'provider.fleet_alpha',
      payloadDigest: 'digest_refund',
      nonce: 'nonce_refund_usage',
    });
    engine.serviceCompleted(sessionId);

    const proposal = engine.proposeRefundAdjustment({
      sessionId,
      proposalId: 'refund_prop_1',
      adjustmentMinorUnits: 5_000n,
      reason: 'partial_service_credit',
    });
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected refund proposal');
    }
    assert.equal(proposal.value.requiresKernelReview, true);
    assert.equal(proposal.value.routedToFinancialAuthority, true);
    assert.equal(settlement.routed.length, 1);
    assert.equal(settlement.routed[0]!.proposalId, 'refund_prop_1');
    assert.equal(settlement.routed[0]!.requiresKernelReview, true);
  });

  it('8. revoked provider — workflow blocked after revocation', () => {
    const { engine, oracles } = openEngine();
    const sessionId = 'revoked_provider_1';
    engine.openSession(energySession(sessionId));
    oracles.revokeProvider('provider.grid_gamma');

    const started = engine.serviceStarted(sessionId);
    assert.equal(started.ok, false);
    if (started.ok) {
      throw new Error('expected provider revoked');
    }
    assert.equal(started.code, 'PROVIDER_REVOKED');
  });

  it('9. late return/overage — simulation records overage with oracle evidence', () => {
    const { engine, oracles } = openEngine();
    const sessionId = 'overage_test_1';
    engine.openSession(vehicleRentalSession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    oracles.record({
      factId: 'oracle_vehicle_overage',
      sessionId,
      quantity: 550n,
      unit: 'km',
      source: 'ORACLE_NETWORK',
      finalized: true,
      conflicted: false,
      oracleRefs: ['oracle.fleet.odometer'],
    });

    const overage = engine.recordOverage({
      sessionId,
      overageQuantity: 50n,
      proofId: 'usage_overage_1',
      sourceClass: 'ORACLE_NETWORK',
      sourceSystem: 'oracle.fleet.odometer',
      payloadDigest: 'digest_overage',
      nonce: 'nonce_overage_1',
      oracleFactRefs: ['oracle_vehicle_overage'],
    });
    assert.equal(overage.ok, true);
    const session = engine.getSession(sessionId);
    assert.equal(session?.cumulativeUsage, 50n);
  });

  it('10. privacy-safe chain evidence — no forbidden private fields on anchor', () => {
    const { engine } = openEngine();
    const sessionId = 'privacy_test_1';
    activateSession(engine, sessionId);
    engine.measureUsage({
      sessionId,
      proofId: 'usage_privacy_1',
      measuredQuantity: 5n,
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'provider.fleet_alpha',
      payloadDigest: 'digest_privacy',
      nonce: 'nonce_privacy_1',
    });

    const anchors = engine.listChainAnchors();
    assert.equal(anchors.length > 0, true);
    for (const anchor of anchors) {
      const fields = publicAnchorFields(anchor);
      for (const forbidden of ACCESS_FORBIDDEN_CHAIN_KEYS) {
        assert.equal(Object.prototype.hasOwnProperty.call(fields, forbidden), false);
      }
      assert.equal(fields.privateFieldsExcluded, true);
      assert.match(String(fields.payloadCommitment), /^[0-9a-f]{64}$/);
    }
    assert.equal(ACCESS_FABRIC_INVARIANTS.RAW_PERSONAL_DATA_ON_CHAIN, false);
  });

  it('11. compute domain requires oracle for settlement-grade usage', () => {
    const { engine } = openEngine();
    const sessionId = 'compute_oracle_req_1';
    engine.openSession(computeSession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    const selfOnly = engine.measureUsage({
      sessionId,
      proofId: 'usage_compute_self',
      measuredQuantity: 5n,
      sourceClass: 'PROVIDER_SELF_REPORT',
      sourceSystem: 'provider.gpu_cloud',
      payloadDigest: 'digest_compute_self',
      nonce: 'nonce_compute_self',
      settlementGrade: true,
    });
    assert.equal(selfOnly.ok, false);
    if (selfOnly.ok) {
      throw new Error('expected self-report refusal for compute settlement');
    }
    assert.equal(selfOnly.code, 'SELF_REPORT_INSUFFICIENT');
  });

  it('12. energy delivery with oracle evidence completes workflow', () => {
    const { engine, oracles } = openEngine();
    const sessionId = 'energy_full_1';
    engine.openSession(energySession(sessionId));
    engine.accessActivated(sessionId);
    engine.serviceStarted(sessionId);

    oracles.record({
      factId: 'oracle_energy_kwh',
      sessionId,
      quantity: 900n,
      unit: 'kwh',
      source: 'ORACLE_NETWORK',
      finalized: true,
      conflicted: false,
      oracleRefs: ['oracle.grid.meter'],
    });

    const usage = engine.measureUsage({
      sessionId,
      proofId: 'usage_energy_1',
      measuredQuantity: 900n,
      sourceClass: 'ORACLE_NETWORK',
      sourceSystem: 'oracle.grid.meter',
      payloadDigest: 'digest_energy_usage',
      nonce: 'nonce_energy_1',
      oracleFactRefs: ['oracle_energy_kwh'],
      settlementGrade: true,
    });
    assert.equal(usage.ok, true);

    const delivery = engine.deliverCapacity({
      sessionId,
      claimId: 'delivery_energy_1',
      deliveredQuantity: 900n,
      claimStatus: 'FULL',
      sourceClass: 'ORACLE_NETWORK',
      sourceSystem: 'oracle.grid.meter',
      payloadDigest: 'digest_energy_delivery',
      nonce: 'nonce_energy_delivery_1',
      oracleFactRefs: ['oracle_energy_kwh'],
      settlementGrade: true,
    });
    assert.equal(delivery.ok, true);
    engine.serviceCompleted(sessionId);
    assert.equal(engine.getSession(sessionId)?.status, 'COMPLETED');
  });

  it('13. commitments are deterministic for usage proof and delivery claim', () => {
    const { engine } = openEngine();
    const sessionId = 'commitment_test_1';
    activateSession(engine, sessionId);
    const usage = engine.measureUsage({
      sessionId,
      proofId: 'usage_commit_1',
      measuredQuantity: 1n,
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'provider.fleet_alpha',
      payloadDigest: 'digest_commit',
      nonce: 'nonce_commit_1',
    });
    assert.equal(usage.ok, true);
    if (!usage.ok) {
      throw new Error('expected usage');
    }
    const a = usageProofCommitment(usage.value);
    const b = usageProofCommitment(usage.value);
    assert.equal(a, b);

    const delivery = engine.deliverCapacity({
      sessionId,
      claimId: 'delivery_commit_1',
      deliveredQuantity: 1n,
      claimStatus: 'FULL',
      sourceClass: 'PROVIDER_ATTESTED',
      sourceSystem: 'provider.fleet_alpha',
      payloadDigest: 'digest_delivery_commit',
      nonce: 'nonce_delivery_commit_1',
      settlementGrade: false,
    });
    assert.equal(delivery.ok, true);
    if (!delivery.ok) {
      throw new Error('expected delivery');
    }
    assert.equal(deliveryClaimCommitment(delivery.value), deliveryClaimCommitment(delivery.value));
  });

  it('14. isAccessRejection discriminates failures', () => {
    const { engine } = openEngine();
    const missing = engine.serviceStarted('missing_session');
    assert.equal(isAccessRejection(missing), true);
    if (missing.ok) {
      throw new Error('expected rejection');
    }
    assert.equal(missing.code, 'SESSION_NOT_FOUND');
  });
});
