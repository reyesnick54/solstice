/**
 * Wave 3 — simulation policy fixtures for v1/v2 separation tests.
 */

import { buildGovernanceDecisionRef } from './governance.ts';
import { buildPolicyDefinition } from './definition.ts';
import { gpuvMethodologyRef, humanValuationMethodologyRef, peveMethodologyRef } from './methodology.ts';
import type { GovernanceDecisionRef, PolicyDefinition } from './types.ts';

export const SIMULATION_GOVERNANCE_V1 = buildGovernanceDecisionRef({
  decisionId: 'gov.sim.policy-activation.v1',
  governancePolicyVersion: 1,
  evidenceReferences: ['evidence.sim.governance.policy.v1'],
  authorizedAtHeight: 1,
  actorKind: 'HUMAN_GOVERNANCE',
});

export const SIMULATION_GOVERNANCE_V2 = buildGovernanceDecisionRef({
  decisionId: 'gov.sim.policy-activation.v2',
  governancePolicyVersion: 1,
  evidenceReferences: ['evidence.sim.governance.policy.v2'],
  authorizedAtHeight: 100,
  actorKind: 'PROTOCOL_GOVERNANCE',
});

export function sunreyValuationPolicyV1(governance: GovernanceDecisionRef = SIMULATION_GOVERNANCE_V1): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'sunrey.valuation.methodology.simulation',
    policyType: 'VALUATION_METHODOLOGY',
    version: 1,
    economy: 'SUNREY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'docs/economics/chunk-110-valuation-constitution.md',
    governanceAuthorizationRef: governance,
    methodologyRefs: [
      peveMethodologyRef('FORMULA_V1', 'packages/platform/src/value/formula.ts#FORMULA_V1'),
      humanValuationMethodologyRef('1', 'packages/human-economic-contribution/src/valuation/policy.ts'),
    ],
  });
}

export function sunreyValuationPolicyV2(governance: GovernanceDecisionRef = SIMULATION_GOVERNANCE_V2): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'sunrey.valuation.methodology.simulation',
    policyType: 'VALUATION_METHODOLOGY',
    version: 2,
    economy: 'SUNREY',
    effectiveFrom: '2026-06-01T00:00:00.000Z',
    documentRef: 'docs/economics/chunk-110-valuation-constitution.md',
    supersedes: { policyId: 'sunrey.valuation.methodology.simulation', version: 1 },
    governanceAuthorizationRef: governance,
    methodologyRefs: [
      peveMethodologyRef('FORMULA_V2', 'packages/platform/src/value/formula.ts#FORMULA_V2'),
      humanValuationMethodologyRef('2', 'packages/human-economic-contribution/src/valuation/policy.ts'),
    ],
  });
}

export function moonreyGpuvPolicyV1(governance: GovernanceDecisionRef = SIMULATION_GOVERNANCE_V1): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'moonrey.gpuv.methodology.simulation',
    policyType: 'VALUATION_METHODOLOGY',
    version: 1,
    economy: 'MOONREY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'docs/economics/chunk-124-moonrey-productive-value-engine.md',
    governanceAuthorizationRef: governance,
    methodologyRefs: [
      gpuvMethodologyRef(1, 'packages/sunrey-chain/src/productive/policy-governance/value-function/policy.ts'),
    ],
  });
}

export function moonreyIssuancePolicyV1(governance: GovernanceDecisionRef = SIMULATION_GOVERNANCE_V1): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'moonrey.issuance.policy.simulation',
    policyType: 'MONETARY_ISSUANCE_POLICY',
    version: 1,
    economy: 'PROTOCOL',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'docs/economics/chunk-74-moonrey-issuance-policy.md',
    governanceAuthorizationRef: governance,
    methodologyRefs: [],
  });
}

export function verificationPolicyV1(): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'protocol.verification.policy.simulation',
    policyType: 'VERIFICATION_POLICY',
    version: 1,
    economy: 'PROTOCOL',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'packages/human-economic-contribution/src/verification/policy.ts',
    governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
  });
}

/** Cross-economy violation fixture: SunRey policy referencing MoonRey GPUV methodology. */
export function invalidSunreyWithMoonreyMethodology(): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'sunrey.invalid.cross-economy',
    policyType: 'VALUATION_METHODOLOGY',
    version: 99,
    economy: 'SUNREY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'fixture/invalid-cross-economy',
    governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
    methodologyRefs: [
      gpuvMethodologyRef(1, 'packages/sunrey-chain/src/productive/policy-governance/value-function/policy.ts'),
    ],
  });
}

/** Cross-economy violation fixture: MoonRey policy referencing SunRey PEVE methodology. */
export function invalidMoonreyWithSunreyMethodology(): PolicyDefinition {
  return buildPolicyDefinition({
    policyId: 'moonrey.invalid.cross-economy',
    policyType: 'VALUATION_METHODOLOGY',
    version: 99,
    economy: 'MOONREY',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    documentRef: 'fixture/invalid-cross-economy',
    governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
    methodologyRefs: [peveMethodologyRef('FORMULA_V1', 'packages/platform/src/value/formula.ts#FORMULA_V1')],
  });
}
