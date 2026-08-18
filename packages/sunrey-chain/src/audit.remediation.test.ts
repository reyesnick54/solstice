import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CANDIDATE_V2_AUDIT_STATES,
  FINDING_AFFECTED_SURFACES,
  FINDING_SEVERITIES,
  FINDING_STATES,
  TEST_FIXTURE_NOT_EXTERNAL_AUDIT,
  acceptReviewEvidence,
  aiAcceptSecurityRisk,
  applyExternalFindingTransition,
  assertFixtureNeverReal,
  assertNoSilentDowngrade,
  bindAdversarialRegression,
  bindFormalRegression,
  buildSecurityReviewStatusReport,
  createExternalSecurityReview,
  createRemediationPlan,
  createRetestRequest,
  createSecurityRiskAcceptance,
  deriveCandidateV2AuditState,
  externalSeverityPreserved,
  fixtureFindings,
  fixtureReview,
  generateAuditRemediationBundle,
  informationalIsBlocker,
  isCriticalBlocker,
  limitationsFromAcceptedRisks,
  mapExternalSeverity,
  minimizedFuzzCorpusEntry,
  publicFindingView,
  publicPayloadExposesExploitDetail,
  queryReleaseSecurityState,
  receiveExternalFinding,
  recordPerformanceComparison,
  recordRegressionEvidence,
  recordRemediationEvidence,
  recordRetestResult,
  rejectTamperedRetest,
  reproduceFinding,
  retestCompatibilityExplicit,
  reviewSatisfiesRealExternalReadiness,
  runSunreyAudit,
  silentDowngrade,
  tamperRemediationBundleFile,
  verifyAuditRemediationBundle,
} from './audit/index.ts';
import { findingLifecycleModelHolds } from './audit/remediation/regression.ts';
import { DEFAULT_PRODUCTION_SECURITY_POLICY, approveProductionSecurityPolicy } from './audit/remediation/policy.ts';
import { providerSurfaceReference } from './audit/remediation/surfaces.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Chunk 83 audit remediation workflow', () => {
  it('models findings, surfaces, and preserved severity', () => {
    assert.deepEqual(FINDING_STATES, [
      'RECEIVED',
      'TRIAGED',
      'REPRODUCED',
      'REMEDIATION_IN_PROGRESS',
      'REMEDIATED_PENDING_RETEST',
      'EXTERNALLY_RETESTED',
      'ACCEPTED_RISK',
      'NOT_REPRODUCIBLE_WITH_EVIDENCE',
      'SUPERSEDED',
    ]);
    assert.deepEqual(FINDING_SEVERITIES, ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    assert.ok(FINDING_AFFECTED_SURFACES.includes('consensus'));
    assert.ok(FINDING_AFFECTED_SURFACES.includes('MoonRey_issuance'));
    assert.ok(FINDING_AFFECTED_SURFACES.includes('Exchange'));
    const received = receiveExternalFinding({
      findingId: 'FND-1',
      externalReviewId: 'REV-1',
      externalSeverity: 'reviewer-critical',
      title: 'example',
      affectedComponent: 'packages/sunrey-chain/rust/crates/consensus',
      affectedSurface: 'consensus',
      affectedCommit: 'aaa',
      descriptionReference: 'desc',
      evidenceReference: 'ev',
    }).finding;
    const triaged = applyExternalFindingTransition(received, {
      from: 'RECEIVED',
      to: 'TRIAGED',
      actor: 'AI',
      actorReference: 'ai-triage',
      timestampUtc: '1970-01-01T00:00:00Z',
      evidenceReference: 'triage',
      commitReference: 'aaa',
      internalEngineeringSeverity: 'CRITICAL',
    }).finding;
    assert.equal(externalSeverityPreserved(received.externalSeverity, triaged.externalSeverity), true);
    assert.equal(triaged.externalSeverity, 'reviewer-critical');
    assert.equal(mapExternalSeverity('reviewer-critical'), null);
    assert.equal(silentDowngrade('CRITICAL', 'LOW'), true);
    assert.throws(() => assertNoSilentDowngrade('CRITICAL', 'LOW'), /silently downgrades/);
  });

  it('refuses AI external retest, AI risk acceptance, and fixture-as-real', () => {
    const review = fixtureReview();
    assert.equal(review.fixtureLabel, TEST_FIXTURE_NOT_EXTERNAL_AUDIT);
    assert.equal(review.inventedAuditorName, false);
    assert.equal(reviewSatisfiesRealExternalReadiness(review), false);
    assert.throws(() => acceptReviewEvidence(review, 'HUMAN'), /cannot become a real external audit/);
    assert.throws(() => acceptReviewEvidence(review, 'AI'), /cannot become a real external audit/);
    assertFixtureNeverReal(review);
    const finding = fixtureFindings()[0]!;
    const pending = applyExternalFindingTransition(
      applyExternalFindingTransition(
        applyExternalFindingTransition(
          applyExternalFindingTransition(finding, {
            from: 'RECEIVED',
            to: 'TRIAGED',
            actor: 'AI',
            actorReference: 'ai',
            timestampUtc: '1970-01-01T00:00:00Z',
            evidenceReference: 't',
            commitReference: finding.affectedCommit,
            internalEngineeringSeverity: 'CRITICAL',
          }).finding,
          {
            from: 'TRIAGED',
            to: 'REPRODUCED',
            actor: 'HUMAN',
            actorReference: 'eng',
            timestampUtc: '1970-01-01T00:00:00Z',
            evidenceReference: 'r',
            commitReference: finding.affectedCommit,
          },
        ).finding,
        {
          from: 'REPRODUCED',
          to: 'REMEDIATION_IN_PROGRESS',
          actor: 'HUMAN',
          actorReference: 'eng',
          timestampUtc: '1970-01-01T00:00:00Z',
          evidenceReference: 'p',
          commitReference: finding.affectedCommit,
        },
      ).finding,
      {
        from: 'REMEDIATION_IN_PROGRESS',
        to: 'REMEDIATED_PENDING_RETEST',
        actor: 'HUMAN',
        actorReference: 'eng',
        timestampUtc: '1970-01-01T00:00:00Z',
        evidenceReference: 'fix',
        commitReference: 'bbb',
      },
    ).finding;
    assert.throws(
      () => applyExternalFindingTransition(pending, {
        from: 'REMEDIATED_PENDING_RETEST',
        to: 'EXTERNALLY_RETESTED',
        actor: 'AI',
        actorReference: 'ai',
        timestampUtc: '1970-01-01T00:00:00Z',
        evidenceReference: 'no',
        commitReference: 'bbb',
      }),
      /AI cannot assign EXTERNALLY_RETESTED/,
    );
    assert.throws(() => aiAcceptSecurityRisk(), /AI cannot accept security risk/);
    assert.throws(
      () => createSecurityRiskAcceptance({
        acceptanceId: 'RA-1',
        findingId: finding.findingId,
        reason: 'residual',
        impact: 'limited testnet',
        compensatingControls: ['monitoring'],
        expirationOrReviewDateUtc: '2027-01-01',
        humanSecurityAuthority: 'security-lead',
        releaseScope: 'testnet',
        actor: 'AI',
      }),
      /AI cannot accept security risk/,
    );
  });

  it('rejects tampered retest results, wrong-commit retest, and secret/restricted leakage', () => {
    const finding = fixtureFindings()[0]!;
    const plan = createRemediationPlan({
      planId: 'PLAN-1',
      finding,
      rootCauseDescription: 'isolated fixture',
      affectedAuthorityBoundary: 'consensus',
      proposedFix: 'Use established primitives and protocol versioning.',
      migrationImpact: 'none',
      compatibilityImpact: 'explicit',
      securityAssumptions: 'testnet',
      requiredTests: ['regression'],
      owner: 'security',
      targetRelease: 'SUNREY_TESTNET_RC_1',
      usesEstablishedPrimitives: true,
    });
    assert.equal(plan.heightenedReviewRequired, true);
    assert.throws(
      () => createRemediationPlan({
        planId: 'PLAN-BAD',
        finding: { ...finding, affectedSurface: 'cryptography' },
        rootCauseDescription: 'crypto',
        affectedAuthorityBoundary: 'cryptography',
        proposedFix: 'invent a homegrown cipher',
        migrationImpact: 'none',
        compatibilityImpact: 'none',
        securityAssumptions: 'none',
        requiredTests: [],
        owner: 'security',
        targetRelease: 'x',
        usesEstablishedPrimitives: false,
      }),
      /homegrown cryptography/,
    );
    const remediated = recordRemediationEvidence({
      evidenceId: 'EV-1',
      plan,
      remediatedCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      patchDigest: 'patch',
      artifactHash: 'hash',
      notes: 'TEST_FIXTURE',
    });
    const regression = recordRegressionEvidence({
      evidenceId: 'REG-1',
      finding,
      testReference: 'audit.remediation.test.ts',
      commit: remediated.remediatedCommit,
      result: 'PASS',
      formalReference: bindFormalRegression(finding, 'FINDING_LIFECYCLE').invariantId,
      fuzzCorpusReference: minimizedFuzzCorpusEntry(finding, '00').corpusPath,
      adversarialScenarioId: bindAdversarialRegression(finding).scenarioId,
    });
    const request = createRetestRequest({
      requestId: 'RTR-1',
      finding,
      originalReportReference: finding.evidenceReference,
      remediated,
      regression,
    });
    assert.throws(
      () => recordRetestResult({
        resultId: 'RES-AI',
        request,
        reviewerIdentityReference: 'ai',
        dateUtc: '1970-01-01T00:00:00Z',
        scope: 'consensus',
        result: 'PASS',
        reportDigest: 'digest',
        actor: 'AI',
        boundCommit: remediated.remediatedCommit,
      }),
      /cannot generate an external-pass/,
    );
    assert.throws(
      () => recordRetestResult({
        resultId: 'RES-WRONG',
        request,
        reviewerIdentityReference: 'reviewer-ref',
        dateUtc: '1970-01-01T00:00:00Z',
        scope: 'consensus',
        result: 'PASS',
        reportDigest: 'digest',
        actor: 'HUMAN',
        boundCommit: 'unrelated-future-commit',
      }),
      /cannot automatically clear/,
    );
    const result = recordRetestResult({
      resultId: 'RES-1',
      request,
      reviewerIdentityReference: 'reviewer-ref',
      dateUtc: '1970-01-01T00:00:00Z',
      scope: 'consensus',
      result: 'PASS',
      reportDigest: 'digest',
      actor: 'HUMAN',
      boundCommit: remediated.remediatedCommit,
    });
    assert.equal(result.softwareGenerated, false);
    assert.throws(() => rejectTamperedRetest(result, 'other-digest'), /tampered retest result rejected/);
    assert.equal(retestCompatibilityExplicit(result, 'unrelated-future-commit', false), false);
    assert.equal(retestCompatibilityExplicit(result, 'unrelated-future-commit', true), true);
    const view = publicFindingView(finding);
    assert.equal(view.exploitDetailExposed, false);
    assert.equal(publicPayloadExposesExploitDetail('exploit poc payload', 'SECURITY_RESTRICTED'), true);
    const perf = recordPerformanceComparison({ finding, hotPath: 'consensus.round', beforeOps: 100, afterOps: 98 });
    assert.equal(perf.correctnessPreferred, true);
    assert.equal(findingLifecycleModelHolds([{ from: 'RECEIVED', to: 'TRIAGED' }]), true);
  });

  it('keeps critical findings as blockers and does not treat informational the same', () => {
    const [critical, , info] = fixtureFindings();
    const openCritical = applyExternalFindingTransition(critical!, {
      from: 'RECEIVED',
      to: 'TRIAGED',
      actor: 'HUMAN',
      actorReference: 'eng',
      timestampUtc: '1970-01-01T00:00:00Z',
      evidenceReference: 't',
      commitReference: critical!.affectedCommit,
      internalEngineeringSeverity: 'CRITICAL',
    }).finding;
    const openInfo = applyExternalFindingTransition(info!, {
      from: 'RECEIVED',
      to: 'TRIAGED',
      actor: 'HUMAN',
      actorReference: 'eng',
      timestampUtc: '1970-01-01T00:00:00Z',
      evidenceReference: 't',
      commitReference: info!.affectedCommit,
      internalEngineeringSeverity: 'INFORMATIONAL',
    }).finding;
    assert.equal(isCriticalBlocker(openCritical), true);
    assert.equal(informationalIsBlocker(openInfo), false);
    const policy = approveProductionSecurityPolicy({
      criticalOpenFindingsBlockMainnet: true,
      highOpenFindingsPolicy: 'BLOCK_PRODUCTION',
      informationalFindingsBlockMainnet: false,
    }, 'human-security');
    const query = queryReleaseSecurityState({
      findings: [openCritical, openInfo],
      acceptedRisks: [],
      policy,
    });
    assert.deepEqual(query.openCriticalFindings, [openCritical.findingId]);
    assert.equal(query.criticalIsMainnetBlocker, true);
    assert.equal(query.claimsExternalAuditCompleted, false);
    const accepted = createSecurityRiskAcceptance({
      acceptanceId: 'RA-INFO',
      findingId: openInfo.findingId,
      reason: 'documentation only',
      impact: 'none',
      compensatingControls: ['docs'],
      expirationOrReviewDateUtc: '2027-01-01',
      humanSecurityAuthority: 'human-security',
      releaseScope: 'testnet',
      actor: 'HUMAN',
    });
    const limitations = limitationsFromAcceptedRisks([openInfo], [accepted]);
    assert.equal(limitations[0]?.status, 'ACCEPTED_WITH_HUMAN_APPROVAL');
    assert.equal(limitations[0]?.limitation_id.includes(openInfo.findingId), true);
  });

  it('hashes the remediation bundle and detects tamper; excludes secrets', () => {
    const review = fixtureReview();
    const findings = fixtureFindings();
    const status = buildSecurityReviewStatusReport({
      review,
      findings,
      acceptedRisks: [],
      policy: DEFAULT_PRODUCTION_SECURITY_POLICY,
    });
    assert.equal(status.claimsExternalAuditCompleted, false);
    assert.equal(status.fixtureOnly, true);
    assert.equal(status.candidateV2State, 'NO_EXTERNAL_REVIEW');
    const outDir = join(mkdtempSync(join(tmpdir(), 'sunrey-audit-remediation-')), 'bundle');
    const generated = generateAuditRemediationBundle({
      root: ROOT,
      sourceCommit: 'aaa',
      review,
      findings,
      plans: [],
      remediationEvidence: [],
      regressions: [],
      retestRequests: [],
      retestResults: [],
      acceptedRisks: [],
      chain: [],
      status,
      outDir,
    });
    assert.equal(generated.bundle.claimsExternalAuditCompleted, false);
    assert.equal(generated.bundle.fixtureLabel, TEST_FIXTURE_NOT_EXTERNAL_AUDIT);
    assert.equal(verifyAuditRemediationBundle(outDir).ok, true);
    tamperRemediationBundleFile(outDir, 'findings.json', '{"tampered":true}\n');
    const tampered = verifyAuditRemediationBundle(outDir);
    assert.equal(tampered.ok, false);
    assert.equal(tampered.checks.some((row) => row.id.startsWith('hash:') && !row.ok), true);
    const secretFinding = receiveExternalFinding({
      findingId: 'FND-SECRET-BUNDLE',
      externalReviewId: review.reviewId,
      externalSeverity: 'HIGH',
      title: 'secret must be excluded',
      affectedComponent: 'packages/security',
      affectedSurface: 'cryptography',
      affectedCommit: 'aaa',
      descriptionReference: 'restricted',
      evidenceReference: '-----BEGIN ' + 'PRIVATE KEY-----\nMIIB',
      disclosureClass: 'SECURITY_RESTRICTED',
      fixture: true,
    }).finding;
    assert.throws(
      () => generateAuditRemediationBundle({
        root: ROOT,
        sourceCommit: 'aaa',
        review,
        findings: [secretFinding],
        plans: [],
        remediationEvidence: [],
        regressions: [],
        retestRequests: [],
        retestResults: [],
        acceptedRisks: [],
        chain: [],
        status,
        outDir: join(outDir, 'secrets'),
      }),
      /secret evidence excluded/,
    );
  });

  it('does not treat a secret-bearing finding description as public', () => {
    const finding = receiveExternalFinding({
      findingId: 'FND-SECRET',
      externalReviewId: 'REV-1',
      externalSeverity: 'HIGH',
      title: 'key handling',
      affectedComponent: 'packages/security',
      affectedSurface: 'cryptography',
      affectedCommit: 'aaa',
      descriptionReference: 'see restricted evidence',
      evidenceReference: '-----BEGIN ' + 'PRIVATE KEY-----\nMIIB',
      disclosureClass: 'SECURITY_RESTRICTED',
    }).finding;
    const view = publicFindingView(finding);
    assert.equal(view.description.includes('PRIVATE KEY'), false);
    assert.equal(view.exploitDetailExposed, false);
  });

  it('reproduces only against isolated fixtures and binds provider surfaces', () => {
    const finding = fixtureFindings()[3]!;
    assert.equal(finding.providerSurfaceReference, 'chunk82:hsm_custody:sim-provider');
    const reproduced = reproduceFinding({
      finding,
      isolatedFixtureId: 'net_sunrey_testnet_1',
      adaptedFromExternalExample: true,
      reproduced: true,
      evidenceReference: 'iso',
    });
    assert.equal(reproduced.productionTarget, false);
    assert.throws(
      () => reproduceFinding({
        finding,
        isolatedFixtureId: 'mainnet-prod',
        adaptedFromExternalExample: true,
        reproduced: true,
        evidenceReference: 'no',
      }),
      /must not target production/,
    );
    const surface = providerSurfaceReference({
      surfaceId: 'chunk82:hsm_custody:sim-provider',
      providerKind: 'hsm_custody',
      inReviewScope: true,
    });
    assert.equal(surface.chunk82Contract, true);
  });

  it('projects Candidate V2 states without inventing a completed state', () => {
    assert.ok(!CANDIDATE_V2_AUDIT_STATES.includes('COMPLETED' as never));
    assert.ok(!CANDIDATE_V2_AUDIT_STATES.includes('PASSED' as never));
    assert.equal(deriveCandidateV2AuditState({ review: null, findings: [] }), 'NO_EXTERNAL_REVIEW');
    assert.equal(deriveCandidateV2AuditState({ review: fixtureReview(), findings: fixtureFindings() }), 'NO_EXTERNAL_REVIEW');
    const real = createExternalSecurityReview({
      reviewId: 'REV-REAL-SLOT',
      reviewOrganizationReference: 'org_ref_supplied_later',
      scope: 'consensus',
      sourceCommit: 'ccc',
      protocolVersion: '1',
    });
    assert.equal(deriveCandidateV2AuditState({ review: real, findings: [] }), 'EXTERNAL_REVIEW_IN_PROGRESS');
    const open = receiveExternalFinding({
      findingId: 'FND-OPEN',
      externalReviewId: real.reviewId,
      externalSeverity: 'HIGH',
      title: 'open',
      affectedComponent: 'x',
      affectedSurface: 'wallets',
      affectedCommit: 'ccc',
      descriptionReference: 'd',
      evidenceReference: 'e',
    }).finding;
    assert.equal(deriveCandidateV2AuditState({ review: real, findings: [open] }), 'FINDINGS_OPEN');
  });

  it('exposes CLI review, finding, remediation, retest, status, and bundle commands', () => {
    const findings = runSunreyAudit(ROOT, ['findings']);
    assert.equal(findings.ok, true);
    const show = runSunreyAudit(ROOT, ['finding', 'show', 'FND-TEST-CRITICAL-001']);
    assert.equal(show.ok, true);
    const reproduce = runSunreyAudit(ROOT, ['finding', 'reproduce', 'FND-TEST-CRITICAL-001']);
    assert.equal(reproduce.ok, true);
    const remediation = runSunreyAudit(ROOT, ['remediation', 'FND-TEST-CRITICAL-001']);
    assert.equal(remediation.ok, true);
    const regression = runSunreyAudit(ROOT, ['regression', 'FND-TEST-CRITICAL-001']);
    assert.equal(regression.ok, true);
    const retest = runSunreyAudit(ROOT, ['retest-package', 'FND-TEST-CRITICAL-001']);
    assert.equal(retest.ok, true);
    const risk = runSunreyAudit(ROOT, ['risk-acceptance']);
    assert.equal(risk.ok, false);
    const status = runSunreyAudit(ROOT, ['status']);
    assert.equal(status.ok, true);
    assert.equal((status.payload as { claimsExternalAuditCompleted: boolean }).claimsExternalAuditCompleted, false);
    const bundle = runSunreyAudit(ROOT, ['bundle']);
    assert.equal(bundle.ok, true);
  });
});
