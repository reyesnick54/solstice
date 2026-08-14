import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ChainReference,
  PERMITTED_CHAIN_REFERENCE_KINDS,
  SimulatedChain,
  type ChainReferenceHasNoRawFields,
} from './index.ts';

describe('ChainReference', () => {
  it('is constructible only via the five permitted factories', () => {
    const hash = ChainReference.hash('ab'.repeat(32));
    assert.equal(hash.kind, 'HASH');
    assert.equal(ChainReference.proofIdentifier('poc_1').kind, 'PROOF_IDENTIFIER');
    assert.equal(ChainReference.consentReference('consent_1').kind, 'CONSENT_REFERENCE');
    assert.equal(ChainReference.settlementEvent('settle_1').kind, 'SETTLEMENT_EVENT');
    assert.equal(ChainReference.provenanceIdentifier('prov_1').kind, 'PROVENANCE_IDENTIFIER');
    assert.deepEqual([...PERMITTED_CHAIN_REFERENCE_KINDS], [
      'HASH',
      'PROOF_IDENTIFIER',
      'CONSENT_REFERENCE',
      'SETTLEMENT_EVENT',
      'PROVENANCE_IDENTIFIER',
    ]);
    const noRaw: ChainReferenceHasNoRawFields = true;
    assert.equal(noRaw, true);
    assert.equal('raw' in hash, false);
    assert.equal('data' in hash, false);
    assert.equal('record' in hash, false);
  });

  it('rejects a non-hex hash and a record-like identifier', () => {
    assert.throws(() => ChainReference.hash('not-a-hash'));
    assert.throws(() => ChainReference.proofIdentifier('{"wellness":true}'));
    assert.throws(() => ChainReference.consentReference('has space'));
  });

  it('refuses submit of a non-ChainReference value', () => {
    const chain = new SimulatedChain();
    assert.throws(() => {
      chain.submit({ kind: 'RAW_RECORD', value: 'secret' } as never);
    });
    const tx = chain.submit(ChainReference.hash('cd'.repeat(32)));
    assert.equal(tx.reference.kind, 'HASH');
    assert.equal(chain.confirm(tx.txId).status, 'CONFIRMED');
  });
});
