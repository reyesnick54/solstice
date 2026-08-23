import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import {
  ACTIVE_DEPLOYABLE_NETWORK,
  MAINNET_INACTIVE,
  PHASE_G_03_RUNTIME,
  mainnetGenesisFailsClosed,
} from '../packages/sunrey-chain/src/runtime/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Phase G Prompt 3 SunRey chain runtime', () => {
  it('keeps production disabled', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(MAINNET_INACTIVE, true);
    assert.equal(ACTIVE_DEPLOYABLE_NETWORK, 'TESTNET');
    assert.equal(PHASE_G_03_RUNTIME.replacedByEthereumOrEvm, false);
    assert.equal(mainnetGenesisFailsClosed(), true);
  });

  it('extends the canonical chain owner', () => {
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/runtime/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/rust/crates/consensus/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/node/src/lib.rs')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-explorer/src/api.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/blockchain')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-node')), false);
    assert.equal(existsSync(join(ROOT, 'packages/tendermint')), false);
    assert.equal(existsSync(join(ROOT, 'packages/validator-operator')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-rpc')), false);
  });

  it('documents the runtime and validator operator guide', () => {
    const runtime = readFileSync(
      join(ROOT, 'docs/productization/PHASE_G_03_SUNREY_CHAIN_RUNTIME.md'),
      'utf8',
    );
    assert.match(runtime, /SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_4=true/);
    assert.match(runtime, /PRODUCTION_READY=false/);
    assert.match(runtime, /COMMIT_CERTIFICATE/);
    assert.match(runtime, /PUBLIC_RPC/);
    const guide = readFileSync(
      join(ROOT, 'docs/productization/SUNREY_VALIDATOR_OPERATOR_GUIDE.md'),
      'utf8',
    );
    assert.match(guide, /REGISTERED/);
    assert.match(guide, /PENDING_ACTIVATION/);
    assert.match(guide, /mainnet remains inactive/i);
  });
});
