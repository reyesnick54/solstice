import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  WAVE3_ECONOMIC_PROOF_CAPABILITY,
  POLICY_TYPES,
  PolicyRegistry,
  sunreyValuationPolicyV1,
  SIMULATION_GOVERNANCE_V1,
} from '../packages/sunrey-chain/src/economic-proof/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Wave 3 — Policy Commitments (integration)', () => {
  it('extends canonical sunrey-chain owner with economic-proof capability', () => {
    assert.equal(WAVE3_ECONOMIC_PROOF_CAPABILITY.owner, 'packages/sunrey-chain');
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/economic-proof/policy/root.ts')), true);
    assert.equal(existsSync(join(ROOT, 'docs/architecture/WAVE3_POLICY_COMMITMENTS.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/economic-proof')), false);
    assert.equal(existsSync(join(ROOT, 'packages/policy-commitments')), false);
  });

  it('defines seven policy categories without parallel owner packages', () => {
    assert.equal(POLICY_TYPES.length, 7);
  });

  it('registers and activates simulation valuation policy with governance binding', () => {
    const registry = new PolicyRegistry();
    const definition = sunreyValuationPolicyV1();
    assert.equal(registry.register(definition), null);
    const activation = registry.proposeActivation({
      policyId: definition.policyId,
      version: definition.version,
      activationHeight: 1,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.test',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(activation.ok, true);
    const commitments = registry.activeCommitmentsAt(1);
    assert.equal(commitments.length, 1);
    assert.equal(commitments[0]?.governanceAuthorizationRef.decisionId, SIMULATION_GOVERNANCE_V1.decisionId);
  });
});
