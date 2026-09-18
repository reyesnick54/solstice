/**
 * HELIOS H36 — release evidence package and live-pilot external gate.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_H36_RELEASE_EVIDENCE_LIVE_PILOT_GATE,
  HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING,
  HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
  HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED,
  LIVE_PILOT_GATE_CATALOG,
  LIVE_PILOT_GATE_CLASSES,
  PILOT_ACTIVATION_CEREMONY_STEPS,
  READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION,
  buildHeliosClosureReport,
  buildHeliosReleaseEvidencePackage,
  buildHeliosWorkPackageRegistry,
  buildLivePilotAuthorization,
  buildPilotActivationCeremonyContract,
  evaluateLivePilotGate,
  evaluateReleaseCandidateQualification,
  heliosReleaseIdFor,
  livePilotScopeIdFor,
  pilotAuthorizationOutcome,
  refuseAiAuthorization,
  refuseAiGateSatisfaction,
  refuseLiveActivation,
  createDefaultLivePilotGateItems,
  applyGateItemUpdate,
  HeliosReleaseEvidenceService,
  InMemoryReleaseEvidenceStore,
  type ExternalEvidenceRef,
  type LivePilotScope,
} from '../packages/platform/src/helios/release-evidence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = asUtcInstant('2026-09-18T13:30:00.000Z');

function gitSha(): string {
  const head = join(ROOT, '.git', 'HEAD');
  if (!existsSync(head)) return '0000000000000000000000000000000000000000';
  const ref = readFileSync(head, 'utf8').trim();
  if (ref.startsWith('ref: ')) {
    const refPath = join(ROOT, '.git', ref.slice(5));
    if (existsSync(refPath)) return readFileSync(refPath, 'utf8').trim();
  }
  return ref;
}

function allReleaseChecksPass() {
  return Object.freeze({
    architectureChecksPass: true,
    typecheckBuildPass: true,
    databaseQualificationPass: true,
    migrationsCurrent: true,
    apiOpenApiPass: true,
    persistenceRestartPass: true,
    customerIsolationPass: true,
    securitySafetyChecksPass: true,
    resilienceH31Qualified: true,
    economicEvaluationH32Qualified: true,
    capacityH33Qualified: true,
    rollbackH34Qualified: true,
    growProductContractQualified: true,
    releaseShaBound: true,
    liveFlagsRemainFalse: true,
  });
}

function allHetznerChecksPass() {
  return Object.freeze({
    deploymentManifestPresent: existsSync(join(ROOT, 'deploy/sunrey-sandbox-hetzner/docker-compose.yml')),
    consumerBffWired: existsSync(join(ROOT, 'services/api/src/preview-main.ts')),
    growControlsDocumented: true,
    environmentLabelingCorrect: ENVIRONMENT === 'simulation',
    restartAcceptancePass: true,
    appAcceptanceEvidenceBound: true,
    noLiveConnectivityClaimed: !LIVE_CONNECTIVITY_ENABLED,
  });
}

function sampleScope(sha: string): LivePilotScope {
  return Object.freeze({
    scopeId: livePilotScopeIdFor('pilot-demo'),
    jurisdiction: 'US-CA-SIMULATION',
    legalEntity: 'UNASSIGNED_LEGAL_ENTITY',
    customerClass: 'INTERNAL_PILOT_CUSTOMER',
    customers: Object.freeze(['customer:pilot-001']),
    product: 'GROW_PAPER_TO_LIVE_PILOT',
    provider: 'simulated-investment-provider',
    accountType: 'INDIVIDUAL_BROKERAGE',
    instrumentProductClasses: Object.freeze(['EQUITY_ETF']),
    maximumCapitalMinor: 100_000n,
    currency: 'USD',
    strategyCapsuleIds: Object.freeze(['strategy-capsule:qualified-demo']),
    modelVersions: Object.freeze(['s3m-finance:v1', 'grok-research:v1']),
    startDate: NOW,
    endDate: asUtcInstant('2026-12-31T23:59:59.000Z'),
    riskLimits: Object.freeze(['max_drawdown_bps:500', 'max_single_name_bps:1000']),
    reportingBasis: 'REGULATORY_EVIDENCE_H29',
    environment: ENVIRONMENT,
    operationalOwnerRole: 'AUTHORIZED_GOVERNANCE_OPERATIONS',
  });
}

function humanEvidence(ref: string): ExternalEvidenceRef {
  return Object.freeze({
    evidenceRef: ref,
    kind: 'HUMAN_APPROVAL_RECORD',
    description: 'External human approval evidence',
    recordedAt: NOW,
    sha256: null,
    expiresAt: null,
  });
}

describe('HELIOS H36 — release evidence and live-pilot gate', () => {
  it('architecture guard: release-evidence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    assert.deepEqual(findings, []);
  });

  it('1. builds canonical HELIOSReleaseEvidencePackage bound to Git SHA', () => {
    const sha = gitSha();
    const pkg = buildHeliosReleaseEvidencePackage({
      gitSha: sha,
      baseSha: sha,
      artifactDigest: `sha256:artifact:${sha.slice(0, 12)}`,
      releaseManifestRef: 'manifest:helios-rc',
      buildWorkflowRef: 'github-actions:ci',
      buildRunRef: 'ci:local',
      releaseDate: NOW,
      releasePackageChecks: allReleaseChecksPass(),
      hetznerAcceptanceChecks: allHetznerChecksPass(),
    });

    assert.equal(pkg.schema, 'sunrey.helios.release-evidence.v1');
    assert.equal(pkg.identity.gitSha, sha);
    assert.equal(pkg.engineering.engineeringQualified, true);
    assert.equal(pkg.operations.hetznerRelease.marker, HELIOS_HETZNER_APP_ACCEPTANCE_QUALIFIED);
    assert.equal(pkg.engineering.integratedAcceptanceH35.marker, HELIOS_RELEASE_PACKAGE_QUALIFIED);
    assert.match(pkg.packageHash, /^[a-f0-9]{64}$/);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(LIVE_CONNECTIVITY_ENABLED, false);
  });

  it('2. models external live-pilot gate checklist across eight classes', () => {
    const classes = new Set(LIVE_PILOT_GATE_CATALOG.map((row) => row.gateClass));
    for (const gateClass of LIVE_PILOT_GATE_CLASSES) {
      assert.ok(classes.has(gateClass), gateClass);
    }
    assert.ok(LIVE_PILOT_GATE_CATALOG.length >= 60);
  });

  it('3. refuses AI satisfaction of external gates without evidence', () => {
    const items = createDefaultLivePilotGateItems(NOW);
    const legalItem = items.find((row) => row.itemKey === 'operating_legal_entity_identified');
    assert.ok(legalItem);
    assert.throws(
      () =>
        refuseAiGateSatisfaction({
          actorKind: 'AI',
          nextState: 'SATISFIED',
          requiresExternalEvidence: true,
        }),
      /AI cannot set external live-pilot gates to SATISFIED/,
    );
    assert.throws(
      () =>
        applyGateItemUpdate(legalItem!, {
          nextState: 'SATISFIED',
          evidenceRefs: [],
          actorIsAuthorizedGovernance: false,
          updatedAt: NOW,
        }),
      /requires external evidence refs/,
    );
  });

  it('4. engineering RC qualified with external gates pending by default', () => {
    const sha = gitSha();
    const pkg = buildHeliosReleaseEvidencePackage({
      gitSha: sha,
      artifactDigest: `sha256:artifact:${sha.slice(0, 12)}`,
      releaseManifestRef: 'manifest:helios-rc',
      buildWorkflowRef: 'github-actions:ci',
      buildRunRef: 'ci:local',
      releaseDate: NOW,
      releasePackageChecks: allReleaseChecksPass(),
      hetznerAcceptanceChecks: allHetznerChecksPass(),
    });
    const gate = evaluateLivePilotGate({
      scope: sampleScope(sha),
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      releaseGitSha: sha,
      items: createDefaultLivePilotGateItems(NOW),
      evaluatedAt: NOW,
    });
    const result = evaluateReleaseCandidateQualification({ releaseEvidence: pkg, livePilotGate: gate });
    assert.equal(result.marker, HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING);
    assert.equal(result.engineeringQualified, true);
    assert.equal(result.externalGatesComplete, false);
    assert.equal(pilotAuthorizationOutcome(result), 'NOT_READY');
  });

  it('5. ready for human pilot authorization when all gates satisfied with evidence', () => {
    const sha = gitSha();
    const pkg = buildHeliosReleaseEvidencePackage({
      gitSha: sha,
      artifactDigest: `sha256:artifact:${sha.slice(0, 12)}`,
      releaseManifestRef: 'manifest:helios-rc',
      buildWorkflowRef: 'github-actions:ci',
      buildRunRef: 'ci:local',
      releaseDate: NOW,
      releasePackageChecks: allReleaseChecksPass(),
      hetznerAcceptanceChecks: allHetznerChecksPass(),
    });

    let items = createDefaultLivePilotGateItems(NOW);
    items = Object.freeze(
      items.map((item) => {
        const evidence = item.requiresExternalEvidence
          ? Object.freeze([humanEvidence(`external:${item.itemKey}`)])
          : Object.freeze([]);
        return applyGateItemUpdate(item, {
          nextState: 'SATISFIED',
          evidenceRefs: evidence,
          actorIsAuthorizedGovernance: true,
          updatedAt: NOW,
        });
      }),
    );

    const gate = evaluateLivePilotGate({
      scope: sampleScope(sha),
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      releaseGitSha: sha,
      items,
      evaluatedAt: NOW,
    });
    assert.equal(gate.allGatesSatisfied, true);

    const result = evaluateReleaseCandidateQualification({ releaseEvidence: pkg, livePilotGate: gate });
    assert.equal(result.marker, HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION);
    assert.equal(pilotAuthorizationOutcome(result), READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION);
  });

  it('6. AI cannot sign LivePilotAuthorization and H36 refuses live activation', () => {
    assert.throws(() => refuseAiAuthorization('AI'), /AI cannot sign LivePilotAuthorization/);
    assert.throws(() => refuseLiveActivation(), /does not activate live financial connectivity/);
  });

  it('7. human authorization record is scoped and does not activate live connectivity', () => {
    const sha = gitSha();
    const scope = sampleScope(sha);
    const authorization = buildLivePilotAuthorization({
      seed: 'demo-auth',
      pilotScope: scope,
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      releaseGitSha: sha,
      externalGateStatus: HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION,
      approvers: Object.freeze([
        Object.freeze({
          role: 'AUTHORIZED_GOVERNANCE_LEGAL',
          approvalRecordRef: 'human-approval:legal:001',
          approvedAt: NOW,
        }),
      ]),
      approvedAt: NOW,
      effectiveFrom: NOW,
      expiresAt: asUtcInstant('2026-12-31T23:59:59.000Z'),
      evidenceRefs: Object.freeze([humanEvidence('human-approval:legal:001')]),
      abortConditions: Object.freeze(['FINANCIAL_RECONCILIATION_MISMATCH']),
    });
    assert.equal(authorization.aiSigned, false);
    assert.equal(authorization.activatesLiveConnectivity, false);
    assert.equal(authorization.capitalCeilingMinor, 100_000n);
  });

  it('8. activation ceremony defines controlled steps without executing them', () => {
    const sha = gitSha();
    const ceremony = buildPilotActivationCeremonyContract({
      ceremonyId: 'ceremony:demo',
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      scopeId: livePilotScopeIdFor('pilot-demo'),
    });
    assert.equal(ceremony.steps.length, PILOT_ACTIVATION_CEREMONY_STEPS.length);
    for (const step of ceremony.steps) {
      assert.equal(step.mayActivateLiveConnectivity, false);
    }
  });

  it('9. produces H01-H36 closure report from repository truth', () => {
    const sha = gitSha();
    const pkg = buildHeliosReleaseEvidencePackage({
      gitSha: sha,
      artifactDigest: `sha256:artifact:${sha.slice(0, 12)}`,
      releaseManifestRef: 'manifest:helios-rc',
      buildWorkflowRef: 'github-actions:ci',
      buildRunRef: 'ci:local',
      releaseDate: NOW,
      releasePackageChecks: allReleaseChecksPass(),
      hetznerAcceptanceChecks: allHetznerChecksPass(),
    });
    const gate = evaluateLivePilotGate({
      scope: sampleScope(sha),
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      releaseGitSha: sha,
      items: createDefaultLivePilotGateItems(NOW),
      evaluatedAt: NOW,
    });
    const qualification = evaluateReleaseCandidateQualification({ releaseEvidence: pkg, livePilotGate: gate });
    const report = buildHeliosClosureReport({
      root: ROOT,
      generatedAt: NOW,
      releaseEvidence: pkg,
      qualification,
      livePilotGate: gate,
    });
    assert.equal(report.h01ThroughH36.length, 36);
    assert.equal(report.releaseSha, sha);
    assert.ok(report.recommendedNextAuthorizedAction.includes('external live-pilot gate'));
  });

  it('10. service persists release evidence and gate evaluation without live activation', () => {
    const sha = gitSha();
    const store = new InMemoryReleaseEvidenceStore();
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const service = new HeliosReleaseEvidenceService({
      store,
      vault,
      repoRoot: ROOT,
    });
    const pkg = service.buildReleaseEvidence({
      gitSha: sha,
      artifactDigest: `sha256:artifact:${sha.slice(0, 12)}`,
      releaseManifestRef: 'manifest:helios-rc',
      buildWorkflowRef: 'github-actions:ci',
      buildRunRef: 'ci:local',
      releaseDate: NOW,
      releasePackageChecks: allReleaseChecksPass(),
      hetznerAcceptanceChecks: allHetznerChecksPass(),
    });
    const gate = service.initializeLivePilotGate({
      scope: sampleScope(sha),
      releaseGitSha: sha,
      releaseId: heliosReleaseIdFor(sha.slice(0, 12)),
      evaluatedAt: NOW,
    });
    const qualification = service.evaluateReleaseCandidate({ releaseEvidence: pkg, livePilotGate: gate });
    const report = service.buildClosureReport({
      generatedAt: NOW,
      releaseEvidence: pkg,
      qualification,
      livePilotGate: gate,
    });
    const snap = store.snapshot();
    assert.equal(snap.packages.length, 1);
    assert.equal(snap.gates.length, 1);
    assert.equal(snap.packages[0]?.engineering.engineeringQualified, true);
    assert.equal(report.releaseCandidateStatus, HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING);
    assert.equal(report.pilotEligibility, 'NOT_READY');
    for (const record of vault.list()) {
      const payload = record.payload as { activatesLiveConnectivity?: boolean; grantsExecutionAuthority?: boolean };
      assert.notEqual(payload.activatesLiveConnectivity, true);
      assert.notEqual(payload.grantsExecutionAuthority, true);
    }
  });

  it('11. work-package registry reflects repository evidence', () => {
    const registry = buildHeliosWorkPackageRegistry(ROOT);
    assert.equal(registry.length, 36);
    const h36 = registry.find((row) => row.workPackage === 'H36');
    assert.ok(h36);
    assert.equal(h36!.status, 'QUALIFIED');
  });

  it('12. chunk marker identity', () => {
    assert.equal(HELIOS_H36_RELEASE_EVIDENCE_LIVE_PILOT_GATE, 'HELIOS_H36_RELEASE_EVIDENCE_LIVE_PILOT_GATE');
  });
});
