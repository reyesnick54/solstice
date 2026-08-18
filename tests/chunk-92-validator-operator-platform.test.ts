import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../packages/config/src/flags.ts';
import {
  CANONICAL_VALIDATOR_SET_AUTHORITATIVE,
  NO_PUBLIC_DELEGATED_STAKING,
  ValidatorOperatorPlatform,
  runValidatorOperatorRehearsal,
} from '../packages/sunrey-chain/src/validator-operator/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 92 validator operator platform exit criteria', () => {
  it('ships the operator platform without a second registry or staking product', () => {
    assert.equal(existsSync(join(ROOT, 'docs/validators/chunk-92-validator-operator-platform.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/validator-operator/index.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/validator-operator')), false);
    assert.equal(existsSync(join(ROOT, 'packages/delegated-staking')), false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(CANONICAL_VALIDATOR_SET_AUTHORITATIVE, true);
    assert.equal(NO_PUBLIC_DELEGATED_STAKING, true);
    const platform = new ValidatorOperatorPlatform();
    assert.equal(platform.nodes.filter((row) => row.kind === 'VALIDATOR').length, 7);
    const rehearsal = runValidatorOperatorRehearsal();
    assert.equal(rehearsal.ok, true);
    assert.equal(rehearsal.observedProduction, false);
  });
});
