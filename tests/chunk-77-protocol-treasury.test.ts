import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { runEconomicsCommand } from '../packages/sunrey-chain/src/economics/cli.ts';
import { runEconomicsCommand as runDualCommand } from '../packages/sunrey-economics/src/cli.ts';
import { modelTreasuryAcrossEpochs } from '../packages/sunrey-economics/src/treasury.ts';
import { exploreModel, requireVerified } from '../packages/sunrey-chain/src/formal/explore.ts';
import { createProtocolTreasuryModel } from '../packages/sunrey-chain/src/formal/models/protocol-treasury.ts';
import { FORMAL_SMOKE_PROFILE } from '../packages/sunrey-chain/src/formal/profiles.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 77 exit criteria', () => {
  it('implements protocol treasury without a second ledger or alias package', () => {
    for (const relative of [
      'docs/economics/chunk-77-protocol-treasury.md',
      'docs/economics/protocol-reserves.md',
      'docs/economics/treasury-budget-governance.md',
      'docs/economics/treasury-disbursements.md',
      'docs/economics/treasury-reconciliation.md',
      'docs/economics/treasury-simulation.md',
      'docs/architecture/chunk-77-protocol-treasury.md',
      'docs/architecture/chunks/chunk-77-protocol-treasury.json',
      'packages/sunrey-chain/src/economics/treasury/index.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-protocol-treasury')), false);
    assert.equal(existsSync(join(ROOT, 'packages/native-treasury')), false);
    assert.equal(existsSync(join(ROOT, 'packages/reserve-bank')), false);
  });

  it('exposes treasury CLI planes', () => {
    const policy = runEconomicsCommand(['treasury', 'policy']);
    assert.equal(policy.ok, true);
    const verify = runEconomicsCommand(['treasury', 'verify']);
    assert.equal(verify.ok, true);
    const dual = runDualCommand(['treasury', 'policy']);
    assert.match(dual, /sunrey.protocol.treasury/);
  });

  it('model-checks PROTOCOL_TREASURY and models treasury across epochs', () => {
    const result = exploreModel(createProtocolTreasuryModel(FORMAL_SMOKE_PROFILE), 'FORMAL_SMOKE', 'sunrey-formal-explicit-state/1');
    requireVerified(result);
    const horizon = modelTreasuryAcrossEpochs(4, 400n);
    assert.equal(horizon.reconciled, true);
    assert.equal(horizon.productionTreasuryInactive, true);
    assert.ok(horizon.feeTreasuryInflow > 0n);
  });
});
