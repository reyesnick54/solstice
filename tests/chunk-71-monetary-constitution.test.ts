import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { runEconomicsCommand } from '../packages/sunrey-chain/src/economics/cli.ts';
import { nativeAssetConstitution } from '../packages/sunrey-chain/src/economics/constitution.ts';
import { verifyGenesisAllocationManifest } from '../packages/sunrey-chain/src/economics/genesis.ts';
import { requiredScenarios } from '../packages/sunrey-chain/src/economics/simulator.ts';
import { emptyAllocationManifest } from '../packages/sunrey-chain/src/mainnet/allocation.ts';
import { verifyGenesisCandidate, defaultGenesisCandidateInput } from '../packages/sunrey-chain/src/mainnet/genesis-candidate.ts';
import { rehearseNativeAssets } from '../packages/sunrey-chain/src/launch-rehearsal/workflows.ts';

describe('Chunk 71 exit criteria', () => {
  it('ships the economics docs and forbids competing packages', () => {
    assert.equal(existsSync('docs/economics/chunk-71-monetary-constitution.md'), true);
    assert.equal(existsSync('docs/economics/sunrey-coin-policy.md'), true);
    assert.equal(existsSync('docs/economics/moonrey-coin-policy.md'), true);
    assert.equal(existsSync('docs/economics/native-supply-accounting.md'), true);
    assert.equal(existsSync('docs/economics/genesis-allocation-policy.md'), true);
    assert.equal(existsSync('docs/economics/monetary-governance.md'), true);
    assert.equal(existsSync('packages/tokenomics'), false);
  });

  it('keeps production values unconfigured and rehearsal supply isolated', () => {
    const constitution = nativeAssetConstitution('PRODUCTION_CANDIDATE');
    assert.equal(constitution.assets[0]?.supplyConstraints.maximumSupply, 'UNCONFIGURED');
    assert.equal(verifyGenesisAllocationManifest(emptyAllocationManifest()).ok, true);
    const genesis = verifyGenesisCandidate(defaultGenesisCandidateInput());
    assert.equal(genesis.ok, true);
    assert.equal(genesis.checks.some((row) => row.id === 'monetary-constitution' && row.ok), true);
    const rehearsal = rehearseNativeAssets();
    assert.equal(rehearsal.units, 'REHEARSAL_ONLY');
    assert.equal(rehearsal.productionValueClaim, false);
    assert.equal(rehearsal.supplyReconciled, true);
    const scenarios = requiredScenarios();
    assert.equal(Object.values(scenarios).every((row) => row.classification === 'ENGINEERING_SIMULATION'), true);
    assert.equal(runEconomicsCommand(['simulate']).ok, true);
  });
});
