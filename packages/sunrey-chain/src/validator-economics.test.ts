import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FeeEngine, REWARD_POOL_ACCOUNT } from './fees/engine.ts';
import { developmentFeeDispositionPolicy, disposeFee } from './fees/policy.ts';
import {
  AI_POLICY_ACTOR,
  HUMAN_GOVERNANCE_ACTOR,
  ValidatorEconomicsEngine,
  createEconomicPolicy,
  fixtureValidatorRecord,
  rehearsalValidatorRecords,
  runValidatorEconomicsSimulation,
} from './validator-economics/index.ts';
import type { ProtocolEvidence } from './validator-economics/index.ts';

function validEvidence(validatorId: string, id = 'ev_1'): ProtocolEvidence {
  return {
    evidenceId: id,
    violationClass: 'DOUBLE_PREVOTE',
    validatorId,
    height: 8n,
    round: 0n,
    leftHash: 'left',
    rightHash: 'right',
    signatureA: 'sig-a',
    signatureB: 'sig-b',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
  };
}

function bondedEngine(count = 2) {
  const engine = new ValidatorEconomicsEngine('development');
  const records = Array.from({ length: count }, (_, index) =>
    fixtureValidatorRecord({ label: String.fromCharCode(65 + index) }),
  );
  for (const record of records) {
    engine.registerValidator(record, 5_000_000n);
    const bonded = engine.bond({
      validatorId: record.validatorId,
      quantity: 1_000_000n,
      asset: 'DEVELOPMENT_SUNREY_COIN',
    });
    assert.equal(bonded.ok, true);
  }
  engine.advanceEpoch();
  return { engine, records };
}

