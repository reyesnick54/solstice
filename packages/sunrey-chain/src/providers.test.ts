import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { identityPortIssuesExecutionAuthority } from '../../kernel/src/regulated/identity-port.ts';
import { createSimulationProviders } from '../../kernel/src/compliance/simulation.ts';
import { InMemoryCaseManagementPort } from '../../kernel/src/regulated/index.ts';
import { SandboxIdentityKycProvider, SandboxTravelRuleProvider } from '../../custody/src/regulated/sandbox.ts';
import { createInstitutionalHarness } from '../../custody/src/institutional/harness.ts';
import { createDevelopmentHsmSimulator } from '../../security/src/hsm-simulator.ts';
import { createDefaultCryptoSuiteRegistry, SUITE_SUNREY_MLDSA_65_V1 } from '../../security/src/crypto-suite.ts';
import { defaultCapabilityActivation } from './mainnet/capabilities.ts';
import { buildGenesisCandidate } from './mainnet/genesis-candidate.ts';
import { runOpsCommand } from './ops/cli.ts';
import {
  ACCEPTANCE_STATES,
  PROVIDER_DOMAINS,
  attemptHumanAcceptance,
  attachProviderFeedToCandidate,
  buildAcceptanceReport,
  buildProductionProviderMatrix,
  buildProviderAcceptanceReadinessFeed,
  configuredIsNotApproved,
  continuityProfile,
  contractRemainsMissing,
  createEvidenceRecord,
  createProviderAcceptanceFixture,
  dataClassesFor,
  deriveAcceptanceState,
  evaluateEligibility,
  exportProviderAcceptanceAudit,
  licenseRemainsMissing,
  markEvidenceHumanReviewed,
  measureConcentration,
  missingEvidence,
  planProviderReplacement,
  profileFor,
  providerAcceptanceEvidenceRecords,
  refreshEvidenceState,
  residencyProfile,
  runAllAcceptanceSuites,
  runBankingAcceptanceSuite,
  runHsmContractSuite,
  runOracleAcceptanceSuite,
  runPqcCapabilitySuite,
  runProviderOpsCommand,
  runWebhookAcceptanceSuite,
  summarizeEvidenceForAi,
} from './providers/index.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const NOW = '2026-08-18T00:00:00.000Z';

