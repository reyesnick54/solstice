import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { disposeFeeV2, developmentFeeDispositionPolicyV2 } from './fees/v2/disposition.ts';
import {
  ProtocolTreasuryEngine,
  aiActor,
  allTreasuryStressHold,
  contentHashOf,
  developmentCycle,
  developmentTreasuryPolicy,
  humanGovernanceActor,
  rehearseProtocolTreasury,
  runTreasuryCommand,
  runTreasuryPropertySequence,
  TreasuryScenarioSimulator,
  TREASURY_SCENARIOS,
} from './economics/treasury/index.ts';

const HUMAN = humanGovernanceActor();
const EMERGENCY = humanGovernanceActor('gov.emergency', {
  emergencyHeightened: true,
  keyRefs: ['rot.governance.treasury.1', 'rot.governance.treasury.2'],
});

function fundedEngine(): ProtocolTreasuryEngine {
  const engine = new ProtocolTreasuryEngine();
  engine.fund({
    fundingId: 'open',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
    quantity: 1_000n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'open',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  engine.proposeBudget(
    {
      budgetId: 'ops',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      maximumAuthorizedQuantity: 400n,
      cycle: developmentCycle(),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['ops'],
      governanceProposalRef: 'gov:ops',
    },
    HUMAN,
  );
  engine.approveBudget('ops', HUMAN);
  return engine;
}

describe('Chunk 77 protocol treasury', () => {
  it('refuses treasury mint', () => {
    const engine = new ProtocolTreasuryEngine();
    const result = engine.attemptMint('SUNREY_COIN', 1n);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'TREASURY_MINT_UNAVAILABLE');
    }
    assert.equal(engine.nativeSupplyCreatedByTreasury(), 0n);
  });

  it('cannot reach customer assets', () => {
    const engine = new ProtocolTreasuryEngine();
    for (const domain of [
      'CUSTOMER_WALLET_HOLDINGS',
      'CUSTODY_CUSTOMER_ASSETS',
      'EXCHANGE_CUSTOMER_OBLIGATIONS',
      'MACHINE_ESCROW_EXTERNAL_ACTOR',
      'FIAT_LEDGER_CUSTOMER_BALANCES',
    ] as const) {
      const result = engine.attemptCustomerClaim(domain);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, 'CUSTOMER_ASSETS_UNREACHABLE');
      }
    }
  });

  it('rejects unauthorized and AI budget approval', () => {
    const engine = fundedEngine();
    const ai = engine.approveBudget('ops', aiActor());
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.code, 'AI_APPROVAL_REJECTED');
    }
    const unauthorized = engine.proposeBudget(
      {
        budgetId: 'bad',
        asset: 'SUNREY_COIN',
        reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        maximumAuthorizedQuantity: 10n,
        cycle: developmentCycle('bad'),
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        evidenceRefs: ['bad'],
        governanceProposalRef: 'gov:bad',
      },
      { kind: 'HUMAN', actorId: 'nobody', governanceAuthorized: false, emergencyHeightened: false, rootOfTrustKeyRefs: [] },
    );
    assert.equal(unauthorized.ok, true);
    const rejected = engine.approveBudget('bad', {
      kind: 'HUMAN',
      actorId: 'nobody',
      governanceAuthorized: false,
      emergencyHeightened: false,
      rootOfTrustKeyRefs: [],
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, 'UNAUTHORIZED_BUDGET_REJECTED');
    }
  });

  it('rejects the wrong asset and overspend', () => {
    const engine = fundedEngine();
    const wrong = engine.createIntent(
      {
        intentId: 'wrong-asset',
        budgetId: 'ops',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'MOONREY_COIN',
        quantity: 10n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    assert.equal(wrong.ok, false);
    if (!wrong.ok) {
      assert.equal(wrong.code, 'WRONG_ASSET_REJECTED');
    }
    const over = engine.createIntent(
      {
        intentId: 'over',
        budgetId: 'ops',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 401n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.code, 'OVERSPEND_REJECTED');
    }
  });

  it('rejects duplicate disbursement, reservation race, and tampering', () => {
    const engine = fundedEngine();
    engine.createIntent(
      {
        intentId: 'one',
        budgetId: 'ops',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 200n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    const dup = engine.createIntent(
      {
        intentId: 'one',
        budgetId: 'ops',
        recipient: 'acct.other',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 201n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.code, 'DUPLICATE_DISBURSEMENT_REJECTED');
    }
    const tight = new ProtocolTreasuryEngine();
    tight.fund({
      fundingId: 'tight',
      source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      quantity: 100n,
      epoch: 0n,
      height: 0n,
      evidenceRef: 'tight',
      monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
    });
    tight.proposeBudget(
      {
        budgetId: 'tight-ops',
        asset: 'SUNREY_COIN',
        reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        maximumAuthorizedQuantity: 400n,
        cycle: developmentCycle('tight'),
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        evidenceRefs: ['tight'],
        governanceProposalRef: 'gov:tight',
      },
      HUMAN,
    );
    tight.approveBudget('tight-ops', HUMAN);
    tight.createIntent(
      {
        intentId: 'a',
        budgetId: 'tight-ops',
        recipient: 'acct.a',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 80n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    tight.createIntent(
      {
        intentId: 'b',
        budgetId: 'tight-ops',
        recipient: 'acct.b',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 80n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    tight.approveIntent('a', HUMAN);
    tight.approveIntent('b', HUMAN);
    tight.reserve('a', HUMAN);
    const race = tight.reserve('b', HUMAN);
    assert.equal(race.ok, false);
    if (!race.ok) {
      assert.equal(race.code, 'RESERVATION_RACE_REJECTED');
    }
    engine.createIntent(
      {
        intentId: 'bound',
        budgetId: 'ops',
        recipient: 'acct.a',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 80n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    const recipient = engine.assertIntentBinding('bound', 'acct.tampered', 80n);
    assert.equal(recipient.ok, false);
    if (!recipient.ok) {
      assert.equal(recipient.code, 'TAMPERED_RECIPIENT_REJECTED');
    }
    const quantity = engine.assertIntentBinding('bound', 'acct.a', 1n);
    assert.equal(quantity.ok, false);
    if (!quantity.ok) {
      assert.equal(quantity.code, 'TAMPERED_QUANTITY_REJECTED');
    }
  });

  it('refuses emergency supply rewrite and mint', () => {
    const engine = new ProtocolTreasuryEngine();
    const rewrite = engine.attemptEmergencyRewriteSupply(EMERGENCY);
    assert.equal(rewrite.ok, false);
    if (!rewrite.ok) {
      assert.equal(rewrite.code, 'EMERGENCY_CANNOT_REWRITE_SUPPLY');
    }
    const mint = engine.attemptEmergencyMint(EMERGENCY);
    assert.equal(mint.ok, false);
    if (!mint.ok) {
      assert.equal(mint.code, 'EMERGENCY_CANNOT_MINT');
    }
  });

  it('applies FeePolicyV2 treasury disposition and cancels without burning', () => {
    const engine = fundedEngine();
    const disposition = disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', 400n);
    const funded = engine.applyFeeDispositionV2(disposition, 'fee-1', 1n, 10n);
    assert.equal(funded.ok, true);
    assert.equal(engine.getAccount('SUNREY_COIN', 'FEE_TREASURY_RESERVE').availableQuantity, disposition.treasury);
    engine.createIntent(
      {
        intentId: 'cancel-me',
        budgetId: 'ops',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 50n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.approveIntent('cancel-me', HUMAN);
    const reserved = engine.reserve('cancel-me', HUMAN);
    assert.equal(reserved.ok, true);
    const before = engine.getAccount('SUNREY_COIN', 'PROTOCOL_OPERATIONS_RESERVE');
    if (reserved.ok) {
      engine.cancelReservation(reserved.value.reservationId, HUMAN);
    }
    const after = engine.getAccount('SUNREY_COIN', 'PROTOCOL_OPERATIONS_RESERVE');
    assert.equal(after.availableQuantity, before.availableQuantity + 50n);
    assert.equal(after.reservedQuantity, before.reservedQuantity - 50n);
    assert.equal(engine.reconcile().ok, true);
  });

  it('finalizes only with chain finality and keeps the treasury equation', () => {
    const engine = fundedEngine();
    engine.createIntent(
      {
        intentId: 'pay',
        budgetId: 'ops',
        recipient: 'acct.provider',
        recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
        asset: 'SUNREY_COIN',
        quantity: 80n,
        purpose: 'PROTOCOL_INFRASTRUCTURE',
        expirationEpoch: 10n,
      },
      HUMAN,
    );
    engine.approveIntent('pay', HUMAN);
    const offchain = engine.finalize('pay', '', HUMAN);
    assert.equal(offchain.ok, false);
    engine.reserve('pay', HUMAN);
    const receipt = engine.finalize('pay', 'finality-pay', HUMAN);
    assert.equal(receipt.ok, true);
    assert.equal(engine.reconcile().ok, true);
    const hash = contentHashOf({
      intentId: 'pay',
      budgetId: 'ops',
      recipient: 'acct.provider',
      asset: 'SUNREY_COIN',
      quantity: 80n,
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      policyVersion: developmentTreasuryPolicy().policyVersion,
    });
    assert.equal(engine.listDisbursements()[0]?.transactionContentHash, hash);
  });

  it('holds property tests, stress catalog, simulator, and rehearsal', () => {
    assert.equal(runTreasuryPropertySequence(77, 16).ok, true);
    assert.equal(allTreasuryStressHold(), true);
    const simulator = new TreasuryScenarioSimulator();
    for (const id of TREASURY_SCENARIOS) {
      assert.equal(simulator.run(id).ok, true, id);
    }
    const rehearsal = rehearseProtocolTreasury();
    assert.equal(rehearsal.units, 'REHEARSAL_ONLY');
    assert.equal(rehearsal.reconciliation, true);
    assert.equal(rehearsal.productionTreasuryInactive, true);
    const verify = runTreasuryCommand(['verify']);
    assert.equal(verify.ok, true);
  });

  it('does not treat MoonRey holdings as productive and forbids privileged exchange', () => {
    const engine = new ProtocolTreasuryEngine();
    assert.equal(engine.attemptMoonReyFromHolding().ok, false);
    assert.equal(engine.attemptPrivilegedExchangeTrade().ok, false);
    assert.equal(engine.treasuryOwnedExchangeAccount().privilegedTrading, false);
    assert.equal(engine.attemptFiatLabel('USD').ok, false);
    assert.equal(engine.attemptPricePeg().ok, false);
  });
});
