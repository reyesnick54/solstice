import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createLocalTestPqSigningProvider, createDevelopmentHsmSimulator } from '../../../security/src/index.ts';
import { HsmBackedSigningProvider, negotiateInstitutionalPqCapability } from './signing.ts';

describe('institutional REAL_PQ_SUPPORTED', () => {
  it('advertises REAL_PQ_SUPPORTED only for the local/test provider', () => {
    const local = new HsmBackedSigningProvider('LOCAL_DEVELOPMENT', createLocalTestPqSigningProvider());
    const sim = new HsmBackedSigningProvider('HSM', createDevelopmentHsmSimulator());
    const localCaps = negotiateInstitutionalPqCapability(local);
    const simCaps = negotiateInstitutionalPqCapability(sim);
    assert.equal(localCaps.realPqSupported, true);
    assert.equal(localCaps.externalHsmPqSupported, false);
    assert.ok(localCaps.flags.includes('REAL_PQ_SUPPORTED'));
    assert.equal(simCaps.realPqSupported, false);
    assert.equal(simCaps.externalHsmPqSupported, false);
  });
});
