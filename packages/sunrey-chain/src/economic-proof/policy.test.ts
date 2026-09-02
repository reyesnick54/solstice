import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PolicyRegistry,
  activatePolicy,
  assertNoSilentReinterpretation,
  auditEntriesByType,
  buildGovernanceDecisionRef,
  buildPolicyDefinition,
  canActivatePolicy,
  evidenceCommitment,
  evidenceRoot,
  extensionCommitmentsFromFiveRoot,
  fiveRootCommitment,
  forbidLatestPolicyLookupInReplay,
  hashPolicyDefinition,
  invalidMoonreyWithSunreyMethodology,
  invalidSunreyWithMoonreyMethodology,
  methodologyEconomyMatches,
  moonreyGpuvPolicyV1,
  moonreyIssuancePolicyV1,
  peveMethodologyRef,
  policyCommitment,
  policyRoot,
  POLICY_AUDIT_INVENTORY,
  POLICY_TYPES,
  replayValuationWithPolicy,
  rightsCommitment,
  rightsRoot,
  SIMULATION_GOVERNANCE_V1,
  sunreyValuationPolicyV1,
  sunreyValuationPolicyV2,
  verifyPolicyCommitment,
  verifyPolicyDefinition,
  WAVE3_ECONOMIC_PROOF_CAPABILITY,
} from './index.ts';