describe('Chunk 72 validator economics', () => {
  it('bonds with exclusive native-lock semantics and maps onto the validator lifecycle', () => {
    const { engine, records } = bondedEngine(1);
    const position = engine.getBond(records[0]!.validatorId);
    assert.equal(position?.state, 'BONDED');
    assert.equal(position?.validatorStatus, 'ACTIVE');
    assert.equal(position?.activeLockedQuantity, 1_000_000n);
    const spend = engine.occupy(records[0]!.operatorActorId, 'SPEND', 1n);
    assert.equal(spend.ok, true);
    const over = engine.occupy(records[0]!.operatorActorId, 'EXCHANGE_RESERVED', 10_000_000n);
    assert.equal(over.ok, false);
    if (!over.ok) {
      assert.equal(over.error.code, 'INSUFFICIENT_AVAILABLE');
    }
  });

  it('keeps bond eligibility distinct from voting power', () => {
    const engine = new ValidatorEconomicsEngine('development');
    const record = fixtureValidatorRecord({ label: 'A', votingPower: 7n });
    engine.registerValidator(record, 2_000_000n);
    engine.bond({ validatorId: record.validatorId, quantity: 1_000_000n, asset: 'DEVELOPMENT_SUNREY_COIN' });
    assert.equal(engine.getBond(record.validatorId)?.bondedQuantity, 1_000_000n);
    assert.equal(record.votingPower, 7n);
    const refused = engine.attemptCoinEqualsVote();
    assert.equal(refused.ok, false);
  });

  it('rejects public delegation', () => {
    const engine = new ValidatorEconomicsEngine('development');
    assert.equal(engine.attemptDelegation().ok, false);
  });

  it('settles rewards with exact integer remainder handling', () => {
    const { engine, records } = bondedEngine(2);
    for (const record of records) {
      assert.equal(
        engine.recordParticipation({
          entitlementId: `${record.validatorId}:1:v1`,
          validatorId: record.validatorId,
          epoch: 1n,
          height: 8n,
          expectedVotes: 10n,
          validSignedVotes: 10n,
          missedVotes: 0n,
          proposalAssignments: 0n,
          validProposals: 0n,
          activeVotingPower: 1n,
          epochMember: true,
          policyVersion: 1,
        }).ok,
        true,
      );
    }
    engine.ingestFeeAllocation(1_001n);
    const settled = engine.settleEpochRewards(1n);
    assert.equal(settled.ok, true);
    if (settled.ok) {
      const paid = settled.value.reduce((sum, row) => sum + row.paid, 0n);
      assert.equal(paid + engine.remainderSink, 1_001n);
    }
  });

  it('imports fee disposition into validator reward accounting', () => {
    const fees = new FeeEngine();
    const disposition = disposeFee(developmentFeeDispositionPolicy(), 'SUNREY_COIN', 400n);
    assert.equal(disposition.validatorRewardPool > 0n, true);
    const { engine } = bondedEngine(1);
    const imported = engine.ingestFeeAllocation(disposition.validatorRewardPool, 'TRANSACTION_FEE_ALLOCATION');
    assert.equal(imported.ok, true);
    assert.equal(REWARD_POOL_ACCOUNT, 'sunrey.fees.validator_reward_pool');
    assert.equal(fees.accounts.position(REWARD_POOL_ACCOUNT, 'SUNREY_COIN').available, 0n);
  });

  it('applies an evidence-based penalty once and jails through the existing lifecycle', () => {
    const { engine, records } = bondedEngine(1);
    const first = engine.applyPenalty(validEvidence(records[0]!.validatorId));
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.value.jailed, true);
      assert.equal(engine.getBond(records[0]!.validatorId)?.validatorStatus, 'JAILED');
    }
    const replay = engine.applyPenalty(validEvidence(records[0]!.validatorId));
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'DUPLICATE_PENALTY');
    }
  });

  it('delays unbonding through the accountability window', () => {
    const { engine, records } = bondedEngine(1);
    const requested = engine.requestUnbond(records[0]!.validatorId);
    assert.equal(requested.ok, true);
    const immediate = engine.releaseUnbond(records[0]!.validatorId);
    assert.equal(immediate.ok, false);
    engine.advanceEpoch();
    engine.advanceEpoch();
    const released = engine.releaseUnbond(records[0]!.validatorId);
    assert.equal(released.ok, true);
    if (released.ok) {
      assert.equal(released.value.state, 'EXITED');
    }
  });

  it('tombstones from equivocation and refuses silent readmission', () => {
    const { engine, records } = bondedEngine(1);
    const tombstone = engine.applyPenalty({
      ...validEvidence(records[0]!.validatorId, 'ev_prop'),
      violationClass: 'DOUBLE_PROPOSAL',
    });
    assert.equal(tombstone.ok, true);
    assert.equal(engine.getBond(records[0]!.validatorId)?.state, 'TOMBSTONED');
    const rebond = engine.bond({
      validatorId: records[0]!.validatorId,
      quantity: 1_000_000n,
      asset: 'DEVELOPMENT_SUNREY_COIN',
    });
    assert.equal(rebond.ok, false);
  });

  it('uses the policy active in the relevant epoch', () => {
    const { engine, records } = bondedEngine(1);
    const next = createEconomicPolicy('development', 2, 2n, 16n);
    const authorized = engine.authorizePolicy(next, HUMAN_GOVERNANCE_ACTOR);
    assert.equal(authorized.ok, true);
    assert.equal(engine.getValidatorEconomicPolicy(1n).version, 1);
    assert.equal(engine.getValidatorEconomicPolicy(2n).version, 2);
    const wrong = engine.recordParticipation({
      entitlementId: `${records[0]!.validatorId}:1:v2`,
      validatorId: records[0]!.validatorId,
      epoch: 1n,
      height: 8n,
      expectedVotes: 1n,
      validSignedVotes: 1n,
      missedVotes: 0n,
      proposalAssignments: 0n,
      validProposals: 0n,
      activeVotingPower: 1n,
      epochMember: true,
      policyVersion: 2,
    });
    assert.equal(wrong.ok, false);
  });

  it('reconciles bond locks, rewards, penalties, and supply without balancing entries', () => {
    const { engine, records } = bondedEngine(2);
    engine.ingestFeeAllocation(100n);
    engine.recordParticipation({
      entitlementId: `${records[0]!.validatorId}:1:v1`,
      validatorId: records[0]!.validatorId,
      epoch: 1n,
      height: 8n,
      expectedVotes: 1n,
      validSignedVotes: 1n,
      missedVotes: 0n,
      proposalAssignments: 0n,
      validProposals: 0n,
      activeVotingPower: 1n,
      epochMember: true,
      policyVersion: 1,
    });
    engine.settleEpochRewards(1n);
    engine.applyPenalty(validEvidence(records[1]!.validatorId, 'ev_b'));
    const report = engine.reconcile();
    assert.equal(report.balancingEntries, false);
    assert.equal(report.balanced, true);
    assert.equal(report.paidRewards + report.remainder, 100n);
  });

  it('runs the required economic simulator scenarios', () => {
    const report = runValidatorEconomicsSimulation('development');
    assert.equal(report.scenarios.length, 10);
    assert.equal(report.allPassed, true);
    assert.equal(report.guaranteedEconomicSecurity, false);
    assert.equal(report.fixtureUnits, true);
  });

  it('rehearses seven bonded validators with jail, penalty, unbond, and supply reconciliation', () => {
    const engine = new ValidatorEconomicsEngine('rehearsal');
    const records = rehearsalValidatorRecords();
    assert.equal(records.length, 7);
    for (const record of records) {
      engine.registerValidator(record, 2_000_000n);
      assert.equal(
        engine.bond({
          validatorId: record.validatorId,
          quantity: 1_000_000n,
          asset: 'REHEARSAL_SUNREY_COIN',
        }).ok,
        true,
      );
    }
    engine.advanceEpoch();
    for (const record of records) {
      engine.recordParticipation({
        entitlementId: `${record.validatorId}:1:v1`,
        validatorId: record.validatorId,
        epoch: 1n,
        height: 8n,
        expectedVotes: 10n,
        validSignedVotes: 10n,
        missedVotes: 0n,
        proposalAssignments: 0n,
        validProposals: 0n,
        activeVotingPower: 1n,
        epochMember: true,
        policyVersion: 1,
      });
    }
    engine.ingestFeeAllocation(700n);
    assert.equal(engine.settleEpochRewards(1n).ok, true);
    assert.equal(engine.applyPenalty(validEvidence(records[0]!.validatorId, 'ev_rehearsal')).ok, true);
    assert.equal(engine.getBond(records[0]!.validatorId)?.state, 'JAILED');
    assert.equal(engine.requestUnbond(records[1]!.validatorId).ok, true);
    const immediate = engine.releaseUnbond(records[1]!.validatorId);
    assert.equal(immediate.ok, false);
    engine.advanceEpoch();
    engine.advanceEpoch();
    assert.equal(engine.releaseUnbond(records[1]!.validatorId).ok, true);
    const reconciliation = engine.reconcile();
    assert.equal(reconciliation.balanced, true);
    assert.equal(engine.policy().bond.bondAssetStatus, 'REHEARSAL_FIXTURE');
  });

  it('leaves production parameters unconfigured', () => {
    const engine = new ValidatorEconomicsEngine('production');
    const record = fixtureValidatorRecord({ label: 'P' });
    engine.registerValidator(record, 1_000_000n);
    const bonded = engine.bond({
      validatorId: record.validatorId,
      quantity: 1_000_000n,
      asset: 'DEVELOPMENT_SUNREY_COIN',
    });
    assert.equal(bonded.ok, false);
    if (!bonded.ok) {
      assert.equal(bonded.error.code, 'PRODUCTION_BOND_ASSET_UNCONFIGURED');
    }
    assert.equal(engine.policy().bond.bondAsset, 'UNCONFIGURED');
    assert.equal(engine.policy().bond.minimumBond, 'UNCONFIGURED');
    assert.equal(engine.policy().bond.productionParametersConfigured, false);
  });

  it('rejects AI economic approval', () => {
    const engine = new ValidatorEconomicsEngine('development');
    const next = createEconomicPolicy('development', 2, 1n, 8n);
    const refused = engine.authorizePolicy(next, AI_POLICY_ACTOR);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'AI_CANNOT_AUTHORIZE_ECONOMICS');
    }
  });
});
