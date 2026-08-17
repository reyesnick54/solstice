import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  AUDIT_CLAIMS_EXTERNAL_AUDIT,
  AUDIT_FIXTURE_GENESIS_HASH,
  AUDIT_TESTNET_NETWORK_ID,
  CODE_OWNERSHIP_MAP,
  FINDING_LIFECYCLE,
  KNOWN_SECURITY_LIMITATIONS,
  REVIEW_DOMAINS,
  SANITIZED_SAMPLE_CONFIG,
  SECURITY_CONTROLS,
  THREAT_MODELS,
  TRUST_BOUNDARIES,
  actorMayResolve,
  applyFindingTransition,
  buildReadinessReport,
  classifyReadiness,
  controlCount,
  controlsLinkedToTests,
  createSecurityException,
  evidenceMap,
  generateAuditBundle,
  grantExceptionAutomatically,
  limitationCount,
  receiveFinding,
  reproduceCritical,
  requiredReviewDomains,
  reviewerSeverityPreserved,
  runSunreyAudit,
  scopeIsComplete,
  secretExclusionFindings,
  suggestInternalSeverity,
  tamperBundleFile,
  trustBoundaryIds,
  verifyAuditBundle,
} from './audit/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 62 SunRey independent security-review package', () => {
  it('covers every required review domain and canonical owner path', () => {
    assert.equal(scopeIsComplete(), true);
    assert.deepEqual(requiredReviewDomains(), REVIEW_DOMAINS);
    assert.equal(REVIEW_DOMAINS.length, 16);
    assert.equal(CODE_OWNERSHIP_MAP.some((row) => row.canonicalPath === 'packages/sunrey-chain/rust/crates/consensus'), true);
    assert.equal(CODE_OWNERSHIP_MAP.some((row) => row.canonicalPath === 'packages/custody'), true);
    assert.equal(CODE_OWNERSHIP_MAP.some((row) => row.canonicalPath === 'packages/sunrey-exchange'), true);
    assert.equal(CODE_OWNERSHIP_MAP.some((row) => row.canonicalPath === 'packages/security'), true);
    assert.equal(CODE_OWNERSHIP_MAP.some((row) => row.canonicalPath === 'packages/sunrey-audit'), false);
  });

  it('maps trust boundaries, assets, threats, and controls to tests', () => {
    assert.deepEqual(trustBoundaryIds().slice().sort(), [
      'clean_room',
      'custody_hsm',
      'exchange',
      'explorer',
      'governance_authority',
      'oracle_provider',
      'personal_data_vault',
      'public_rpc',
      'relayer',
      'release_authority',
      'remote_signer',
      'sdk',
      'sentry',
      'validator',
      'wallet_signer',
    ]);
    assert.ok(TRUST_BOUNDARIES.some((row) => row.id === 'custody_hsm' && row.mayContainSecrets));
    assert.ok(TRUST_BOUNDARIES.some((row) => row.id === 'sentry' && !row.mayContainSecrets));
    assert.equal(THREAT_MODELS.length, 13);
    assert.equal(controlsLinkedToTests(), true);
    assert.ok(controlCount() >= 30);
    assert.ok(evidenceMap().length >= SECURITY_CONTROLS.length);
    assert.ok(limitationCount() >= 8);
    assert.equal(KNOWN_SECURITY_LIMITATIONS.some((row) => row.limitation_id === 'LIM-NO-EXTERNAL-AUDIT'), true);
    assert.equal(KNOWN_SECURITY_LIMITATIONS.some((row) => row.limitation_id === 'LIM-NO-PRODUCTION-HSM'), true);
  });

  it('generates a deterministic signed bundle and detects tamper', () => {
    const first = generateAuditBundle(ROOT, {
      sourceCommit: 'abc123def456',
      generatedTimestamp: '1970-01-01T00:00:00Z',
      outDir: join(ROOT, 'dist', 'sunrey-audit-a'),
    });
    const second = generateAuditBundle(ROOT, {
      sourceCommit: 'abc123def456',
      generatedTimestamp: '1970-01-01T00:00:00Z',
      outDir: join(ROOT, 'dist', 'sunrey-audit-b'),
    });
    assert.equal(first.manifest.bundle_id, second.manifest.bundle_id);
    assert.equal(first.manifest.sbom_digest, second.manifest.sbom_digest);
    assert.equal(first.manifest.formal_report_digest, second.manifest.formal_report_digest);
    assert.equal(first.manifest.security_range_report_digest, second.manifest.security_range_report_digest);
    assert.equal(first.manifest.testnet_network_id, AUDIT_TESTNET_NETWORK_ID);
    assert.equal(first.manifest.genesis_hash, AUDIT_FIXTURE_GENESIS_HASH);
    assert.equal(first.manifest.claims_external_audit_completed, false);
    assert.equal(AUDIT_CLAIMS_EXTERNAL_AUDIT, false);
    assert.equal(first.secretFindings.length, 0);
    const verified = verifyAuditBundle(first.outDir);
    assert.equal(verified.ok, true, JSON.stringify(verified.checks.filter((row) => !row.ok)));

    tamperBundleFile(first.outDir, 'generated/review-instructions.md', '# tampered\n');
    const tampered = verifyAuditBundle(first.outDir);
    assert.equal(tampered.ok, false);
    assert.equal(tampered.checks.some((row) => row.id.startsWith('hash:') && !row.ok), true);
  });

  it('excludes secrets from the reviewer bundle and sample config', () => {
    const generated = generateAuditBundle(ROOT, {
      sourceCommit: 'secret-check',
      outDir: join(ROOT, 'dist', 'sunrey-audit-secrets'),
    });
    const sample = readFileSync(join(generated.outDir, 'generated/sample-config.json'), 'utf8');
    assert.equal(secretExclusionFindings(sample).length, 0);
    assert.equal(sample.includes('TEST_ONLY_PUBLIC_KEY_PLACEHOLDER'), true);
    assert.equal(sample.includes('BEGIN PRIVATE KEY'), false);
    assert.equal(JSON.stringify(SANITIZED_SAMPLE_CONFIG).includes('private_key'), false);
    assert.ok(secretExclusionFindings('-----BEGIN ' + 'PRIVATE KEY-----\nMIIB').length > 0);
  });

  it('enforces finding lifecycle and refuses AI resolution', () => {
    assert.deepEqual(FINDING_LIFECYCLE, [
      'RECEIVED',
      'TRIAGED',
      'REMEDIATION_IN_PROGRESS',
      'READY_FOR_RETEST',
      'VERIFIED_RESOLVED',
      'ACCEPTED_RISK_WITH_HUMAN_APPROVAL',
    ]);
    const received = receiveFinding({
      finding_id: 'FND-1',
      reviewer_reference: 'ext-1',
      title: 'example',
      description: 'reviewer text',
      affected_component: 'packages/sunrey-chain/rust/crates/consensus',
      reviewer_severity: 'reviewer-critical',
    });
    const triaged = applyFindingTransition(received, {
      from: 'RECEIVED',
      to: 'TRIAGED',
      actor: 'AI',
      humanApprovalReference: null,
    }, { internal_severity: 'S2_HIGH' });
    assert.equal(reviewerSeverityPreserved(received, triaged), true);
    assert.equal(triaged.reviewer_severity, 'reviewer-critical');
    assert.equal(suggestInternalSeverity(triaged.reviewer_severity), null);
    const inProgress = applyFindingTransition(triaged, {
      from: 'TRIAGED',
      to: 'REMEDIATION_IN_PROGRESS',
      actor: 'HUMAN',
      humanApprovalReference: null,
    }, { remediation_reference: 'pr-1' });
    const ready = applyFindingTransition(inProgress, {
      from: 'REMEDIATION_IN_PROGRESS',
      to: 'READY_FOR_RETEST',
      actor: 'HUMAN',
      humanApprovalReference: null,
    });
    assert.equal(actorMayResolve('AI'), false);
    assert.throws(
      () => applyFindingTransition(ready, {
        from: 'READY_FOR_RETEST',
        to: 'VERIFIED_RESOLVED',
        actor: 'AI',
        humanApprovalReference: null,
      }),
      /AI cannot mark/,
    );
    const resolved = applyFindingTransition(ready, {
      from: 'READY_FOR_RETEST',
      to: 'VERIFIED_RESOLVED',
      actor: 'HUMAN',
      humanApprovalReference: 'reviewer-retest-1',
    }, { verification_evidence: 'retest-log' });
    assert.equal(resolved.resolution_status, 'VERIFIED_RESOLVED');
    assert.equal(resolved.reviewer_severity, 'reviewer-critical');
  });

  it('refuses automatic security exceptions', () => {
    assert.throws(() => grantExceptionAutomatically(), /not granted automatically/);
    assert.throws(
      () => createSecurityException({
        exception_id: 'EX-1',
        scope: 'pqc',
        reason: 'dev',
        owner: 'security',
        expirationOrReviewDate: '2026-12-31',
        mitigation: 'testnet only',
        humanApprovalReference: '',
      }),
      /human approval/,
    );
    const granted = createSecurityException({
      exception_id: 'EX-1',
      scope: 'pqc-testnet',
      reason: 'development hybrid rehearsal',
      owner: 'packages/security',
      expirationOrReviewDate: '2026-12-31',
      mitigation: 'TESTNET_APPROVED only',
      humanApprovalReference: 'human-review-1',
    });
    assert.equal(granted.grantedAutomatically, false);
  });

  it('classifies audit readiness as an engineering package status', () => {
    const ready = classifyReadiness({ missingArtifacts: [], knownLimitationCount: 0 });
    assert.equal(ready, 'READY_FOR_EXTERNAL_REVIEW');
    const limited = buildReadinessReport();
    assert.equal(limited.category, 'READY_WITH_KNOWN_LIMITATIONS');
    assert.equal(limited.claims_external_audit_completed, false);
    assert.equal(classifyReadiness({ missingArtifacts: ['missing.md'], knownLimitationCount: 1 }), 'MISSING_REVIEW_ARTIFACT');
  });

  it('runs reproduction and CLI commands with test-only keys', () => {
    const reproduced = reproduceCritical(ROOT);
    assert.equal(reproduced.ok, true, JSON.stringify(reproduced.steps.filter((row) => !row.ok)));
    assert.equal(reproduced.usedTestOnlyKeys, true);
    const generated = runSunreyAudit(ROOT, ['generate']);
    assert.equal(generated.ok, true);
    const verified = runSunreyAudit(ROOT, ['verify', 'dist/sunrey-audit']);
    assert.equal(verified.ok, true);
    const scope = runSunreyAudit(ROOT, ['scope']);
    assert.equal(scope.ok, true);
    const readiness = runSunreyAudit(ROOT, ['readiness']);
    assert.equal(readiness.ok, true);
    const quickstart = runSunreyAudit(ROOT, ['quickstart']);
    assert.equal(quickstart.ok, true);
  });

  it('keeps a scratch copy secret-free even if a reviewer adds a private-key marker', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-audit-'));
    writeFileSync(join(dir, 'note.txt'), 'safe');
    assert.equal(secretExclusionFindings('safe').length, 0);
    assert.ok(secretExclusionFindings('-----BEGIN ' + 'OPENSSH PRIVATE KEY-----').length > 0);
  });
});
