import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { assetIdFor } from './ids.ts';
import { fixtureAnchor, fixtureAsset, FIXTURE_NOW } from './fixtures.ts';
import { EconomicAssetRegistry } from './registry.ts';
import type { EconomicAssetDescriptor, RegisterAssetInput } from './types.ts';
import {
  ENGINEERING_VERIFICATION_POLICY,
  decideVerification,
  type EconomicAssetVerificationDecision,
} from './verification/index.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  assert.equal(result.ok, true, result.ok ? '' : result.error.message);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function assertBoundary(decision: EconomicAssetVerificationDecision): void {
  assert.equal(decision.containsRawSensitiveData, false);
  assert.equal(decision.authorizesValuation, false);
  assert.equal(decision.authorizesSettlement, false);
  assert.equal(decision.authorizesSunReyIssuance, false);
  assert.equal(decision.authorizesMoonReyIssuance, false);
  assert.equal(decision.authorizesExecution, false);
}

function verify(registry: EconomicAssetRegistry, assetId: EconomicAssetDescriptor['assetId']) {
  return registry.verify(assetId, asUtcInstant('2026-08-19T12:30:00.000Z'));
}

function registerLineage(
  registry: EconomicAssetRegistry,
  input: RegisterAssetInput,
  parents: readonly { readonly kind: 'DERIVED_FROM' | 'VERIFIED_BY' | 'CONTRIBUTED_TO'; readonly assetId: EconomicAssetDescriptor['assetId'] }[],
): EconomicAssetDescriptor {
  const assetId = input.assetId ?? assetIdFor(`${input.assetClass}:${input.contentCommitmentMaterial}:lined`);
  return unwrap(
    registry.register({
      ...input,
      assetId,
      lineage: parents.map((parent) => ({ kind: parent.kind, fromAssetId: assetId, toAssetId: parent.assetId })),
    }),
  );
}

