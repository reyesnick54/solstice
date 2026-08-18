import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { FORMAL_MODEL_IDS } from '../packages/sunrey-chain/src/formal/types.ts';
import { runGovernanceOpsCommand } from '../packages/sunrey-chain/src/governance-ops/cli.ts';
import {
  rehearseFeePolicyChange,
  rehearseMoonReyPolicyChange,
  rehearseOracleCompromiseEmergency,
  rehearseTreasuryBudgetChange,
} from '../packages/sunrey-chain/src/governance-ops/rehearsals.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 79 exit criteria', () => {
  it('implements production governance operations without a governance token', () => {
    const fee = rehearseFeePolicyChange();
    assert.equal(fee.package.governanceToken, false);
    assert.equal(fee.package.aiMayVote, false);
    assert.equal(fee.package.mayRewriteFinalizedHistory, false);
    assert.equal(fee.activated, true);
    assert.equal(fee.binaryDidNotActivate, true);
    const moonrey = rehearseMoonReyPolicyChange();
    assert.equal(moonrey.oldContributionUsedOldPolicy, true);
    assert.equal(moonrey.newContributionUsedNewPolicy, true);
    const treasury = rehearseTreasuryBudgetChange();
    assert.equal(treasury.newBudgetUnderNewVersion, true);
    const emergency = rehearseOracleCompromiseEmergency();
    assert.equal(emergency.authorized, true);
    assert.equal(emergency.scopeNarrow, true);
    assert.equal(emergency.supplyRewritten, false);
    assert.equal(FORMAL_MODEL_IDS.includes('GOVERNANCE_OPERATION_SAFETY'), true);
  });

  it('exposes the governance operations CLI', () => {
    const help = runGovernanceOpsCommand(['unknown']);
    assert.match(String(help.payload && typeof help.payload === 'object' && 'usage' in help.payload ? help.payload.usage : ''), /preflight/);
    assert.equal(runGovernanceOpsCommand(['diff']).ok, true);
  });

  it('publishes the required documentation and forbids alias packages', () => {
    for (const relative of [
      'docs/governance/chunk-79-production-governance-operations.md',
      'docs/governance/economic-policy-changes.md',
      'docs/governance/governance-preflight.md',
      'docs/governance/emergency-authority.md',
      'docs/governance/post-activation-verification.md',
      'docs/runbooks/economic-policy-activation.md',
      'docs/runbooks/economic-emergency-action.md',
      'docs/architecture/chunk-79-governance-operations.md',
      'docs/architecture/chunks/chunk-79-governance-operations.json',
      'packages/sunrey-chain/src/governance-ops/index.ts',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/governance-ops')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-governance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/governance-token')), false);
  });
});
