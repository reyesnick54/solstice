import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { createEvidenceRecord } from './providers/evidence.ts';
import { TEST_FIXTURE_NOT_EXTERNAL_AUDIT } from './audit/remediation/types.ts';
import type { ExternalSecurityFinding, ProductionSecurityPolicy } from './audit/remediation/types.ts';
import { runOpsCommand } from './ops/cli.ts';
import {
  AI_CANNOT_SATISFY_HUMAN_ROLES,
  APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK,
  HANDOFF_REHEARSAL_CHAIN_ID,
  HANDOFF_REHEARSAL_NETWORK_ID,
  HANDOFF_NOW_UTC,
  TREASURY_CANNOT_MINT,
  assembleHandoffPackage,
  assertNoSecrets,
  carryForwardSecurityFindings,
  classifyEvidence,
  containsSecretKey,
  createAccessInventory,
  createConfigurationBaseline,
  createEvidenceSeal,
  createHandoffReport,
  createIncidentRecord,
  createOperatorDashboard,
  createReadinessReport,
  createSloPolicy,
  createSystemInventory,
  defaultCapabilityInventory,
  deriveObservedProduction,
  detectConfigurationDrift,
  economicMonitors,
  evaluateProviderRenewal,
  fixtureOperatorAcceptances,
  publicSurfaceDescriptors,
  recordChange,
  recordOperatorAcceptance,
  rejectAiOperatorAcceptance,
  rejectFixtureAsRealAcceptance,
  rejectTamperedEvidenceSeal,
  rejectUnapprovedChange,
  rejectUniversalAuthority,
  rejectWrongConfigurationBaseline,
  runProductionHandoffCommand,
  runProductionLifecycleRehearsal,
  suspendRegulatedCapabilityAfterEvidenceExpiry,
  assertTreasuryCannotMint,
} from './production-handoff/index.ts';

const ROOT = join(import.meta.dirname, '../../..');

const policy: ProductionSecurityPolicy = {
  criticalOpenFindingsBlockMainnet: true,
  highOpenFindingsPolicy: 'BLOCK_PRODUCTION',
  informationalFindingsBlockMainnet: false,
  humanApproved: false,
  approvedBy: null,
};

function criticalFinding(): ExternalSecurityFinding {
  return {
    findingId: 'FIND-CRIT-1',
    externalReviewId: 'rev_external_1',
    externalSeverity: 'CRITICAL',
    internalEngineeringSeverity: 'CRITICAL',
    title: 'unresolved critical',
    affectedComponent: 'consensus',
    affectedSurface: 'consensus',
    affectedCommit: 'abc',
    affectedVersion: null,
    descriptionReference: 'ref',
    evidenceReference: 'ev',
    status: 'RECEIVED',
    remediationOwner: null,
    disclosureClass: 'SECURITY_RESTRICTED',
    providerSurfaceReference: null,
    supersededBy: null,
    fixtureLabel: TEST_FIXTURE_NOT_EXTERNAL_AUDIT,
  };
}

