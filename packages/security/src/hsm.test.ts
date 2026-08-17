import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SUITE_SUNREY_ED25519_V1, SUITE_SUNREY_MLDSA_65_V1 } from './crypto-suite.ts';
import { negotiateSuiteCapability } from './hsm-kms.ts';
import { createDevelopmentHsmSimulator } from './hsm-simulator.ts';

describe('development HSM simulator', () => {
  it('refuses private material extraction and wrong purpose or suite', () => {
    const hsm = createDevelopmentHsmSimulator();
    const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    if (generated.ok !== true) {
      throw new Error('generate failed');
    }
    assert.equal(generated.value.exportable, false);
    assert.equal('extractPrivateKey' in hsm, false);
    assert.equal('exportKey' in hsm, false);
    assert.equal(hsm.capabilities().privateMaterialExportSupported, false);

    const wrongPurpose = hsm.generateKey({ purpose: 'VALIDATOR_CONSENSUS_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    assert.equal(wrongPurpose.ok, false);
    if (wrongPurpose.ok) {
      throw new Error('wrong purpose must fail');
    }
    assert.equal(wrongPurpose.error.code, 'PURPOSE_MISMATCH');

    const pq = negotiateSuiteCapability(hsm.capabilities(), 'PQ_SUPPORTED');
    assert.equal(pq.ok, false);
    if (pq.ok) {
      throw new Error('PQ must not silently succeed');
    }
    assert.equal(pq.error.code, 'DOWNGRADE_REJECTED');

    const wrongSuite = hsm.signCanonicalDigest({
      handle: generated.value,
      digest: Buffer.from('aa'.repeat(32), 'hex'),
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_MLDSA_65_V1,
    });
    assert.equal(wrongSuite.ok, false);

    const disabled = hsm.disableKey(generated.value);
    if (disabled.ok !== true) {
      throw new Error('disable failed');
    }
    const afterDisable = hsm.signCanonicalDigest({
      handle: disabled.value,
      digest: Buffer.from('bb'.repeat(32), 'hex'),
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    assert.equal(afterDisable.ok, false);
  });

  it('rotates a handle without exporting material', () => {
    const hsm = createDevelopmentHsmSimulator();
    const first = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    if (first.ok !== true) {
      throw new Error('generate failed');
    }
    const rotated = hsm.rotateKey(first.value);
    if (rotated.ok !== true) {
      throw new Error('rotate failed');
    }
    assert.equal(rotated.value.keyVersion, 2);
    assert.equal(rotated.value.exportable, false);
    const attestation = hsm.getAttestationMetadata(rotated.value);
    if (attestation.ok !== true) {
      throw new Error('attestation failed');
    }
    assert.equal(attestation.value.simulation, true);
    assert.equal(attestation.value.exportable, false);
  });
});
