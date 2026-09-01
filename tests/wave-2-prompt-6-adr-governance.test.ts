import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADR_REGISTRY,
  findAdrByFile,
  productionActivationAllowed,
} from '../packages/config/src/adr-governance.ts';
import {
  assertInteropDevelopmentOnly,
  assertRegulatedFeaturesFailClosed,
} from '../packages/config/src/activation-gates.ts';
import { assertSimulationOnly } from '../packages/config/src/flags.ts';
import { InteropEngine, developmentExternalChain } from '../packages/sunrey-chain/src/interop/index.ts';

describe('Wave 2 Prompt 6 — ADR governance and activation controls', () => {
  it('ADR-0006 remains PROPOSED with simulation-only policy engine', () => {
    const adr = findAdrByFile('ADR-0006-policy-engine-language.md');
    assert.ok(adr);
    assert.equal(adr.engineeringStatus, 'PROPOSED');
    assert.equal(adr.legalApprovalRequired, true);
    assert.equal(adr.regulatoryApprovalRequired, true);
    assert.equal(adr.implementationStatus, 'IMPLEMENTED');
    assert.equal(productionActivationAllowed(adr), false);
  });

  it('ADR-0007 remains PROPOSED with partial identity implementation', () => {
    const adr = findAdrByFile('ADR-0007-identity-and-authentication-stack.md');
    assert.ok(adr);
    assert.equal(adr.engineeringStatus, 'PROPOSED');
    assert.equal(adr.externalProviderApprovalRequired, true);
    assert.equal(adr.implementationStatus, 'PARTIAL');
    assert.equal(adr.externalApprovalState, 'EXTERNAL_APPROVAL_REQUIRED');
    assert.equal(productionActivationAllowed(adr), false);
  });

  it('ADR-0029 interop is engineered but production-gated', () => {
    const adr = findAdrByFile('ADR-0029-sunrey-blockchain-interoperability.md');
    assert.ok(adr);
    assert.equal(adr.engineeringStatus, 'ACCEPTED_FOR_ENGINEERING');
    assert.equal(adr.implementationStatus, 'IMPLEMENTED');
    assert.equal(adr.productionActivation, 'REGULATORY_GATED');
    assert.equal(productionActivationAllowed(adr), false);
  });

  it('simulation posture and regulated features stay fail-closed', () => {
    assertSimulationOnly();
    assertRegulatedFeaturesFailClosed();
    assertInteropDevelopmentOnly();
  });

  it('development interop engine still works under simulation gates', () => {
    const engine = new InteropEngine();
    const chain = developmentExternalChain();
    engine.registerChain(chain, 'GOVERNANCE');
    engine.activateChain(chain.externalChainId, 'GOVERNANCE');
    assert.equal(engine.chains.get(chain.externalChainId)?.status, 'ACTIVE_DEVELOPMENT');
  });

  it('registry covers all ADR markdown files except README and lifecycle doc', () => {
    const files = new Set(ADR_REGISTRY.map((row) => row.file));
    assert.ok(files.has('ADR-0006-policy-engine-language.md'));
    assert.ok(files.has('ADR-0034-sunrey-access-fabric.md'));
    assert.equal(files.has('README.md'), false);
  });
});
