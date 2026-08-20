import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FixtureTravelRuleCandidate,
  fixtureTravelRuleProfile,
} from './provider-candidate/index.ts';

describe('CHUNK-152 Travel Rule provider-candidate', () => {
  it('20-22. encrypts payloads, keeps them off-chain, and does not authorize withdrawal', () => {
    const candidate = new FixtureTravelRuleCandidate();
    const prepared = candidate.prepare({
      messageId: 'trm-1',
      withdrawalId: 'wd-1',
      recipientBinding: 'vasp:counterparty-a',
      originatorRef: 'originator-ref',
      beneficiaryRef: 'beneficiary-ref',
      amountMinor: '10000',
      currency: 'USD',
    });
    if ('ok' in prepared) {
      throw new Error('prepare failed');
    }
    assert.ok(prepared.envelope.ciphertext.length > 0);
    assert.notEqual(prepared.envelope.ciphertext.includes('originator-ref'), true);
    assert.equal(prepared.publicChainContainsRawPii, false);
    assert.equal(prepared.loggedPlaintext, false);
    assert.equal(candidate.payloadOnChain(), false);
    const submitted = candidate.submit('trm-1');
    const ack = candidate.acknowledge({ messageId: 'trm-1', recipientBinding: 'vasp:counterparty-a' });
    if ('ok' in ack) {
      throw new Error('ack failed');
    }
    assert.equal(ack.acknowledged, true);
    assert.equal(ack.authorizesWithdrawal, false);
    assert.equal(candidate.travelRuleAckAuthorizesWithdrawal(), false);
    assert.equal(submitted.authorizesWithdrawal, false);
    assert.equal(fixtureTravelRuleProfile().liveNetworkConnected, false);
    assert.equal(fixtureTravelRuleProfile().productionAuthorized, false);
  });

  it('rejects Travel Rule duplicates, wrong recipients, and payload leaks', () => {
    const candidate = new FixtureTravelRuleCandidate();
    const first = candidate.prepare({
      messageId: 'trm-dup',
      withdrawalId: 'wd-2',
      recipientBinding: 'vasp:right',
      originatorRef: 'originator-ref',
      beneficiaryRef: 'beneficiary-ref',
      amountMinor: '1',
      currency: 'USD',
    });
    if ('ok' in first) {
      throw new Error('first prepare failed');
    }
    const duplicate = candidate.prepare({
      messageId: 'trm-dup',
      withdrawalId: 'wd-2',
      recipientBinding: 'vasp:right',
      originatorRef: 'originator-ref',
      beneficiaryRef: 'beneficiary-ref',
      amountMinor: '1',
      currency: 'USD',
    });
    assert.equal('ok' in duplicate && duplicate.ok === false && duplicate.reasonCode === 'DUPLICATE_TRAVEL_RULE', true);
    const wrong = candidate.acknowledge({ messageId: 'trm-dup', recipientBinding: 'vasp:wrong' });
    assert.equal('ok' in wrong && wrong.ok === false && wrong.reasonCode === 'WRONG_RECIPIENT', true);
    assert.equal(JSON.stringify(first).includes('originator-ref'), false);
    assert.equal(candidate.asSimulationPort().mode, 'SIMULATION_ONLY');
  });
});