describe('Chunk 82 production provider acceptance', () => {
  it('covers every required provider domain and acceptance state', () => {
    for (const domain of PROVIDER_DOMAINS) {
      const profile = profileFor(domain);
      assert.equal(profile.domain, domain);
      assert.ok(profile.requiredCapabilities.length > 0);
      assert.ok(profile.requiredEvidenceClasses.length > 0);
    }
    assert.deepEqual(
      [...ACCEPTANCE_STATES],
      [
        'NOT_CONFIGURED',
        'CONFIGURED_UNVERIFIED',
        'ENGINEERING_TESTED',
        'EXTERNAL_EVIDENCE_REQUIRED',
        'EXTERNAL_EVIDENCE_PROVIDED',
        'HUMAN_ACCEPTED',
        'PRODUCTION_ELIGIBLE',
      ],
    );
  });

  it('does not treat a configured provider as approved', () => {
    const suite = runHsmContractSuite();
    const input = {
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: [missingEvidence(suite.providerId, 'SERVICE_CONTRACT', 'HSM')],
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: NOW,
    };
    const eligibility = evaluateEligibility(input);
    assert.equal(eligibility.configuredEqualsApproved, false);
    assert.equal(eligibility.productionEligible, false);
    assert.equal(configuredIsNotApproved(true, eligibility.productionEligible), true);
    assert.equal(deriveAcceptanceState(input), 'EXTERNAL_EVIDENCE_REQUIRED');
    assert.equal(deriveAcceptanceState({ ...input, evidence: [] }), 'ENGINEERING_TESTED');
  });

  it('does not infer HSM PQ support from software PQ support', () => {
    const suite = runPqcCapabilitySuite();
    assert.equal(suite.passed, true);
    const hsm = createDevelopmentHsmSimulator();
    const software = createDefaultCryptoSuiteRegistry().get(SUITE_SUNREY_MLDSA_65_V1);
    assert.equal(software.ok, true);
    assert.equal(hsm.capabilities().postQuantum, false);
    assert.equal(hsm.capabilities().externalHsmPqSupported, false);
    assert.equal(hsm.capabilities().hardwarePqReadiness, 'HARDWARE_PROVIDER_UNCONFIRMED');
  });

  it('keeps missing contracts and licenses missing', () => {
    const contract = missingEvidence('bank-reference', 'SERVICE_CONTRACT', 'BANKING_REFERENCE');
    const license = missingEvidence('bank-reference', 'LICENSE_REGISTRATION', 'BANKING_REFERENCE');
    assert.equal(contractRemainsMissing(contract), true);
    assert.equal(licenseRemainsMissing(license), true);
    assert.equal(contract.slotPresenceIsProof, false);
  });

  it('marks expired evidence stale', () => {
    const record = createEvidenceRecord({
      recordId: 'ev_expired',
      providerId: 'hsm-local',
      evidenceClass: 'SOC_ISO_OR_EQUIVALENT',
      documentOrReferenceId: 'soc-ref-1',
      issuerOrSource: 'external-auditor',
      expiresAtUtc: '2026-01-01T00:00:00.000Z',
      scope: 'HSM',
    });
    const stale = refreshEvidenceState(record, NOW);
    assert.equal(stale.verificationState, 'STALE');
  });

  it('rejects wrong-provider and replayed webhooks', () => {
    const suite = runWebhookAcceptanceSuite();
    assert.equal(suite.passed, true);
    assert.ok(suite.cases.some((row) => row.caseId === 'webhook.wrong' && row.outcome === 'PASS'));
    assert.ok(suite.cases.some((row) => row.caseId === 'webhook.replay' && row.outcome === 'PASS'));
  });

  it('excludes secrets from reports and audit export', () => {
    const fixture = createProviderAcceptanceFixture();
    const inputs = fixture.suites.map((suite) => ({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: [missingEvidence(suite.providerId, 'SERVICE_CONTRACT', suite.domain)],
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: fixture.nowUtc,
    }));
    const report = buildAcceptanceReport(inputs, fixture.nowUtc);
    const matrix = buildProductionProviderMatrix(report.results);
    const exported = exportProviderAcceptanceAudit(report, matrix);
    assert.equal(report.secretValuePresent, false);
    assert.equal(matrix.secretValuePresent, false);
    assert.equal(exported.secretValuePresent, false);
    const text = JSON.stringify({ report, matrix, exported });
    assert.equal(/BEGIN .+PRIVATE KEY|client_secret=|password=/.test(text), false);
    assert.match(JSON.stringify(report), /"secretValuePresent":false/);
  });

  it('does not treat oracle technical success as data rights', () => {
    const suite = runOracleAcceptanceSuite();
    assert.equal(suite.engineeringTested, true);
    assert.ok(suite.cases.some((row) => row.caseId === 'oracle.rights' && row.outcome === 'EXTERNAL_REQUIRED'));
    const eligibility = evaluateEligibility({
      providerId: suite.providerId,
      domain: 'ORACLE_DATA_SOURCE',
      configured: true,
      suite,
      evidence: [missingEvidence(suite.providerId, 'DATA_LICENSE_AGREEMENT', 'ORACLE_DATA_SOURCE')],
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: NOW,
    });
    assert.equal(eligibility.productionEligible, false);
    assert.ok(eligibility.missingRequirements.some((row) => row.includes('DATA_LICENSE_AGREEMENT')));
  });

  it('does not let KYC success issue Execution Authority', () => {
    const kyc = new SandboxIdentityKycProvider();
    const result = kyc.verify({
      subjectRef: 'cust_sandbox_1',
      actorId: 'actor_sandbox_1',
      jurisdiction: 'GB',
      now: asUtcInstant(NOW),
    });
    assert.equal(result.outcome, 'PASS');
    assert.equal(identityPortIssuesExecutionAuthority(), false);
    const screen = createSimulationProviders().sanctions.screen({
      subjectKind: 'PERSON',
      subjectRef: 'cust_sandbox_1',
      jurisdiction: 'GB',
      now: asUtcInstant(NOW),
    });
    assert.equal(screen.outcome, 'CLEAR');
    const travel = new SandboxTravelRuleProvider().exchangeRequiredData({
      withdrawalId: 'wd_sandbox_1',
      destination: 'addr_sandbox',
      originatorRef: 'orig',
      beneficiaryRef: 'bene',
    });
    assert.equal(travel.state, 'DELIVERED');
    const opened = new InMemoryCaseManagementPort().open({
      detectorFactRefs: ['fact_sandbox_1'],
      customerAccountRefs: ['acct_sandbox_1'],
      priority: 'MEDIUM',
      subjectRef: 'cust_sandbox_1',
      jurisdiction: 'GB',
      evidenceRefs: ['ev_sandbox_1'],
      createdAt: asUtcInstant(NOW),
    });
    assert.ok(opened.caseId.length > 0);
    const custody = createInstitutionalHarness();
    assert.ok(custody);
  });

  it('does not let a bank adapter activate fiat capability', () => {
    const suite = runBankingAcceptanceSuite();
    assert.equal(suite.passed, true);
    const fiat = defaultCapabilityActivation('FIAT_BANKING');
    assert.equal(fiat.runtime_enabled, false);
    assert.equal(fiat.genesis_enabled, false);
  });

  it('rejects AI attempts to mark human acceptance', () => {
    const rejected = attemptHumanAcceptance({ reviewerKind: 'AI', reviewerId: 'model-1' });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'AI_CANNOT_HUMAN_ACCEPT');
    }
    const evidence = createEvidenceRecord({
      recordId: 'ev_human',
      providerId: 'hsm-local',
      evidenceClass: 'HUMAN_APPROVAL',
      documentOrReferenceId: 'approval-ref',
      issuerOrSource: 'security-reviewer',
      scope: 'HSM',
    });
    const aiMark = markEvidenceHumanReviewed(
      evidence,
      { kind: 'AI', reviewerId: 'model-1', role: 'SECURITY_REVIEWER' },
      NOW,
    );
    assert.equal(aiMark.ok, false);
    const summary = summarizeEvidenceForAi(evidence);
    assert.equal(summary.mayMarkHumanAccepted, false);
  });

  it('runs the local acceptance harness without destructive tests', () => {
    const suites = runAllAcceptanceSuites();
    assert.ok(suites.length >= 10);
    for (const suite of suites) {
      assert.equal(suite.cases.every((row) => row.destructive === false), true);
      assert.equal(suite.engineeringTested, true);
    }
  });

  it('feeds Chunk 65 and Candidate V2 without activating mainnet', () => {
    const fixture = createProviderAcceptanceFixture();
    const inputs = fixture.suites.map((suite) => ({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: [missingEvidence(suite.providerId, 'SERVICE_CONTRACT', suite.domain)],
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: fixture.nowUtc,
    }));
    const report = buildAcceptanceReport(inputs, fixture.nowUtc);
    const matrix = buildProductionProviderMatrix(report.results);
    const feed = buildProviderAcceptanceReadinessFeed(report, matrix);
    assert.equal(feed.mainnetEnabled, false);
    assert.equal(feed.anyProductionEligible, false);
    assert.equal(feed.commercialEvidence, false);
    assert.equal(feed.legalRegulatoryEvidence, false);
    const records = providerAcceptanceEvidenceRecords(feed);
    assert.ok(records.some((row) => row.requirementId === 'REQ-PROVIDER-001'));
    assert.ok(records.some((row) => row.verificationStatus === 'NOT_PROVIDED'));
    const candidate = buildGenesisCandidate();
    const attached = attachProviderFeedToCandidate(candidate.candidate, feed);
    assert.equal(attached.candidate.mainnetEnabled, false);
    assert.equal(attached.candidateHashUnchangedByProviderEligibility, true);
  });

  it('records continuity and residency without legal conclusions', () => {
    const continuity = continuityProfile({
      providerId: 'local-integration',
      rtoTargetMs: 3_600_000,
      rpoTargetMs: 300_000,
      backupRecoveryCapability: true,
      regionalFailover: false,
      dependencyChain: ['local-integration', 'simulation-hsm'],
      tested: true,
      claimSource: 'packages/sunrey-chain/src/infra',
    });
    assert.equal(continuity.engineeringClaimOnly, true);
    const residency = residencyProfile({
      providerId: 'local-integration',
      deploymentRegions: ['local'],
      configuredResidencyConstraints: ['CI_ONLY'],
    });
    assert.equal(residency.legalConclusion, false);
    assert.deepEqual(dataClassesFor('ORACLE_DATA_SOURCE'), ['ORACLE_PUBLIC_DATA']);
    const replacement = planProviderReplacement({
      fromProviderId: 'oracle-a',
      toProviderId: 'oracle-b',
      domain: 'ORACLE_DATA_SOURCE',
      compatibleCapabilities: true,
    });
    assert.equal(replacement.canonicalProtocolAuthorityUnchanged, true);
    const concentration = measureConcentration({
      providerIds: ['oracle-a', 'oracle-b'],
      regions: ['local', 'local'],
      controllers: ['controller-a'],
    });
    assert.equal(concentration.dualProviderConfigured, true);
    assert.equal(concentration.providerConcentration, 1);
  });

  it('exposes sunrey-ops provider commands without secrets', () => {
    for (const command of ['list', 'profile', 'test', 'evidence', 'verify', 'readiness', 'matrix']) {
      const args = command === 'profile' ? ['provider', 'HSM'] : ['provider', command];
      const result = command === 'profile' ? runProviderOpsCommand(['profile', 'HSM']) : runOpsCommand(args);
      assert.equal(result.ok, true, command);
      const text = JSON.stringify(result.payload);
      assert.equal(/BEGIN .+PRIVATE KEY|client_secret=/.test(text), false);
    }
  });

  it('publishes the required documentation and forbids a second registry package', () => {
    for (const relative of [
      'docs/providers/chunk-82-production-provider-acceptance.md',
      'docs/providers/provider-evidence.md',
      'docs/providers/hsm-acceptance.md',
      'docs/providers/oracle-acceptance.md',
      'docs/providers/regulated-provider-acceptance.md',
      'docs/providers/provider-continuity.md',
      'docs/runbooks/provider-onboarding.md',
      'docs/runbooks/provider-replacement.md',
      'docs/architecture/chunk-82-production-provider-acceptance.md',
      'docs/architecture/chunks/chunk-82-production-provider-acceptance.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/provider-acceptance')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-providers')), false);
    assert.equal(existsSync(join(ROOT, 'packages/external-providers')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-providers')), false);
    assert.equal(existsSync(join(ROOT, 'packages/provider-registry')), false);
  });
});
