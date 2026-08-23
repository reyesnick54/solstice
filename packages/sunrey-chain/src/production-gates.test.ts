import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../config/src/flags.ts';
import {
  FORBIDDEN_PARALLEL_PACKAGES,
  INTERNAL_TEST_EQUALS_EXTERNAL_AUDIT,
  PRODUCTION_ACTIVE,
  PRODUCTION_GATE_CATALOG,
  PRODUCTION_READY,
  PRODUCTION_STAFFING_ROLES,
  attachEvidence,
  authorizeException,
  createEvidenceStore,
  createExceptionStore,
  currentRepositoryGateSnapshot,
  deriveExternalCompleteLabel,
  evaluateProductionGates,
  formatProductionGateReport,
  isExternalPentestComplete,
  prepareLaunchCeremonyChecklist,
  providerCertificationHandoffs,
  serializeExternalInputRegistry,
  verifyEvidence,
} from './production-handoff/production-gates/index.ts';

const NOW = '2026-08-23T00:00:00.000Z';

describe('Phase I Prompt 5 production gates', () => {
  it('keeps production disabled and environment in simulation', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(PRODUCTION_READY, false);
    assert.equal(snapshot.productionActive, false);
    assert.equal(snapshot.productionReady, false);
    assert.equal(snapshot.liveConnectivityEnabled, false);
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
  });

  it('registers a versioned External Input Registry with required fields', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.inputs.length > 100);
    for (const row of snapshot.inputs) {
      assert.equal(typeof row.gateId, 'string');
      assert.equal(typeof row.category, 'string');
      assert.equal(typeof row.description, 'string');
      assert.ok(row.requiredFor.length > 0);
      assert.equal(typeof row.jurisdiction, 'string');
      assert.ok(
        ['MISSING', 'IN_PROGRESS', 'PRESENT_UNVERIFIED', 'VERIFIED', 'EXPIRED', 'NOT_APPLICABLE'].includes(row.status),
      );
      assert.equal(typeof row.ownerRole, 'string');
      assert.equal(typeof row.notes, 'string');
      assert.ok('evidenceReference' in row);
      assert.ok('expiration' in row);
      assert.ok('lastValidated' in row);
    }
    const ids = snapshot.inputs.map((row) => row.gateId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('fails closed when a required gate is missing', () => {
    const snapshot = evaluateProductionGates(NOW);
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
    assert.ok(snapshot.missingExternalGateIds.includes('sec.external-pentest'));
    assert.ok(snapshot.missingExternalGateIds.includes('sec.hsm-kms'));
    assert.ok(snapshot.missingExternalGateIds.includes('chain.economic-parameters'));
    assert.ok(snapshot.missingExternalGateIds.includes('prv.bank-baas'));
  });

  it('blocks expired required evidence', () => {
    const evidence = createEvidenceStore();
    const attached = attachEvidence(evidence, {
      evidenceId: 'ev.expired.terms',
      gateId: 'legal.terms',
      sourceKind: 'EXTERNAL_REGISTERED',
      reference: 'repo://legal/terms-v1',
      contentDigest: 'digest-terms',
      attachedAtUtc: '2025-01-01T00:00:00.000Z',
      expiresAtUtc: '2025-12-31T00:00:00.000Z',
    });
    assert.equal(attached.ok, true);
    if (attached.ok) {
      const verified = verifyEvidence(evidence, attached.value.evidenceId, 'HUMAN', '2025-06-01T00:00:00.000Z');
      assert.equal(verified.ok, true);
    }
    const snapshot = evaluateProductionGates(NOW, { evidence });
    assert.ok(snapshot.expiredGateIds.includes('legal.terms'));
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
  });

  it('blocks unverified attached evidence', () => {
    const evidence = createEvidenceStore();
    const attached = attachEvidence(evidence, {
      evidenceId: 'ev.unverified.terms',
      gateId: 'legal.terms',
      sourceKind: 'EXTERNAL_REGISTERED',
      reference: 'repo://legal/terms-unverified',
      contentDigest: 'digest-unverified',
      attachedAtUtc: NOW,
    });
    assert.equal(attached.ok, true);
    const snapshot = evaluateProductionGates(NOW, { evidence });
    assert.ok(snapshot.unverifiedGateIds.includes('legal.terms'));
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
  });

  it('blocks when a required provider family is absent', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.missingExternalGateIds.some((id) => id.startsWith('prv.bank-baas')));
    assert.ok(snapshot.missingExternalGateIds.includes('prv.kyc.production-credentials'));
    assert.ok(snapshot.blockers.includes('prv.bank-baas'));
  });

  it('blocks when external security audit evidence is absent', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.missingExternalGateIds.includes('sec.external-architecture-review'));
    assert.ok(snapshot.missingExternalGateIds.includes('sec.external-pentest'));
    assert.equal(INTERNAL_TEST_EQUALS_EXTERNAL_AUDIT, false);
  });

  it('blocks when HSM evidence is absent', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.missingExternalGateIds.includes('sec.hsm-kms'));
    assert.ok(snapshot.missingExternalGateIds.includes('chain.hsm-kms'));
  });

  it('blocks when mainnet economics are absent', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.missingExternalGateIds.includes('chain.economic-parameters'));
    assert.ok(snapshot.missingExternalGateIds.includes('chain.native-asset-parameters'));
    assert.ok(snapshot.missingExternalGateIds.includes('chain.final-genesis'));
  });

  it('evaluates a limited-live subset separately from production', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.limitedLiveBlockers.includes('reg.banking-payment-permission'));
    assert.ok(snapshot.limitedLiveBlockers.includes('sec.external-pentest'));
    assert.equal(snapshot.limitedLiveBlockers.includes('chain.final-genesis'), false);
    assert.equal(snapshot.blockers.includes('chain.final-genesis'), true);
  });

  it('refuses ordinary developer override of required missing gates', () => {
    const exceptions = createExceptionStore();
    const attempt = authorizeException(exceptions, {
      exceptionId: 'ex.dev',
      gateId: 'inf.dns-certificates',
      actorKind: 'DEVELOPER',
      actorRole: 'ENGINEERING',
      actorId: 'dev-1',
      reason: 'ship from local workstation without evidence',
      approvedAtUtc: NOW,
      expiresAtUtc: '2027-01-01T00:00:00.000Z',
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'OVERRIDE_FORBIDDEN');
    }
  });

  it('refuses Agent and AI override of required missing gates', () => {
    const exceptions = createExceptionStore();
    for (const kind of ['AGENT', 'AI', 'S3M', 'GROK', 'AUTOMATION'] as const) {
      const attempt = authorizeException(exceptions, {
        exceptionId: `ex.${kind}`,
        gateId: 'inf.dns-certificates',
        actorKind: kind,
        actorRole: 'GOVERNANCE_ADMIN',
        actorId: `${kind}-1`,
        reason: 'automated exception without human governance',
        approvedAtUtc: NOW,
        expiresAtUtc: '2027-01-01T00:00:00.000Z',
      });
      assert.equal(attempt.ok, false);
    }
  });

  it('rejects internal tests as external pentest completion', () => {
    const evidence = createEvidenceStore();
    const attempt = attachEvidence(evidence, {
      evidenceId: 'ev.internal.pentest',
      gateId: 'sec.external-pentest',
      sourceKind: 'INTERNAL_TEST',
      reference: 'npm test',
      contentDigest: 'internal-suite',
      attachedAtUtc: NOW,
    });
    assert.equal(attempt.ok, false);
    if (!attempt.ok) {
      assert.equal(attempt.error.code, 'SELF_CERTIFICATION_FORBIDDEN');
    }
    assert.equal(isExternalPentestComplete(evidence, NOW), false);
    assert.equal(deriveExternalCompleteLabel('sec.external-pentest', evidence, NOW), false);
  });

  it('versions evidence and refuses non-human verification', () => {
    const evidence = createEvidenceStore();
    const first = attachEvidence(evidence, {
      evidenceId: 'ev.terms.1',
      gateId: 'legal.terms',
      sourceKind: 'EXTERNAL_REGISTERED',
      reference: 'repo://legal/terms-1',
      contentDigest: 'd1',
      attachedAtUtc: NOW,
    });
    assert.equal(first.ok, true);
    const second = attachEvidence(evidence, {
      evidenceId: 'ev.terms.2',
      gateId: 'legal.terms',
      sourceKind: 'EXTERNAL_REGISTERED',
      reference: 'repo://legal/terms-2',
      contentDigest: 'd2',
      attachedAtUtc: NOW,
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.value.version, 2);
      assert.equal(second.value.previousVersionId, 'ev.terms.1');
      const ai = verifyEvidence(evidence, second.value.evidenceId, 'AI', NOW);
      assert.equal(ai.ok, false);
    }
  });

  it('allows only documented human governance exceptions on eligible gates', () => {
    const exceptions = createExceptionStore();
    const blocked = authorizeException(exceptions, {
      exceptionId: 'ex.pentest',
      gateId: 'sec.external-pentest',
      actorKind: 'HUMAN',
      actorRole: 'GOVERNANCE_ADMIN',
      actorId: 'gov-1',
      reason: 'waive pentest because internal tests passed',
      approvedAtUtc: NOW,
      expiresAtUtc: '2027-01-01T00:00:00.000Z',
    });
    assert.equal(blocked.ok, false);
    const allowed = authorizeException(exceptions, {
      exceptionId: 'ex.dns',
      gateId: 'inf.dns-certificates',
      actorKind: 'HUMAN',
      actorRole: 'GOVERNANCE_ADMIN',
      actorId: 'gov-1',
      reason: 'private limited-live cohort has no public DNS',
      approvedAtUtc: NOW,
      expiresAtUtc: '2027-01-01T00:00:00.000Z',
    });
    assert.equal(allowed.ok, true);
    const snapshot = evaluateProductionGates(NOW, { exceptions });
    assert.equal(snapshot.releaseDecision, 'BLOCKED');
    assert.equal(snapshot.exceptions.length, 1);
  });

  it('covers regulatory, provider, security, AI, privacy, exchange, mainnet, and staffing', () => {
    const snapshot = currentRepositoryGateSnapshot();
    assert.ok(snapshot.inputs.some((row) => row.gateId.startsWith('reg.') && row.counselState === 'COUNSEL_REVIEW_REQUIRED'));
    assert.ok(snapshot.inputs.some((row) => row.gateId.startsWith('prv.') && row.providerSlot === 'webhooks-validated'));
    assert.ok(snapshot.inputs.some((row) => row.gateId.startsWith('sec.') && row.kind === 'EXTERNAL_AUDIT'));
    assert.ok(snapshot.inputs.some((row) => row.gateId === 'ai.prompt-injection-suite'));
    assert.ok(snapshot.inputs.some((row) => row.gateId === 'priv.marketplace-legal-structure'));
    assert.ok(snapshot.inputs.some((row) => row.gateId === 'ex.regulatory-authorization'));
    assert.ok(snapshot.inputs.some((row) => row.gateId === 'chain.mainnet-activation-approval'));
    assert.equal(PRODUCTION_STAFFING_ROLES.includes('INCIDENT_COMMANDER'), true);
    assert.ok(snapshot.inputs.some((row) => row.gateId === 'ops.incident-commander' && row.status === 'MISSING'));
  });

  it('prepares a launch ceremony checklist without executing it', () => {
    const checklist = prepareLaunchCeremonyChecklist();
    assert.equal(checklist.prepared, true);
    assert.equal(checklist.executed, false);
    assert.equal(checklist.productionActivated, false);
    assert.ok(checklist.items.some((row) => row.id === 'kill-switches'));
    assert.ok(checklist.items.some((row) => row.id === 'hsm-status' && row.status === 'BLOCKED_MISSING_INPUT'));
  });

  it('keeps provider certification handoffs exact per adapter family', () => {
    const families = providerCertificationHandoffs().map((row) => row.family);
    assert.deepEqual(families, [
      'bank-baas',
      'payment-rails',
      'fx',
      'cards',
      'kyc',
      'aml-sanctions',
      'travel-rule',
      'custody',
      'market-data',
      'oracles',
      'blockchain-analytics',
      'ai-model',
    ]);
  });

  it('does not create parallel gate or legal packages', () => {
    for (const pkg of FORBIDDEN_PARALLEL_PACKAGES) {
      assert.equal(existsSync(join(process.cwd(), pkg)), false);
    }
  });

  it('matches the checked-in External Input Registry JSON', () => {
    const snapshot = currentRepositoryGateSnapshot();
    const serialized = serializeExternalInputRegistry(snapshot);
    const onDisk = JSON.parse(
      readFileSync(join(process.cwd(), 'docs/productization/sunrey-external-input-registry.json'), 'utf8'),
    ) as { totalGates: number; releaseDecision: string; registryHash: string };
    assert.equal(onDisk.totalGates, serialized.totalGates);
    assert.equal(onDisk.releaseDecision, 'BLOCKED');
    assert.equal(onDisk.registryHash, snapshot.registryHash);
    const report = readFileSync(join(process.cwd(), 'docs/productization/SUNREY_PRODUCTION_GATE_REPORT.md'), 'utf8');
    assert.match(report, /BACKEND SOFTWARE READY=true/);
    assert.match(report, /EXTERNAL GATES MISSING=true/);
    assert.match(report, /PRODUCTION ACTIVE=false/);
    assert.match(report, /RELEASE_DECISION=BLOCKED/);
    assert.match(formatProductionGateReport(snapshot), /RELEASE_DECISION=BLOCKED/);
    assert.equal(PRODUCTION_GATE_CATALOG.length, snapshot.inputs.length);
  });
});