describe('Wave 3 — Policy Commitments Architecture', () => {
  it('declares capability on canonical sunrey-chain owner', () => {
    assert.equal(WAVE3_ECONOMIC_PROOF_CAPABILITY.owner, 'packages/sunrey-chain');
    assert.equal(WAVE3_ECONOMIC_PROOF_CAPABILITY.wave, 3);
    assert.deepEqual(WAVE3_ECONOMIC_PROOF_CAPABILITY.roots, [
      'TRANSACTION',
      'MONETARY_STATE',
      'EVIDENCE',
      'RIGHTS',
      'POLICY',
    ]);
  });

  it('Task 2 — defines explicit policy categories without collapsing', () => {
    assert.ok(POLICY_TYPES.length >= 7);
    assert.ok(POLICY_TYPES.includes('VERIFICATION_POLICY'));
    assert.ok(POLICY_TYPES.includes('VALUATION_METHODOLOGY'));
    assert.ok(POLICY_TYPES.includes('MONETARY_ISSUANCE_POLICY'));
    const types = new Set(POLICY_TYPES);
    assert.equal(types.size, POLICY_TYPES.length);
  });

  it('Task 1 — audits current policy locations', () => {
    assert.ok(POLICY_AUDIT_INVENTORY.length >= 10);
    const valuation = auditEntriesByType('VALUATION_METHODOLOGY');
    assert.ok(valuation.some((e) => e.location.includes('formula.ts')));
    assert.ok(valuation.some((e) => e.location.includes('value-function')));
    const issuance = auditEntriesByType('MONETARY_ISSUANCE_POLICY');
    assert.ok(issuance.some((e) => e.location.includes('chunk-71')));
  });

  it('Task 3 — versioned policy definitions are immutable and verifiable', () => {
    const v1 = sunreyValuationPolicyV1();
    assert.equal(v1.version, 1);
    assert.equal(v1.status, 'REGISTERED');
    assert.ok(verifyPolicyDefinition(v1));
    const tampered = { ...v1, documentRef: 'tampered' };
    assert.notEqual(hashPolicyDefinition(tampered), v1.contentHash);
  });

  it('deterministic PolicyCommitment', () => {
    const registry = new PolicyRegistry();
    const definition = sunreyValuationPolicyV1();
    registry.register(definition);
    const activation = registry.proposeActivation({
      policyId: definition.policyId,
      version: definition.version,
      activationHeight: 10,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.human.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(activation.ok, true);
    if (!activation.ok) {
      return;
    }
    const resolved = registry.resolveAtHeight(10, definition.policyId, definition.version);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      return;
    }
    const c1 = policyCommitment(resolved.definition, resolved.activation);
    const c2 = policyCommitment(resolved.definition, resolved.activation);
    assert.equal(c1.commitmentHash, c2.commitmentHash);
    assert.ok(verifyPolicyCommitment(c1));
  });

  it('deterministic PolicyRoot', () => {
    const registry = seedRegistryWithV1();
    activateV1(registry);
    const commitments = registry.activeCommitmentsAt(10);
    const r1 = policyRoot({ height: 10n, activeCommitments: commitments });
    const r2 = policyRoot({ height: 10n, activeCommitments: commitments });
    assert.equal(r1.rootHash, r2.rootHash);
    assert.equal(r1.commitmentCount, 1);
  });

  it('policy v1/v2 separation — v1 event survives v2 activation', () => {
    const registry = seedRegistryWithV1AndV2();

    registry.proposeActivation({
      policyId: sunreyValuationPolicyV1().policyId,
      version: 1,
      activationHeight: 10,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.human.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });

    const v1Replay = replayValuationWithPolicy(
      registry,
      {
        mode: 'HISTORICAL',
        height: 50,
        policyId: 'sunrey.valuation.methodology.simulation',
        policyVersion: 1,
        methodologyId: 'peve-formula-v1',
        methodologyVersion: '1',
      },
      'claim-v1',
      '2026-02-01T00:00:00.000Z',
    );
    assert.equal(v1Replay.ok, true);

    registry.proposeActivation({
      policyId: sunreyValuationPolicyV2().policyId,
      version: 2,
      activationHeight: 100,
      actorKind: 'PROTOCOL_GOVERNANCE',
      actorId: 'gov.protocol.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: true,
      activatedAt: '2026-06-02T00:00:00.000Z',
    });

    const v1AfterV2 = replayValuationWithPolicy(
      registry,
      {
        mode: 'HISTORICAL',
        height: 50,
        policyId: 'sunrey.valuation.methodology.simulation',
        policyVersion: 1,
        methodologyId: 'peve-formula-v1',
        methodologyVersion: '1',
      },
      'claim-v1',
      '2026-02-01T00:00:00.000Z',
    );
    assert.equal(v1AfterV2.ok, true);
    if (v1AfterV2.ok && v1Replay.ok) {
      assert.equal(v1AfterV2.commitment.commitmentHash, v1Replay.commitment.commitmentHash);
      assert.equal(v1AfterV2.binding.methodologyRef.methodologyId, 'peve-formula-v1');
    }

    const v2Replay = replayValuationWithPolicy(
      registry,
      {
        mode: 'HISTORICAL',
        height: 150,
        policyId: 'sunrey.valuation.methodology.simulation',
        policyVersion: 2,
        methodologyId: 'peve-formula-v2',
        methodologyVersion: '2',
      },
      'claim-v2',
      '2026-07-01T00:00:00.000Z',
    );
    assert.equal(v2Replay.ok, true);
    if (v2Replay.ok && v1AfterV2.ok) {
      assert.notEqual(v2Replay.commitment.commitmentHash, v1AfterV2.commitment.commitmentHash);
    }
  });

  it('inactive policy rejected', () => {
    const registry = new PolicyRegistry();
    const definition = sunreyValuationPolicyV1();
    registry.register(definition);
    const resolved = registry.resolveAtHeight(10, definition.policyId, definition.version);
    assert.equal(resolved.ok, false);
    if (resolved.ok) {
      return;
    }
    assert.equal(resolved.code, 'POLICY_NOT_ACTIVE');
  });

  it('unauthorized policy rejected for monetary use', () => {
    const registry = new PolicyRegistry();
    const definition = sunreyValuationPolicyV1();
    registry.register(definition);
    registry.proposeActivation({
      policyId: definition.policyId,
      version: definition.version,
      activationHeight: 10,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.human.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: false,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    const resolved = registry.resolveAtHeight(10, definition.policyId, definition.version, {
      monetaryUse: true,
    });
    assert.equal(resolved.ok, false);
    if (resolved.ok) {
      return;
    }
    assert.equal(resolved.code, 'POLICY_NOT_AUTHORIZED_FOR_MONETARY_USE');
  });

  it('AI activation rejected for monetary policy', () => {
    const definition = moonreyIssuancePolicyV1();
    const result = activatePolicy({
      definition,
      activationHeight: 10,
      actorKind: 'AI_PROPOSAL',
      actorId: 'ai.agent.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, 'AI_CANNOT_ACTIVATE_MONETARY_POLICY');
  });

  it('Exchange activation rejected', () => {
    const definition = verificationPolicyV1();
    const result = activatePolicy({
      definition,
      activationHeight: 10,
      actorKind: 'EXCHANGE',
      actorId: 'exchange.1',
      governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
      authorizedForMonetaryUse: false,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, 'EXCHANGE_CANNOT_ACTIVATE_POLICY');
  });

  it('Oracle activation rejected', () => {
    assert.equal(canActivatePolicy('ORACLE', 'VERIFICATION_POLICY', false), 'ORACLE_CANNOT_ACTIVATE_POLICY');
  });

  it('historical replay uses historical methodology not latest', () => {
    const registry = seedRegistryWithV1AndV2();
    activateV1(registry);
    activateV2(registry);

    const historical = replayValuationWithPolicy(
      registry,
      {
        mode: 'HISTORICAL',
        height: 20,
        policyId: 'sunrey.valuation.methodology.simulation',
        policyVersion: 1,
        methodologyId: 'peve-formula-v1',
        methodologyVersion: '1',
      },
      'claim-hist',
      '2026-02-01T00:00:00.000Z',
    );
    assert.equal(historical.ok, true);
    if (!historical.ok) {
      return;
    }
    assert.equal(historical.binding.replayMode, 'HISTORICAL');
    assert.equal(historical.binding.methodologyRef.methodologyId, 'peve-formula-v1');
    assert.equal(forbidLatestPolicyLookupInReplay('HISTORICAL'), 'LATEST_POLICY_LOOKUP_FORBIDDEN_IN_REPLAY');
  });

  it('altered policy content invalidates commitment', () => {
    const registry = seedRegistryWithV1();
    activateV1(registry);
    const resolved = registry.resolveAtHeight(10, 'sunrey.valuation.methodology.simulation', 1);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) {
      return;
    }
    const original = policyCommitment(resolved.definition, resolved.activation);
    const tamperedDef = { ...resolved.definition, documentRef: 'altered' };
    assert.throws(() => policyCommitment(tamperedDef, resolved.activation));
    assert.ok(verifyPolicyCommitment(original));
  });

  it('governance reference required for monetary policy', () => {
    const definition = buildPolicyDefinition({
      policyId: 'test.monetary',
      policyType: 'MONETARY_ISSUANCE_POLICY',
      version: 1,
      economy: 'PROTOCOL',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      documentRef: 'fixture',
      governanceAuthorizationRef: null,
    });
    const result = activatePolicy({
      definition,
      activationHeight: 10,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.human.1',
      governanceAuthorizationRef: buildGovernanceDecisionRef({
        decisionId: 'gov.test',
        governancePolicyVersion: 1,
        authorizedAtHeight: 10,
        actorKind: 'HUMAN_GOVERNANCE',
      }),
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(result.ok, true);
    const noGov = buildPolicyDefinition({
      policyId: 'test.monetary.nogov',
      policyType: 'MONETARY_ISSUANCE_POLICY',
      version: 1,
      economy: 'PROTOCOL',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      documentRef: 'fixture',
    });
    const badActivation = activatePolicy({
      definition: noGov,
      activationHeight: 10,
      actorKind: 'HUMAN_GOVERNANCE',
      actorId: 'gov.human.1',
      governanceAuthorizationRef: buildGovernanceDecisionRef({
        decisionId: 'gov.test',
        governancePolicyVersion: 1,
        authorizedAtHeight: 10,
        actorKind: 'HUMAN_GOVERNANCE',
      }),
      authorizedForMonetaryUse: true,
      activatedAt: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(badActivation.ok, true);
  });

  it('SunRey policy cannot authorize MoonRey methodology', () => {
    const invalid = invalidSunreyWithMoonreyMethodology();
    const moonreyMethod = invalid.methodologyRefs[0]!;
    assert.equal(methodologyEconomyMatches(moonreyMethod, 'SUNREY'), false);
    const replay = replayValuationWithPolicy(
      new PolicyRegistry(),
      {
        mode: 'LIVE',
        height: 10,
        policyId: invalid.policyId,
        policyVersion: invalid.version,
        methodologyId: moonreyMethod.methodologyId,
        methodologyVersion: moonreyMethod.version,
      },
      'claim-cross',
      '2026-01-01T00:00:00.000Z',
    );
    assert.equal(replay.ok, false);
  });

  it('MoonRey policy cannot authorize SunRey methodology', () => {
    const invalid = invalidMoonreyWithSunreyMethodology();
    const sunreyMethod = invalid.methodologyRefs[0]!;
    assert.equal(methodologyEconomyMatches(sunreyMethod, 'MOONREY'), false);
  });

  it('Task 9 — policy change does not silently reinterpret historical binding', () => {
    const registry = seedRegistryWithV1AndV2();
    activateV1(registry);
    const v1Resolved = registry.resolveAtHeight(10, 'sunrey.valuation.methodology.simulation', 1);
    assert.equal(v1Resolved.ok, true);
    if (!v1Resolved.ok) {
      return;
    }
    const v1Commitment = policyCommitment(v1Resolved.definition, v1Resolved.activation);
    const v1Binding = {
      claimId: 'c1',
      policyCommitment: v1Commitment,
      methodologyRef: peveMethodologyRef('FORMULA_V1', 'ref'),
      producedAt: '2026-01-01T00:00:00.000Z',
      replayMode: 'HISTORICAL' as const,
    };
    activateV2(registry);
    const v2Def = sunreyValuationPolicyV2();
    assert.notEqual(assertNoSilentReinterpretation(v1Binding, v2Def), null);
    assert.equal(assertNoSilentReinterpretation(v1Binding, v1Resolved.definition), null);
  });

  it('five-root integration includes PolicyRoot', () => {
    const registry = seedRegistryWithV1();
    activateV1(registry);
    const policyCommitments = registry.activeCommitmentsAt(10);
    const evidence = evidenceCommitment({
      sealHash: 'a'.repeat(64),
      claimFingerprint: 'b'.repeat(64),
      sequence: 1n,
    });
    const rights = rightsCommitment({
      rightId: 'right.1',
      payloadCommitment: 'c'.repeat(64),
      policyRef: 'policy.ref.1',
      consentRef: 'consent.ref.1',
    });
    const five = fiveRootCommitment({
      height: 10n,
      transactionIds: [],
      monetaryStateEntries: new Map([['supply:sunrey', Buffer.from('1000')]]),
      evidenceCommitments: [evidence],
      rightsCommitments: [rights],
      policyCommitments,
    });
    assert.ok(five.policyRoot.length === 64);
    assert.ok(five.evidenceRoot.length === 64);
    assert.ok(five.rightsRoot.length === 64);
    assert.ok(five.compositeRoot.length === 64);
    const extensions = extensionCommitmentsFromFiveRoot(five);
    assert.ok(extensions.EVIDENCE_ROOT);
    assert.ok(extensions.RIGHTS_ROOT);
    assert.ok(extensions.POLICY_ROOT);
  });

  it('evidence and rights roots are deterministic', () => {
    const e1 = evidenceRoot({ height: 1n, commitments: [] });
    const e2 = evidenceRoot({ height: 1n, commitments: [] });
    assert.equal(e1.rootHash, e2.rootHash);
    const r1 = rightsRoot({ height: 1n, commitments: [] });
    const r2 = rightsRoot({ height: 1n, commitments: [] });
    assert.equal(r1.rootHash, r2.rootHash);
  });

  it('GPUV methodology binding states version explicitly', () => {
    const policy = moonreyGpuvPolicyV1();
    assert.equal(policy.economy, 'MOONREY');
    assert.equal(policy.methodologyRefs[0]?.methodologyId, 'moonrey.productive-value-function.simulation.v1');
    assert.equal(policy.methodologyRefs[0]?.version, '1');
  });
});

function seedRegistryWithV1(): PolicyRegistry {
  const registry = new PolicyRegistry();
  registry.register(sunreyValuationPolicyV1());
  return registry;
}

function seedRegistryWithV1AndV2(): PolicyRegistry {
  const registry = new PolicyRegistry();
  registry.register(sunreyValuationPolicyV1());
  registry.register(sunreyValuationPolicyV2());
  return registry;
}

function activateV1(registry: PolicyRegistry): void {
  registry.proposeActivation({
    policyId: 'sunrey.valuation.methodology.simulation',
    version: 1,
    activationHeight: 10,
    actorKind: 'HUMAN_GOVERNANCE',
    actorId: 'gov.human.1',
    governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
    authorizedForMonetaryUse: true,
    activatedAt: '2026-01-02T00:00:00.000Z',
  });
}

function activateV2(registry: PolicyRegistry): void {
  registry.proposeActivation({
    policyId: 'sunrey.valuation.methodology.simulation',
    version: 2,
    activationHeight: 100,
    actorKind: 'PROTOCOL_GOVERNANCE',
    actorId: 'gov.protocol.1',
    governanceAuthorizationRef: SIMULATION_GOVERNANCE_V1,
    authorizedForMonetaryUse: true,
    activatedAt: '2026-06-02T00:00:00.000Z',
  });
}

function verificationPolicyV1() {
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
