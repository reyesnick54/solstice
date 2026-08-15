import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { asModelId, asModelValidationId, asModelVersion } from './ids.ts';
import {
  CANONICAL_RISK_MODEL_ID,
  CANONICAL_RISK_MODEL_VERSION,
  ModelRegistry,
  seedCanonicalRiskModel,
  sha256Canonical,
} from './registry.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function humanActor() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_model_op',
      customerId: asCustomerId('cust_model_op'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_1');
  assert.equal(actor.ok, true);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return actor.value;
}

describe('model registry', () => {
  it('registers, validates, and human-approves the canonical risk model for simulation only', () => {
    const registry = new ModelRegistry();
    const seeded = seedCanonicalRiskModel(registry, humanActor(), NOW);
    assert.equal(seeded.ok, true);
    if (!seeded.ok) {
      return;
    }
    assert.equal(seeded.value.modelId, CANONICAL_RISK_MODEL_ID);
    assert.equal(seeded.value.version, CANONICAL_RISK_MODEL_VERSION);
    assert.equal(seeded.value.lifecycle, 'APPROVED_FOR_SIMULATION');
    assert.equal(seeded.value.liveApproved, false);
    assert.equal(seeded.value.simulationOnly, true);
    assert.equal(seeded.value.determinism, 'DETERMINISTIC');
  });

  it('rejects in-place artifact replacement and requires a new version', () => {
    const registry = new ModelRegistry();
    const seeded = seedCanonicalRiskModel(registry, humanActor(), NOW);
    assert.equal(seeded.ok, true);
    if (!seeded.ok) {
      return;
    }
    const changed = registry.rejectInPlaceReplacement(
      CANONICAL_RISK_MODEL_ID,
      CANONICAL_RISK_MODEL_VERSION,
      '{"changed":true}',
    );
    assert.equal(changed.ok, false);
    if (!changed.ok) {
      assert.equal(changed.error.code, 'ARTIFACT_IMMUTABLE');
    }
    const duplicate = registry.register({
      modelId: CANONICAL_RISK_MODEL_ID,
      version: CANONICAL_RISK_MODEL_VERSION,
      type: 'RISK_MODEL',
      description: 'replacement attempt',
      owner: 'ai',
      inputSchema: 'x',
      outputSchema: 'y',
      determinism: 'DETERMINISTIC',
      configurationCanonical: '{"changed":true}',
      createdAt: NOW,
      limitations: Object.freeze([]),
      applicableDomain: 'INVESTMENTS_PAPER_SIMULATION',
      dataRequirements: Object.freeze([]),
      artifactKind: 'WEIGHTS_REFERENCE',
      artifactDescription: 'changed weights',
    });
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'VERSION_EXISTS');
    }
    const next = registry.register({
      modelId: CANONICAL_RISK_MODEL_ID,
      version: asModelVersion('risk-model-v2'),
      type: 'RISK_MODEL',
      description: 'new version after formula change',
      owner: 'solstice-risk',
      inputSchema: 'x',
      outputSchema: 'y',
      determinism: 'DETERMINISTIC',
      configurationCanonical: '{"changed":true}',
      createdAt: NOW,
      limitations: Object.freeze([]),
      applicableDomain: 'INVESTMENTS_PAPER_SIMULATION',
      dataRequirements: Object.freeze([]),
      artifactKind: 'FORMULA',
      artifactDescription: 'updated formula',
    });
    assert.equal(next.ok, true);
    if (next.ok) {
      assert.notEqual(next.value.artifact.sha256, seeded.value.artifact.sha256);
      assert.equal(next.value.lifecycle, 'DRAFT');
    }
  });

  it('forbids a model from approving itself', () => {
    const registry = new ModelRegistry();
    const registered = registry.register({
      modelId: asModelId('mdl_self'),
      version: asModelVersion('v1'),
      type: 'AI_MODEL_REFERENCE',
      description: 'self-approving attempt',
      owner: 'ai',
      inputSchema: 'x',
      outputSchema: 'y',
      determinism: 'NON_DETERMINISTIC',
      configurationCanonical: '{"ref":"pointer-only"}',
      createdAt: NOW,
      limitations: Object.freeze(['not executable']),
      applicableDomain: 'NONE',
      dataRequirements: Object.freeze([]),
      artifactKind: 'CONFIGURATION',
      artifactDescription: 'pointer',
    });
    assert.equal(registered.ok, true);
    const queued = registry.requireValidation(asModelId('mdl_self'), asModelVersion('v1'));
    assert.equal(queued.ok, true);
    const validated = registry.recordValidation({
      validationId: asModelValidationId('mvn_self'),
      modelId: asModelId('mdl_self'),
      version: asModelVersion('v1'),
      testsExecuted: Object.freeze(['none']),
      testDatasetReference: 'none',
      expectedBehavior: 'none',
      observedBehavior: 'none',
      limitations: Object.freeze([]),
      status: 'PASSED_SIMULATION',
      reviewer: 'operator_1',
      reviewerKind: 'HUMAN_OPERATOR',
      timestamp: NOW,
      claimsRealWorldPerformance: false,
    });
    assert.equal(validated.ok, true);
    const fakeSelf = {
      actorId: 'mdl_self',
      subjectId: 'mdl_self',
      sessionId: 'ses_self',
      authenticationAssurance: 'AAL1',
      authorizedCapabilities: Object.freeze([]),
      issuedAt: NOW,
      expiresAt: NOW,
      issuer: 'solstice-identity',
      integrity: { algorithm: 'HMAC-SHA256', hex: '00', keyId: 'k', keyVersion: 1 },
    };
    const approved = registry.approveForSimulation(fakeSelf, {
      modelId: asModelId('mdl_self'),
      version: asModelVersion('v1'),
      reason: 'I approve myself',
      now: NOW,
    });
    assert.equal(approved.ok, false);
    if (!approved.ok) {
      assert.ok(
        approved.error.code === 'ACTOR_CONTEXT_REQUIRED' || approved.error.code === 'SELF_APPROVAL_FORBIDDEN',
      );
    }
  });

  it('hashes configuration so a silent formula change is visible', () => {
    const left = sha256Canonical('{"a":1}');
    const right = sha256Canonical('{"a":2}');
    assert.notEqual(left, right);
  });
});
