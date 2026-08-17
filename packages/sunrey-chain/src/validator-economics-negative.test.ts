import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AI_POLICY_ACTOR,
  HUMAN_GOVERNANCE_ACTOR,
  ValidatorEconomicsEngine,
  createEconomicPolicy,
  fixtureValidatorRecord,
} from './validator-economics/index.ts';
import type { ProtocolEvidence } from './validator-economics/index.ts';

function seed() {
  const engine = new ValidatorEconomicsEngine('development');
  const record = fixtureValidatorRecord({ label: 'A' });
  engine.registerValidator(record, 5_000_000n);
  engine.bond({ validatorId: record.validatorId, quantity: 1_000_000n, asset: 'DEVELOPMENT_SUNREY_COIN' });
  engine.advanceEpoch();
  return { engine, record };
}

function evidence(validatorId: string, overrides: Partial<ProtocolEvidence> = {}): ProtocolEvidence {
  return {
    evidenceId: 'ev_neg_1',
    violationClass: 'DOUBLE_PRECOMMIT',
    validatorId,
    height: 8n,
    round: 1n,
    leftHash: 'a',
    rightHash: 'b',
    signatureA: 'sa',
    signatureB: 'sb',
    verified: true,
    forged: false,
    monitoringSuspicionOnly: false,
    ...overrides,
  };
}

describe('Chunk 72 validator economics negative tests', () => {
  it('makes customer-asset penalties impossible', () => {
    const { engine } = seed();
    engine.markCustomerAccount('cust_wallet_1', 'CUSTOMER_WALLET', 9_000n);
    engine.markCustomerAccount('custody_1', 'CUSTODY_CUSTOMER', 8_000n);
    engine.markCustomerAccount('exch_1', 'EXCHANGE_CUSTOMER', 7_000n);
    engine.markCustomerAccount('fiat_1', 'FIAT_LEDGER', 6_000n);
    engine.markCustomerAccount('machine_1', 'MACHINE_ESCROW', 5_000n);
    for (const id of ['cust_wallet_1', 'custody_1', 'exch_1', 'fiat_1', 'machine_1']) {
      const refused = engine.debitCustomer(id, 1n);
      assert.equal(refused.ok, false);
      if (!refused.ok) {
        assert.equal(refused.error.code, 'CUSTOMER_ASSET_ISOLATION');
      }
    }
    assert.equal(engine.customerBalance('cust_wallet_1'), 9_000n);
    assert.equal(engine.customerBalance('fiat_1'), 6_000n);
  });

  it('rejects invalid evidence', () => {
    const { engine, record } = seed();
    const refused = engine.applyPenalty(evidence(record.validatorId, { verified: false, leftHash: 'same', rightHash: 'same' }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'INVALID_EVIDENCE');
    }
  });

  it('rejects forged evidence', () => {
    const { engine, record } = seed();
    const refused = engine.applyPenalty(evidence(record.validatorId, { forged: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'FORGED_EVIDENCE');
    }
  });

  it('rejects replayed evidence', () => {
    const { engine, record } = seed();
    assert.equal(engine.applyPenalty(evidence(record.validatorId)).ok, true);
    const replay = engine.applyPenalty(evidence(record.validatorId));
    assert.equal(replay.ok, false);
    if (!replay.ok) {
      assert.equal(replay.error.code, 'DUPLICATE_PENALTY');
    }
  });

  it('rejects duplicate rewards', () => {
    const { engine, record } = seed();
    const participation = {
      entitlementId: `${record.validatorId}:1:v1`,
      validatorId: record.validatorId,
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
    };
    assert.equal(engine.recordParticipation(participation).ok, true);
    const duplicate = engine.recordParticipation(participation);
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'DUPLICATE_REWARD');
    }
  });

  it('rejects immediate unbond', () => {
    const { engine, record } = seed();
    assert.equal(engine.requestUnbond(record.validatorId).ok, true);
    const immediate = engine.releaseUnbond(record.validatorId);
    assert.equal(immediate.ok, false);
    if (!immediate.ok) {
      assert.equal(immediate.error.code, 'IMMEDIATE_UNBOND_REJECTED');
    }
  });

  it('rejects the wrong bond asset', () => {
    const engine = new ValidatorEconomicsEngine('development');
    const record = fixtureValidatorRecord({ label: 'B' });
    engine.registerValidator(record, 2_000_000n);
    const refused = engine.bond({
      validatorId: record.validatorId,
      quantity: 1_000_000n,
      asset: 'REHEARSAL_SUNREY_COIN',
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'WRONG_BOND_ASSET');
    }
  });

  it('rejects unauthorized policy updates', () => {
    const engine = new ValidatorEconomicsEngine('development');
    const next = createEconomicPolicy('development', 2, 1n, 8n);
    const refused = engine.authorizePolicy(next, {
      actorId: 'human_no_gov',
      kind: 'HUMAN',
      role: 'OBSERVER',
      governanceAuthorized: false,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'UNAUTHORIZED_POLICY_UPDATE');
    }
    assert.equal(engine.authorizePolicy(next, HUMAN_GOVERNANCE_ACTOR).ok, true);
  });

  it('rejects AI economic approval', () => {
    const engine = new ValidatorEconomicsEngine('development');
    const refused = engine.authorizePolicy(createEconomicPolicy('development', 2, 1n, 8n), AI_POLICY_ACTOR);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'AI_CANNOT_AUTHORIZE_ECONOMICS');
    }
  });

  it('rejects monitoring suspicion as a protocol penalty', () => {
    const { engine, record } = seed();
    const refused = engine.applyPenalty(evidence(record.validatorId, { monitoringSuspicionOnly: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'MONITORING_SUSPICION_INSUFFICIENT');
    }
  });
});
