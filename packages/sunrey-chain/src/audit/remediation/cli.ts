import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateAuditRemediationBundle, verifyAuditRemediationBundle } from './bundle.ts';
import { deriveCandidateV2AuditState } from './candidate-v2.ts';
import { publicFindingView } from './disclosure.ts';
import {
  FIXTURE_CRITICAL_ID,
  fixtureFindings,
  fixtureReview,
} from './fixtures.ts';
import { applyExternalFindingTransition, receiveExternalFinding } from './finding.ts';
import { createRemediationPlan, recordRemediationEvidence } from './plan.ts';
import { DEFAULT_PRODUCTION_SECURITY_POLICY } from './policy.ts';
import {
  bindAdversarialRegression,
  bindFormalRegression,
  minimizedFuzzCorpusEntry,
  recordPerformanceComparison,
  recordRegressionEvidence,
} from './regression.ts';
import { queryReleaseSecurityState } from './release-query.ts';
import { buildSecurityReviewStatusReport } from './report.ts';
import { reproduceFinding } from './reproduce.ts';
import { createRetestRequest } from './retest.ts';
import { createExternalSecurityReview } from './review.ts';
import { createSecurityRiskAcceptance } from './risk.ts';
import { RemediationStore } from './store.ts';
import type { ActorKind, ExternalSecurityFinding, FindingState } from './types.ts';

export type RemediationCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function loadImportedReview(path: string): RemediationStore {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    readonly review?: Parameters<typeof createExternalSecurityReview>[0];
    readonly findings?: readonly Parameters<typeof receiveExternalFinding>[0][];
    readonly fixture?: boolean;
  };
  const store = new RemediationStore();
  const fixture = parsed.fixture === true || parsed.review?.fixture === true;
  if (parsed.review) {
    store.putReview(createExternalSecurityReview({ ...parsed.review, fixture }));
  }
  for (const row of parsed.findings ?? []) {
    const received = receiveExternalFinding({ ...row, fixture: fixture || row.fixture === true });
    store.putFinding(received.finding, received.chain);
  }
  return store;
}

function demoStore(): RemediationStore {
  const store = new RemediationStore();
  store.putReview(fixtureReview());
  for (const finding of fixtureFindings()) {
    store.putFinding(finding);
  }
  return store;
}

function resolveStore(root: string, argv: readonly string[]): RemediationStore {
  const importFlag = argv.findIndex((row) => row === '--import');
  if (importFlag >= 0 && argv[importFlag + 1]) {
    const target = argv[importFlag + 1]!;
    return loadImportedReview(target.startsWith('/') ? target : join(root, target));
  }
  return demoStore();
}