describe('Chunk 90 production handoff', () => {
  it('assembles a rehearsal handoff package without observed production', () => {
    const report = createHandoffReport(ROOT);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(report.observedProduction, false);
    assert.equal(report.package.productionEnvironment, 'simulation');
    assert.equal(report.package.launchExecutionExists, false);
    assert.notEqual(report.package.state, 'PRODUCTION_HANDOFF_PACKAGE_COMPLETE');
    assert.equal(report.seal.provesLegalCompliance, false);
    assert.equal(report.seal.provesSecurityPerfection, false);
    assert.equal(report.seal.provesFinancialSafety, false);
    assert.equal(report.slo.contractualPromises, false);
    assert.equal(AI_CANNOT_SATISFY_HUMAN_ROLES, true);
    assert.equal(TREASURY_CANNOT_MINT, true);
    assert.equal(APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK, true);
  });

  it('runs the isolated 86-90 rehearsal chain', () => {
    const first = runProductionLifecycleRehearsal(ROOT);
    const second = runProductionLifecycleRehearsal(ROOT);
    assert.equal(first.hash, second.hash);
    assert.equal(first.networkId, HANDOFF_REHEARSAL_NETWORK_ID);
    assert.equal(first.chainId, HANDOFF_REHEARSAL_CHAIN_ID);
    assert.equal(first.phases.length, 5);
    assert.ok(first.phases.every((phase) => phase.ok && phase.evidenceClass === 'REHEARSAL'));
    assert.equal(first.observedProduction, false);
    assert.equal(first.usableForProduction, false);
    assert.equal(first.humanState, 'FIXTURE_REHEARSAL_ONLY');
    assert.equal(first.economicAudit.sunreySupplyReconciles, true);
    assert.equal(first.economicAudit.moonreySupplyReconciles, true);
    assert.equal(first.backup.restoreDrillExecuted, true);
  });

  it('refuses to convert rehearsal evidence into observed production', () => {
    assert.throws(
      () =>
        classifyEvidence({
          claimed: 'PRODUCTION_OBSERVED',
          sourceClass: 'REHEARSAL',
          rehearsal: true,
        }),
      /rehearsal cannot become observed production/,
    );
    assert.equal(
      deriveObservedProduction({
        evidenceClass: 'REHEARSAL',
        rehearsal: true,
        fixture: true,
        isolatedTest: true,
        humanAuthorizationPresent: true,
        actualProductionEvidencePresent: true,
      }),
      false,
    );
  });

  it('keeps fixture operator acceptance rehearsal-only', () => {
    const records = fixtureOperatorAcceptances();
    assert.ok(records.length > 0);
    for (const record of records) {
      assert.equal(record.fixture, true);
      assert.equal(record.realHumanAcceptance, false);
      assert.equal(record.evidenceClass, 'REHEARSAL');
      rejectFixtureAsRealAcceptance(record);
    }
    const forged = { ...records[0]!, realHumanAcceptance: true };
    assert.throws(() => rejectFixtureAsRealAcceptance(forged), /fixture operator acceptance cannot become real human acceptance/);
  });

  it('rejects AI operator acceptance', () => {
    assert.throws(() => rejectAiOperatorAcceptance('AI'), /AI cannot satisfy/);
    assert.throws(
      () =>
        recordOperatorAcceptance({
          operatorId: 'bot',
          role: 'INCIDENT_COMMAND',
          actorKind: 'AI',
          systemsAccepted: ['RPC'],
          runbooksReviewed: [],
          accessGranted: true,
          accessVerified: true,
          onCallResponsibility: true,
        }),
      /AI cannot satisfy/,
    );
  });

  it('reflects expired provider evidence without automatic renewal', () => {
    const expired = createEvidenceRecord({
      recordId: 'ev_expired',
      providerId: 'prov_1',
      evidenceClass: 'SERVICE_CONTRACT',
      documentOrReferenceId: 'doc',
      issuerOrSource: 'fixture',
      issuedAtUtc: '2025-01-01T00:00:00.000Z',
      expiresAtUtc: '2025-12-31T00:00:00.000Z',
      scope: 'test',
    });
    const renewal = evaluateProviderRenewal(expired, HANDOFF_NOW_UTC, 'CONTRACT');
    assert.equal(renewal.state, 'EXPIRED');
    assert.equal(renewal.automaticRenewalClaim, false);
  });

  it('carries unresolved critical findings forward', () => {
    const carried = carryForwardSecurityFindings({
      findings: [criticalFinding()],
      acceptedRisks: [],
      policy,
    });
    assert.equal(carried.unresolvedCriticalReflected, true);
    assert.ok(carried.openCritical.includes('FIND-CRIT-1'));
    assert.equal(carried.claimsExternalAuditCompleted, false);
  });

  it('detects a wrong configuration baseline', () => {
    const baseline = createConfigurationBaseline('aa'.repeat(32));
    assert.equal(detectConfigurationDrift(baseline, 'bb'.repeat(32)), 'DRIFT');
    assert.throws(() => rejectWrongConfigurationBaseline(baseline, 'bb'.repeat(32)), /wrong configuration baseline/);
  });

  it('detects an unapproved change', () => {
    const change = recordChange({
      changeId: 'chg_unapproved',
      kind: 'CONFIGURATION',
      reason: 'drift',
      affectedServices: ['RPC'],
      risk: 'MEDIUM',
    });
    assert.equal(change.state, 'UNAPPROVED');
    assert.throws(() => rejectUnapprovedChange(change), /unapproved change/);
    const protocol = recordChange({
      changeId: 'chg_proto',
      kind: 'PROTOCOL',
      reason: 'upgrade',
      affectedServices: ['consensus'],
      risk: 'PROTOCOL',
      releaseRef: 'SUNREY_MAINNET_RC_1',
      policyOrGovernanceRef: 'gov_pkg_1',
      approval: 'protocol-authority',
    });
    rejectUnapprovedChange(protocol);
    assert.equal(protocol.applicationRollbackIsChainHistoryRollback, false);
  });

  it('excludes secrets from inventory and access', () => {
    const inventory = createSystemInventory();
    const access = createAccessInventory();
    assert.equal(inventory.secretsPresent, false);
    assert.equal(access.secretsPresent, false);
    assertNoSecrets(inventory);
    assertNoSecrets(access);
    assert.equal(containsSecretKey({ privateKey: 'deadbeef' }), true);
    assert.throws(() => assertNoSecrets({ privateKey: 'deadbeef' }), /secret key/);
    assert.throws(() => rejectUniversalAuthority(false), /universal authority/);
  });

  it('detects evidence-seal tamper', () => {
    const report = createHandoffReport(ROOT);
    rejectTamperedEvidenceSeal(report.seal);
    const tampered = {
      ...report.seal,
      included: { ...report.seal.included, releaseHash: '00'.repeat(32) },
    };
    assert.throws(() => rejectTamperedEvidenceSeal(tampered), /evidence-seal tamper/);
    const rebuilt = createEvidenceSeal(report.seal.included);
    assert.equal(rebuilt.sealHash, report.seal.sealHash);
  });

  it('suspends a regulated capability after required evidence expires', () => {
    const eligible = defaultCapabilityInventory().map((row) =>
      row.capability === 'SUNREY_EXCHANGE'
        ? { ...row, state: 'ELIGIBLE' as const, eligibilityEvidenceCurrent: true }
        : row,
    );
    const suspended = suspendRegulatedCapabilityAfterEvidenceExpiry(eligible, 'SUNREY_EXCHANGE', false);
    const exchange = suspended.find((row) => row.capability === 'SUNREY_EXCHANGE');
    assert.equal(exchange?.state, 'SUSPENDED_BY_POLICY');
    assert.equal(exchange?.eligibilityEvidenceCurrent, false);
  });

  it('keeps public surfaces unpublished while inactive', () => {
    const surfaces = publicSurfaceDescriptors(false);
    assert.ok(surfaces.every((row) => row.published === false && row.publicTicker === 'NOT_ASSIGNED_UNLESS_GOVERNED'));
    assert.ok(economicMonitors().every((row) => row.investmentPrediction === false));
    assert.ok(createSloPolicy().economicIntegrity.every((row) => row.integrityFailureIsNotLatency));
    assert.throws(() => assertTreasuryCannotMint('TREASURY', 'MINT_NATIVE'), /mint treasury/);
    const incident = createIncidentRecord({
      incidentId: 'inc_1',
      domain: 'ECONOMIC',
      summary: 'integrity mismatch',
    });
    assert.equal(incident.hiddenEmergencyPower, false);
    assert.equal(incident.emergencyUsesChunk79BoundedAuthority, true);
  });

  it('exposes sunrey-ops production commands', () => {
    const commands = [
      'inventory',
      'baseline',
      'access',
      'operators',
      'slo',
      'incidents',
      'backups',
      'restore-drill',
      'providers',
      'changes',
      'evidence-seal',
      'handoff',
      'readiness',
    ];
    for (const command of commands) {
      const result = runProductionHandoffCommand([command], ROOT);
      assert.equal(result.ok, true, command);
      assertNoSecrets(result.payload);
    }
    const viaOps = runOpsCommand(['production', 'handoff']);
    assert.equal(viaOps.ok, true);
    const dashboard = createOperatorDashboard(ROOT);
    assert.equal(dashboard.secretsPresent, false);
    const pkg = assembleHandoffPackage(ROOT);
    assert.equal(pkg.observedProduction, false);
    const readiness = createReadinessReport(ROOT);
    assert.ok(readiness.externalGaps.length > 0);
    assert.ok(readiness.humanGaps.length > 0);
  });
});
