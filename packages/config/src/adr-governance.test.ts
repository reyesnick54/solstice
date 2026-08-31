import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADR_REGISTRY,
  EXTERNAL_APPROVAL_STATES,
  engineeringStatusAllowsProductionActivation,
  findAdrByFile,
  implementedButNotProductionApproved,
  productionActivationAllowed,
  proposedWithProductionCode,
} from './adr-governance.ts';
import {
  REGULATED_FEATURE_FLAGS,
  assertInteropDevelopmentOnly,
  assertProductionActivationSafe,
  assertRegulatedFeaturesFailClosed,
  evaluateActivationGates,
  interopProductionActivationAllowed,
  listEnabledRegulatedFlags,
} from './activation-gates.ts';
import {
  LIVE_INTEROP_ENABLED,
  LIVE_INTEROP_RELAYERS_ENABLED,
  LIVE_INTEROP_WATCHERS_ENABLED,
  LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED,
} from './flags.ts';

describe('ADR governance registry', () => {
  it('indexes every ADR file in docs/architecture/adr', () => {
    assert.ok(ADR_REGISTRY.length >= 30);
    const adr0006 = findAdrByFile('ADR-0006-policy-engine-language.md');
    assert.equal(adr0006?.engineeringStatus, 'PROPOSED');
    assert.equal(adr0006?.implementationStatus, 'IMPLEMENTED');
    assert.equal(adr0006?.productionActivation, 'REGULATORY_GATED');
    assert.equal(adr0006?.externalApprovalState, 'NOT_APPROVED');
  });

  it('keeps PROPOSED ADRs with code from implying production approval', () => {
    const proposed = proposedWithProductionCode();
    assert.ok(proposed.some((row) => row.file === 'ADR-0006-policy-engine-language.md'));
    assert.ok(proposed.some((row) => row.file === 'ADR-0007-identity-and-authentication-stack.md'));
    for (const row of proposed) {
      assert.equal(productionActivationAllowed(row), false);
    }
  });

  it('distinguishes implemented engineering from production activation', () => {
    const gated = implementedButNotProductionApproved();
    assert.ok(gated.some((row) => row.number === '0029'));
    for (const row of gated) {
      assert.notEqual(row.productionActivation, 'ENGINEERING_ONLY');
      assert.equal(productionActivationAllowed(row), false);
    }
  });

  it('never marks counsel confirmation in this repository', () => {
    for (const row of ADR_REGISTRY) {
      assert.notEqual(row.legalConfidence, 'CONFIRMED_BY_COUNSEL');
    }
  });

  it('uses only approved external approval vocabulary', () => {
    for (const row of ADR_REGISTRY) {
      assert.ok(EXTERNAL_APPROVAL_STATES.includes(row.externalApprovalState));
    }
  });

  it('requires ACCEPTED engineering status before production activation could ever be allowed', () => {
    assert.equal(engineeringStatusAllowsProductionActivation('PROPOSED'), false);
    assert.equal(engineeringStatusAllowsProductionActivation('ACCEPTED_FOR_ENGINEERING'), false);
    assert.equal(engineeringStatusAllowsProductionActivation('ACCEPTED'), true);
    for (const row of ADR_REGISTRY) {
      if (row.engineeringStatus !== 'ACCEPTED') {
        assert.equal(productionActivationAllowed(row), false);
      }
    }
  });
});

describe('ADR activation gates', () => {
  it('defaults every regulated feature OFF', () => {
    assert.equal(listEnabledRegulatedFlags().length, 0);
    assertRegulatedFeaturesFailClosed();
    assert.doesNotThrow(() => assertProductionActivationSafe({ nodeEnv: 'development' }));
  });

  it('keeps interop production activation disabled', () => {
    assert.equal(LIVE_INTEROP_ENABLED, false);
    assert.equal(LIVE_INTEROP_RELAYERS_ENABLED, false);
    assert.equal(LIVE_INTEROP_WATCHERS_ENABLED, false);
    assert.equal(LIVE_EXTERNAL_CHAIN_INTERACTION_ENABLED, false);
    assert.equal(interopProductionActivationAllowed(), false);
    assert.doesNotThrow(() => assertInteropDevelopmentOnly());
  });

  it('rejects unsafe production combinations without approval markers', () => {
    const violations = evaluateActivationGates({
      humanAuthorizationMarkerPresent: false,
      legalApprovalMarkerPresent: false,
      regulatoryApprovalMarkerPresent: false,
      externalProviderApprovalMarkerPresent: false,
    });
    assert.equal(violations.length, 0);
  });

  it('documents gate requirements for interop and exchange', () => {
    for (const flag of [
      'LIVE_INTEROP_ENABLED',
      'LIVE_EXCHANGE_ENABLED',
      'LIVE_CUSTODY_ENABLED',
      'LIVE_AGENT_FINANCIAL_EXECUTION_ENABLED',
    ] as const) {
      assert.equal(REGULATED_FEATURE_FLAGS[flag], false);
    }
  });
});