export function runAuditRemediationCommand(
  root: string,
  command: string,
  argv: readonly string[],
): RemediationCliResult | null {
  if (command === 'review' && argv[0] === 'import') {
    const path = argv[1];
    if (!path || !existsSync(path.startsWith('/') ? path : join(root, path))) {
      return { ok: false, command: 'review import', payload: { error: 'import path required' } };
    }
    const store = loadImportedReview(path.startsWith('/') ? path : join(root, path));
    const snap = store.snapshot();
    return {
      ok: true,
      command: 'review import',
      payload: {
        reviews: snap.reviews.length,
        findings: snap.findings.length,
        fixtureOnly: snap.reviews.every((row) => row.fixtureLabel !== null),
        claimsExternalAuditCompleted: false,
      },
    };
  }
  if (command === 'findings') {
    const store = resolveStore(root, argv);
    return {
      ok: true,
      command,
      payload: store.snapshot().findings.map((row) => ({
        findingId: row.findingId,
        status: row.status,
        externalSeverity: row.externalSeverity,
        title: row.title,
        fixtureLabel: row.fixtureLabel,
      })),
    };
  }
  if (command === 'finding' && argv[0] === 'show') {
    const store = resolveStore(root, argv);
    const finding = store.finding(argv[1] ?? FIXTURE_CRITICAL_ID);
    if (!finding) {
      return { ok: false, command: 'finding show', payload: { error: 'finding not found' } };
    }
    return {
      ok: true,
      command: 'finding show',
      payload: {
        finding,
        publicView: publicFindingView(finding),
      },
    };
  }
  if (command === 'finding' && argv[0] === 'reproduce') {
    const store = resolveStore(root, argv);
    const finding = store.finding(argv[1] ?? FIXTURE_CRITICAL_ID);
    if (!finding) {
      return { ok: false, command: 'finding reproduce', payload: { error: 'finding not found' } };
    }
    return {
      ok: true,
      command: 'finding reproduce',
      payload: reproduceFinding({
        finding,
        isolatedFixtureId: 'net_sunrey_testnet_1',
        adaptedFromExternalExample: true,
        reproduced: true,
        evidenceReference: 'isolated-fixture-reproduction',
      }),
    };
  }
  if (command === 'remediation') {
    const store = resolveStore(root, argv);
    const finding = store.finding(argv[0] ?? FIXTURE_CRITICAL_ID);
    if (!finding) {
      return { ok: false, command, payload: { error: 'finding not found' } };
    }
    const plan = createRemediationPlan({
      planId: `PLAN-${finding.findingId}`,
      finding,
      rootCauseDescription: 'TEST_FIXTURE root cause',
      affectedAuthorityBoundary: finding.affectedSurface,
      proposedFix: 'Use established primitives and protocol versioning.',
      migrationImpact: 'none',
      compatibilityImpact: 'explicit compatibility required for later commits',
      securityAssumptions: 'isolated testnet fixtures only',
      requiredTests: ['finding-regression', 'formal-smoke', 'fuzz-smoke'],
      owner: 'packages/sunrey-chain/src/audit',
      targetRelease: 'SUNREY_TESTNET_RC_1',
      usesEstablishedPrimitives: true,
    });
    return { ok: true, command, payload: plan };
  }
  if (command === 'regression') {
    const store = resolveStore(root, argv);
    const finding = store.finding(argv[0] ?? FIXTURE_CRITICAL_ID);
    if (!finding) {
      return { ok: false, command, payload: { error: 'finding not found' } };
    }
    return {
      ok: true,
      command,
      payload: {
        regression: recordRegressionEvidence({
          evidenceId: `REG-${finding.findingId}`,
          finding,
          testReference: 'packages/sunrey-chain/src/audit.remediation.test.ts',
          commit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          result: 'PASS',
          formalReference: bindFormalRegression(finding, 'FINDING_LIFECYCLE').invariantId,
          fuzzCorpusReference: minimizedFuzzCorpusEntry(finding, '00').corpusPath,
          adversarialScenarioId: bindAdversarialRegression(finding).scenarioId,
          performanceComparisonReference: recordPerformanceComparison({
            finding,
            hotPath: 'consensus.round',
            beforeOps: 100,
            afterOps: 98,
          }).hotPath,
        }),
      },
    };
  }
  if (command === 'retest-package') {
    const store = resolveStore(root, argv);
    const finding = store.finding(argv[0] ?? FIXTURE_CRITICAL_ID);
    if (!finding) {
      return { ok: false, command, payload: { error: 'finding not found' } };
    }
    const plan = createRemediationPlan({
      planId: `PLAN-${finding.findingId}`,
      finding,
      rootCauseDescription: 'TEST_FIXTURE',
      affectedAuthorityBoundary: finding.affectedSurface,
      proposedFix: 'established primitives',
      migrationImpact: 'none',
      compatibilityImpact: 'explicit',
      securityAssumptions: 'testnet',
      requiredTests: ['regression'],
      owner: 'security',
      targetRelease: 'SUNREY_TESTNET_RC_1',
    });
    const remediated = recordRemediationEvidence({
      evidenceId: `EV-${finding.findingId}`,
      plan,
      remediatedCommit: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      patchDigest: 'patch-digest',
      artifactHash: 'artifact-hash',
      notes: 'TEST_FIXTURE',
    });
    const regression = recordRegressionEvidence({
      evidenceId: `REG-${finding.findingId}`,
      finding,
      testReference: 'audit.remediation.test.ts',
      commit: remediated.remediatedCommit,
      result: 'PASS',
    });
    return {
      ok: true,
      command,
      payload: createRetestRequest({
        requestId: `RTR-${finding.findingId}`,
        finding,
        originalReportReference: finding.evidenceReference,
        remediated,
        regression,
      }),
    };
  }
  if (command === 'risk-acceptance') {
    return {
      ok: false,
      command,
      payload: {
        error: 'AI cannot accept security risk',
        usage: 'human security authority must call createSecurityRiskAcceptance',
      },
    };
  }
  if (command === 'status') {
    const store = resolveStore(root, argv);
    const snap = store.snapshot();
    const review = snap.reviews[0] ?? null;
    return {
      ok: true,
      command,
      payload: {
        report: buildSecurityReviewStatusReport({
          review,
          findings: snap.findings,
          acceptedRisks: snap.acceptedRisks,
          policy: snap.policy,
        }),
        candidateV2: deriveCandidateV2AuditState({ review, findings: snap.findings }),
        release: queryReleaseSecurityState({
          findings: snap.findings,
          acceptedRisks: snap.acceptedRisks,
          policy: snap.policy,
        }),
        claimsExternalAuditCompleted: false,
      },
    };
  }
  if (command === 'bundle') {
    const store = resolveStore(root, argv);
    const snap = store.snapshot();
    const review = snap.reviews[0] ?? null;
    const generated = generateAuditRemediationBundle({
      root,
      sourceCommit: 'local',
      review,
      findings: snap.findings,
      plans: snap.plans,
      remediationEvidence: snap.remediationEvidence,
      regressions: snap.regressions,
      retestRequests: snap.retestRequests,
      retestResults: snap.retestResults,
      acceptedRisks: snap.acceptedRisks,
      chain: snap.chain,
      status: buildSecurityReviewStatusReport({
        review,
        findings: snap.findings,
        acceptedRisks: snap.acceptedRisks,
        policy: DEFAULT_PRODUCTION_SECURITY_POLICY,
      }),
    });
    const verified = verifyAuditRemediationBundle(generated.outDir);
    return {
      ok: verified.ok,
      command,
      payload: {
        outDir: generated.outDir,
        bundleId: generated.bundle.bundleId,
        claimsExternalAuditCompleted: false,
        fixtureLabel: generated.bundle.fixtureLabel,
        verified,
      },
    };
  }
  return null;
}

export function transitionDemo(
  finding: ExternalSecurityFinding,
  to: FindingState,
  actor: ActorKind,
): ExternalSecurityFinding {
  return applyExternalFindingTransition(finding, {
    from: finding.status,
    to,
    actor,
    actorReference: actor === 'HUMAN' ? 'human-security' : 'ai-triage',
    timestampUtc: '1970-01-01T00:00:00Z',
    evidenceReference: 'demo',
    commitReference: finding.affectedCommit,
    humanApprovalReference: to === 'ACCEPTED_RISK' ? 'human-security' : null,
  }).finding;
}

export { createSecurityRiskAcceptance };
