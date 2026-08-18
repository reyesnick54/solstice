import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT } from '../packages/config/src/flags.ts';
import { qualifyPregenesisNetwork } from '../packages/sunrey-chain/src/pregenesis/qualify.ts';
import { PREGENESIS_NETWORK_ID } from '../packages/sunrey-chain/src/pregenesis/identity.ts';

describe('Chunk 87 exit criteria', () => {
  it('qualifies an isolated production-like shadow network without authorizing mainnet', () => {
    const session = qualifyPregenesisNetwork({ profile: 'bounded' });
    assert.equal(session.report.network.networkId, PREGENESIS_NETWORK_ID);
    assert.equal(session.report.network.usableAsProductionAuthorization, false);
    assert.equal(session.report.topology.validators, 7);
    assert.equal(session.report.bindings.mainnetRcId, 'SUNREY_MAINNET_RC_1');
    assert.ok(session.report.bindings.candidateV2RootHash.length > 0);
    assert.equal(session.report.consensus.converged, true);
    assert.equal(session.report.readiness.authorizesMainnet, false);
    assert.equal(session.report.readiness.humanStatus, 'NOT_PROVIDED');
    assert.equal(session.report.mainnetEnabled, false);
    assert.equal(session.report.productionAuthorized, false);
    assert.equal(ENVIRONMENT, 'simulation');
  });
});