describe('CHUNK-114 economic asset verification', () => {
  it('verifies a HIN information asset', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'v-hin')));
    const verified = unwrap(verify(registry, hin.assetId));
    assert.equal(verified.status, 'VERIFIED');
    assert.ok(verified.verificationDecisionId);
    assert.equal(verified.verificationPolicyId, ENGINEERING_VERIFICATION_POLICY.policyId);
    assert.equal(verified.roles.controllerIsLegalOwner, false);
  });

  it('verifies an information right', () => {
    const registry = new EconomicAssetRegistry();
    const right = unwrap(registry.register(fixtureAsset('information-right', 'v-right')));
    assert.equal(unwrap(verify(registry, right.assetId)).status, 'VERIFIED');
  });

  it('verifies a human contribution record', () => {
    const registry = new EconomicAssetRegistry();
    const record = unwrap(registry.register(fixtureAsset('human-contribution', 'v-hec')));
    assert.equal(unwrap(verify(registry, record.assetId)).status, 'VERIFIED');
  });

  it('verifies a public reference dataset', () => {
    const registry = new EconomicAssetRegistry();
    const dataset = unwrap(registry.register(fixtureAsset('reference-dataset', 'v-ref')));
    assert.equal(dataset.sensitivityClass, 'PUBLIC');
    assert.equal(unwrap(verify(registry, dataset.assetId)).status, 'VERIFIED');
  });

  it('verifies a restricted oracle source', () => {
    const registry = new EconomicAssetRegistry();
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'v-oracle')));
    assert.equal(source.storageClass, 'OFF_CHAIN_RESTRICTED');
    assert.equal(unwrap(verify(registry, source.assetId)).status, 'VERIFIED');
  });

  it('verifies an economic fact from observation lineage', () => {
    const registry = new EconomicAssetRegistry();
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'v-fact-src')));
    const observation = registerLineage(registry, fixtureAsset('observation-set', 'v-obs'), [
      { kind: 'DERIVED_FROM', assetId: source.assetId },
    ]);
    const fact = registerLineage(registry, fixtureAsset('verified-fact', 'v-fact'), [
      { kind: 'DERIVED_FROM', assetId: observation.assetId },
    ]);
    assert.equal(unwrap(verify(registry, fact.assetId)).status, 'VERIFIED');
  });

  it('verifies a productive object', () => {
    const registry = new EconomicAssetRegistry();
    const object = unwrap(registry.register(fixtureAsset('productive-object', 'v-obj')));
    assert.ok(object.operatorRef);
    assert.equal(unwrap(verify(registry, object.assetId)).status, 'VERIFIED');
  });

  it('verifies a productive claim', () => {
    const registry = new EconomicAssetRegistry();
    const object = unwrap(registry.register(fixtureAsset('productive-object', 'v-claim-obj')));
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'v-claim-src')));
    const observation = registerLineage(registry, fixtureAsset('observation-set', 'v-claim-obs'), [
      { kind: 'DERIVED_FROM', assetId: source.assetId },
    ]);
    const fact = registerLineage(registry, fixtureAsset('verified-fact', 'v-claim-fact'), [
      { kind: 'DERIVED_FROM', assetId: observation.assetId },
    ]);
    const claim = registerLineage(registry, fixtureAsset('productive-claim', 'v-claim'), [
      { kind: 'DERIVED_FROM', assetId: object.assetId },
      { kind: 'DERIVED_FROM', assetId: fact.assetId },
    ]);
    assert.equal(unwrap(verify(registry, claim.assetId)).status, 'VERIFIED');
  });

  it('verifies a productive contribution', () => {
    const registry = new EconomicAssetRegistry();
    const object = unwrap(registry.register(fixtureAsset('productive-object', 'v-pc-obj')));
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'v-pc-src')));
    const observation = registerLineage(registry, fixtureAsset('observation-set', 'v-pc-obs'), [
      { kind: 'DERIVED_FROM', assetId: source.assetId },
    ]);
    const fact = registerLineage(registry, fixtureAsset('verified-fact', 'v-pc-fact'), [
      { kind: 'DERIVED_FROM', assetId: observation.assetId },
    ]);
    const contribution = registerLineage(registry, fixtureAsset('productive-contribution', 'v-pc'), [
      { kind: 'CONTRIBUTED_TO', assetId: object.assetId },
      { kind: 'DERIVED_FROM', assetId: fact.assetId },
    ]);
    assert.equal(unwrap(verify(registry, contribution.assetId)).status, 'VERIFIED');
  });

  it('does not treat controller as legal owner', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'own-ctl')));
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(hin.roles.controllerIsLegalOwner, false);
    assert.equal(decision.decision, 'VERIFIED');
    assert.equal(hin.roles.legalOwnershipEstablished, false);
  });

  it('does not treat subject as legal owner', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'own-sub')));
    assert.equal(hin.roles.subjectIsLegalOwner, false);
    assert.notEqual(hin.subjectRef, hin.controllerRef);
    assert.equal(unwrap(verify(registry, hin.assetId)).roles.subjectIsLegalOwner, false);
  });

  it('rejects missing human-information rights references', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(
      registry.register({
        ...fixtureAsset('hin-information', 'no-rights'),
        consentRefs: [],
        purposeRefs: [],
        usageRestrictionRefs: [],
        rightsConcepts: [],
      }),
    );
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REJECTED');
    assert.ok(
      decision.decisionCodes.includes('CONSENT_REFERENCE_REQUIRED') ||
        decision.decisionCodes.includes('PURPOSE_REFERENCE_REQUIRED') ||
        decision.decisionCodes.includes('RIGHTS_REFERENCE_REQUIRED'),
    );
    assert.equal(verify(registry, hin.assetId).ok, false);
  });

  it('rejects missing provenance', () => {
    const registry = new EconomicAssetRegistry();
    const dataset = unwrap(
      registry.register({
        ...fixtureAsset('reference-dataset', 'no-prov'),
        sourceOrganizationRef: null,
      }),
    );
    const decision = unwrap(registry.evaluateVerification(dataset.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REJECTED');
    assert.ok(decision.decisionCodes.includes('PROVENANCE_REQUIRED'));
  });

  it('rejects sensitivity and storage mismatch', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(
      registry.register({
        ...fixtureAsset('hin-information', 'bad-store'),
        storageClass: 'OFF_CHAIN_PUBLIC_REFERENCE',
      }),
    );
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REJECTED');
    assert.ok(decision.decisionCodes.includes('STORAGE_SENSITIVITY_MISMATCH'));
  });

  it('handles a stale reference dataset as additional evidence', () => {
    const registry = new EconomicAssetRegistry();
    const dataset = unwrap(
      registry.register({
        ...fixtureAsset('reference-dataset', 'stale-ref'),
        freshness: 'STALE',
      }),
    );
    const decision = unwrap(registry.evaluateVerification(dataset.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REQUIRES_ADDITIONAL_EVIDENCE');
    assert.ok(decision.decisionCodes.includes('FRESHNESS_INSUFFICIENT'));
    assert.equal(verify(registry, dataset.assetId).ok, false);
  });

  it('rejects invalid chain finality claims', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(
      registry.register({
        ...fixtureAsset('hin-information', 'bad-finality'),
        chainAnchor: {
          ...fixtureAnchor('bad-finality'),
          finalityState: 'UNANCHORED',
        },
      }),
    );
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REJECTED');
    assert.ok(decision.decisionCodes.includes('FINALITY_CLAIM_INVALID'));
  });

  it('rejects raw sensitive data at registration', () => {
    const registry = new EconomicAssetRegistry();
    const raw = registry.register({
      ...fixtureAsset('hin-information', 'raw-verify'),
      contentCommitmentMaterial: 'raw dataset ssn 123-45-6789',
    });
    assert.equal(raw.ok, false);
    if (!raw.ok) {
      assert.equal(raw.error.code, 'RAW_SENSITIVE_DATA_FORBIDDEN');
    }
  });

  it('rejects a lineage cycle', () => {
    const registry = new EconomicAssetRegistry();
    const source = unwrap(registry.register(fixtureAsset('oracle-source', 'cyc-src')));
    const loop = registry.register({
      ...fixtureAsset('verified-fact', 'cyc-fact'),
      assetId: source.assetId,
      lineage: [{ kind: 'DERIVED_FROM', fromAssetId: source.assetId, toAssetId: source.assetId }],
    });
    assert.equal(loop.ok, false);
    if (!loop.ok) {
      assert.equal(loop.error.code, 'LINEAGE_CYCLE');
    }
    const factId = assetIdFor('cyc-eval');
    const created = unwrap(
      registry.register({
        ...fixtureAsset('verified-fact', 'cyc-eval'),
        assetId: factId,
        lineage: [{ kind: 'DERIVED_FROM', fromAssetId: factId, toAssetId: source.assetId }],
      }),
    );
    const cyclic = decideVerification({
      descriptor: {
        ...created,
        lineage: [
          { kind: 'DERIVED_FROM', fromAssetId: created.assetId, toAssetId: source.assetId },
          { kind: 'DERIVED_FROM', fromAssetId: source.assetId, toAssetId: created.assetId },
        ],
      },
      policy: ENGINEERING_VERIFICATION_POLICY,
      knownAssets: [source, created],
      evaluatedAt: FIXTURE_NOW,
    });
    assert.equal(cyclic.decision, 'REJECTED');
    assert.ok(cyclic.decisionCodes.includes('LINEAGE_CYCLE'));
  });

  it('rejects fabricated VERIFIED_BY lineage', () => {
    const registry = new EconomicAssetRegistry();
    const dataset = unwrap(registry.register(fixtureAsset('reference-dataset', 'fake-parent')));
    const hin = unwrap(
      registry.register({
        ...fixtureAsset('hin-information', 'fake-verified-by'),
        assetId: assetIdFor('fake-verified-by'),
        lineage: [{ kind: 'VERIFIED_BY', fromAssetId: assetIdFor('fake-verified-by'), toAssetId: dataset.assetId }],
      }),
    );
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.decision, 'REJECTED');
    assert.ok(decision.decisionCodes.includes('LINEAGE_INVALID'));
  });

  it('rejects a direct VERIFIED-state bypass', () => {
    const registry = new EconomicAssetRegistry();
    const bypass = registry.register({
      ...fixtureAsset('hin-information', 'bypass'),
      consentRefs: [],
      purposeRefs: [],
      usageRestrictionRefs: [],
      status: 'VERIFIED',
    });
    assert.equal(bypass.ok, false);
    if (!bypass.ok) {
      assert.equal(bypass.error.code, 'VERIFICATION_REJECTED');
    }
    const other = registry.register({
      ...fixtureAsset('ai-compute', 'other-closed'),
      assetClass: 'OTHER_GOVERNED_ECONOMIC_ASSET',
      status: 'VERIFIED',
    });
    assert.equal(other.ok, false);
  });

  it('produces a deterministic verification digest', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'digest-a')));
    const first = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    const second = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(first.decisionDigest, second.decisionDigest);
    assert.equal(first.decisionId, second.decisionId);
    assert.equal(first.decision, 'VERIFIED');
    assertBoundary(first);
  });

  it('cannot authorize valuation from registry verification', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'no-val')));
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.authorizesValuation, false);
    assert.equal(unwrap(verify(registry, hin.assetId)).automaticValue, null);
  });

  it('cannot mint SunRey from registry verification', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'no-sun')));
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.authorizesSunReyIssuance, false);
    assert.equal(registry.authorizeMint(hin).sunReyQuantity, null);
  });

  it('cannot mint MoonRey from registry verification', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'no-moon')));
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.authorizesMoonReyIssuance, false);
    assert.equal(registry.authorizeMint(hin).moonReyQuantity, null);
  });

  it('cannot issue Execution Authority from registry verification', () => {
    const registry = new EconomicAssetRegistry();
    const hin = unwrap(registry.register(fixtureAsset('hin-information', 'no-exec')));
    const decision = unwrap(registry.evaluateVerification(hin.assetId, FIXTURE_NOW));
    assert.equal(decision.authorizesExecution, false);
    assert.equal(registry.authorizeExecution(hin).issuesExecutionAuthority, false);
    assert.equal(ENGINEERING_VERIFICATION_POLICY.productionActivated, false);
    assert.equal(ENGINEERING_VERIFICATION_POLICY.state, 'SIMULATION');
  });
});
