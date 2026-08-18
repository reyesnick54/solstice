import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runNegativeActivationSuite, runPostGenesisRehearsal, runStabilizationCommand } from '../packages/sunrey-chain/src/post-genesis/index.ts';

describe('Chunk 89 post-genesis repository checks', () => {
  it('keeps rehearsal activations off real production', () => {
    const rehearsal = runPostGenesisRehearsal('healthy-first-epochs');
    assert.equal(rehearsal.realProductionCapabilitiesActivated, false);
    assert.equal(rehearsal.report.genesisDoesNotEnableCapabilities, true);
    const negatives = runNegativeActivationSuite();
    assert.equal(negatives.exchangeWithoutEvidence.outcome, 'REJECTED');
    const cli = runStabilizationCommand(['stabilization', 'status']);
    assert.equal(cli.ok, true);
  });
});
