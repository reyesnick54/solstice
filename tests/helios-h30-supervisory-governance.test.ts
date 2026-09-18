import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant, type UtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  RegulatoryTransparencyService,
  InMemoryRegulatoryTransparencyStore,
  evaluateRegulatoryTransparencyQualification,
  evaluateExportAuthorization,
  verifyPackageIntegrity,
  reconstructActionDecision,
  explainAllowOrRefusal,
  policyVersionRefFor,
  HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED,
  type EvidenceSourcePort,
  type ArtifactClass,
  type RegulatoryTransparencyQualificationChecks,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-18T09:00:00.000Z');
const LATER = asUtcInstant('2026-09-25T09:00:00.000Z');

type EvidenceRecord = {
  readonly ref: string;
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly artifactClass: ArtifactClass;
  readonly customerId: string;
  readonly jurisdiction: string;
  readonly at: UtcInstant;
};

function createEvidenceSource(records: readonly EvidenceRecord[]): EvidenceSourcePort {
  return Object.freeze({
    queryByRefs(refs) {
      return Object.freeze(
        records
          .filter((r) => refs.includes(r.ref))
          .map((r) => Object.freeze({ ref: r.ref, kind: r.kind, payload: r.payload })),
      );
    },
    queryByScope(input) {
      return Object.freeze(
        records.filter((r) => {
          if (input.customerIds.length > 0 && !input.customerIds.includes(asCustomerId(r.customerId))) {
            return false;
          }
          if (
            input.jurisdictions.length > 0 &&
            !input.jurisdictions.some((j) => j === r.jurisdiction)
          ) {
            return false;
          }
          if (r.at < input.dateRangeStart || r.at > input.dateRangeEnd) {
            return false;
          }
          if (!input.artifactClasses.includes(r.artifactClass)) {
            return false;
          }
          return true;
        }).map((r) =>
          Object.freeze({
            ref: r.ref,
            kind: r.kind,
            payload: r.payload,
            artifactClass: r.artifactClass,
          }),
        ),
      );
    },
  });
}

const sampleRecords: readonly EvidenceRecord[] = Object.freeze([
  Object.freeze({
    ref: 'ev_cust_a_order_1',
    kind: 'ORDER_HISTORY',
    artifactClass: 'CUSTOMER_ACCOUNT' as const,
    customerId: 'cust_a',
    jurisdiction: 'US',
    at: NOW,
    payload: Object.freeze({
      customerId: 'cust_a',
      accountId: 'acct_a',
      orderId: 'ord_001',
      rawSecret: 'must-not-export',
    }),
  }),
  Object.freeze({
    ref: 'ev_cust_b_order_1',
    kind: 'ORDER_HISTORY',
    artifactClass: 'CUSTOMER_ACCOUNT' as const,
    customerId: 'cust_b',
    jurisdiction: 'US',
    at: NOW,
    payload: Object.freeze({
      customerId: 'cust_b',
      accountId: 'acct_b',
      orderId: 'ord_002',
    }),
  }),
  Object.freeze({
    ref: 'ev_gb_decision_1',
    kind: 'COMPLIANCE_DECISION',
    artifactClass: 'RISK_COMPLIANCE_DECISION' as const,
    customerId: 'cust_gb',
    jurisdiction: 'GB',
    at: NOW,
    payload: Object.freeze({
      decisionRef: 'dec_gb_1',
      outcome: 'ALLOW',
    }),
  }),
]);

function baseScope(customerIds: readonly string[] = ['cust_a']) {
  return Object.freeze({
    jurisdictions: Object.freeze([asJurisdiction('US')]),
    customerIds: Object.freeze(customerIds.map((id) => asCustomerId(id))),
    accountIds: Object.freeze([]),
    dateRangeStart: asUtcInstant('2026-09-01T00:00:00.000Z'),
    dateRangeEnd: asUtcInstant('2026-09-30T23:59:59.000Z'),
    artifactClasses: Object.freeze(['CUSTOMER_ACCOUNT'] as const),
  });
}

function human(role: 'COMPLIANCE' | 'LEGAL' | 'AUDIT' | 'SUPERVISORY_ADMIN', id = 'op1') {
  return Object.freeze({ operatorId: id, role, actorKind: 'HUMAN' as const });
}

function aiCompliance(id = 'ai1') {
  return Object.freeze({ operatorId: id, role: 'COMPLIANCE' as const, actorKind: 'AI' as const });
}

function passingTests(evidenceRef: string) {
  return Object.freeze([
    Object.freeze({
      testSuiteId: 'suite_h30',
      passed: true,
      unitTestsPassed: true,
      capabilityTestsPassed: true,
      negativeTestsPassed: true,
      regressionTestsPassed: true,
      jurisdictionTestsPassed: true,
      shadowEvaluationPassed: true,
      evidenceRef,
      executedAt: NOW,
    }),
  ]);
}

function failingTests(evidenceRef: string) {
  return Object.freeze([
    Object.freeze({
      testSuiteId: 'suite_h30_fail',
      passed: false,
      unitTestsPassed: false,
      capabilityTestsPassed: true,
      negativeTestsPassed: true,
      regressionTestsPassed: true,
      jurisdictionTestsPassed: true,
      shadowEvaluationPassed: true,
      evidenceRef,
      executedAt: NOW,
    }),
  ]);
}

type MutableQualificationChecks = {
  -readonly [K in keyof RegulatoryTransparencyQualificationChecks]: boolean;
};

describe('HELIOS H30 — Supervisory access and regulated change governance', { concurrency: 1 }, () => {
  const checks: MutableQualificationChecks = {
    leastPrivilegeExportHolds: false,
    unauthorizedExportDenied: false,
    scopedCustomerExport: false,
    redactionApplied: false,
    packageHashIntegrity: false,
    auditTrailRecorded: false,
    officialSourceRequired: false,
    aiCannotActivatePolicy: false,
    reviewRequiredStateWorks: false,
    testsFailBlocksActivation: false,
    authorizedActivationWorks: false,
    scheduledEffectiveDateWorks: false,
    rollbackWorks: false,
    historicalPolicyPreserved: false,
    pendingWorkflowSurvivesRestart: false,
    duplicateActivationPrevented: false,
    jurisdictionIsolation: false,
    supervisoryQueryReconstructs: false,
  };

  it('1. least-privilege export — COMPLIANCE internal review only', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const service = new RegulatoryTransparencyService({
      clock,
      evidence: vault,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_lp',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:internal-review',
      purposeRef: 'purpose:compliance-review',
      exportMode: 'INTERNAL_REVIEW',
      scope: baseScope(['cust_a']),
    });
    assert.ok(created.ok);
    checks.leastPrivilegeExportHolds = created.value!.exportMode === 'INTERNAL_REVIEW';
  });

  it('2. unauthorized export denied', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const denied = service.createExportRequest({
      requestKey: 'h30_unauth',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:audit',
      purposeRef: 'purpose:audit',
      exportMode: 'AUDIT_EXPORT',
      scope: baseScope(),
    });
    assert.ok(!denied.ok);
    checks.unauthorizedExportDenied = denied.error!.code === 'UNAUTHORIZED';
  });

  it('3. scoped customer export — only requested customer', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_scope',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:scoped',
      purposeRef: 'purpose:scoped',
      exportMode: 'INTERNAL_REVIEW',
      scope: baseScope(['cust_a']),
    });
    assert.ok(created.ok);
    const pkg = service.generateExportPackage({ exportRequestId: created.value!.exportRequestId });
    assert.ok(pkg.ok);
    const customerIds = pkg.value!.artifacts.flatMap((a) =>
      typeof a.payload.customerId === 'string' ? [a.payload.customerId] : [],
    );
    checks.scopedCustomerExport =
      pkg.value!.artifacts.length === 1 && !customerIds.some((id) => id.includes('cust_b'));
  });

  it('4. redaction — pseudonymization and secret removal', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_redact',
      actor: human('SUPERVISORY_ADMIN'),
      legalBasisRef: 'basis:regulator',
      purposeRef: 'purpose:regulator',
      exportMode: 'REGULATOR_EXPORT',
      scope: baseScope(['cust_a']),
    });
    assert.ok(created.ok);
    service.approveExportRequest({
      exportRequestId: created.value!.exportRequestId,
      approver: human('LEGAL', 'legal1'),
    });
    const pkg = service.generateExportPackage({
      exportRequestId: created.value!.exportRequestId,
      identified: false,
    });
    assert.ok(pkg.ok);
    const artifact = pkg.value!.artifacts[0]!;
    checks.redactionApplied =
      artifact.redaction?.exportTransformation === 'PSEUDONYMIZED' &&
      !('rawSecret' in artifact.payload) &&
      String(artifact.payload.customerId).startsWith('pseudo_');
  });

  it('5. package hash integrity', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_hash',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:hash',
      purposeRef: 'purpose:hash',
      exportMode: 'INTERNAL_REVIEW',
      scope: baseScope(['cust_a']),
    });
    assert.ok(created.ok);
    const pkg = service.generateExportPackage({ exportRequestId: created.value!.exportRequestId });
    assert.ok(pkg.ok);
    checks.packageHashIntegrity = verifyPackageIntegrity(pkg.value!);
  });

  it('6. audit trail recorded', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const service = new RegulatoryTransparencyService({
      clock,
      evidence: vault,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_audit',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:audit-trail',
      purposeRef: 'purpose:audit-trail',
      exportMode: 'INTERNAL_REVIEW',
      scope: baseScope(['cust_a']),
    });
    assert.ok(created.ok);
    service.generateExportPackage({ exportRequestId: created.value!.exportRequestId });
    const stored = service.store.getExportRequest(created.value!.exportRequestId);
    checks.auditTrailRecorded =
      (stored?.auditTrailRefs.length ?? 0) > 0 && vault.count() > 0;
  });

  it('7. official-source-required change', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const bad = service.createChangeRequest({
      requestKey: 'h30_bad_source',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_social',
        kind: 'REGULATOR_PUBLICATION',
        citation: '',
        evidenceRef: '',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(!bad.ok);

    const good = service.createChangeRequest({
      requestKey: 'h30_good_source',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'SEC Release 2026-01',
        evidenceRef: 'ev_reg_pub',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(good.ok);
    checks.officialSourceRequired = !bad.ok && good.ok;
  });

  it('8. AI cannot activate policy', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_ai_block',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg2',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'FCA PS26/1',
        evidenceRef: 'ev_reg2',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(change.ok);

    service.submitApplicability({
      changeRequestId: change.value!.changeRequestId,
      assessment: Object.freeze({
        jurisdictions: Object.freeze([asJurisdiction('US')]),
        legalEntities: Object.freeze(['le_us']),
        products: Object.freeze(['CASH']),
        customerClasses: Object.freeze(['RETAIL']),
        providers: Object.freeze([]),
        strategyActionTypes: Object.freeze(['TRANSFER']),
        affectedControls: Object.freeze(['KYC']),
        effectiveDate: LATER,
        uncertainty: 'RESOLVED',
        reviewer: human('LEGAL'),
      }),
    });

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '2.0.0',
      content: Object.freeze({ rule: 'updated' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: passingTests('ev_tests_pass'),
    });

    const aiActivate = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: aiCompliance(),
      mode: 'IMMEDIATE',
    });
    assert.ok(!aiActivate.ok);
    checks.aiCannotActivatePolicy = aiActivate.error!.code === 'AI_ACTIVATION_FORBIDDEN';
  });

  it('9. review-required state for unknown applicability', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_review',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg3',
        kind: 'LEGISLATION',
        citation: 'EU Directive 2026/42',
        evidenceRef: 'ev_leg',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('EU', '1.0.0'),
    });
    assert.ok(change.ok);

    const assessed = service.submitApplicability({
      changeRequestId: change.value!.changeRequestId,
      assessment: Object.freeze({
        jurisdictions: Object.freeze([]),
        legalEntities: Object.freeze([]),
        products: Object.freeze([]),
        customerClasses: Object.freeze([]),
        providers: Object.freeze([]),
        strategyActionTypes: Object.freeze([]),
        affectedControls: Object.freeze([]),
        effectiveDate: null,
        uncertainty: 'UNKNOWN',
        reviewer: null,
      }),
    });
    assert.ok(assessed.ok);
    checks.reviewRequiredStateWorks = assessed.value!.state === 'REVIEW_REQUIRED';
  });

  it('10. tests fail -> activation blocked', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_test_fail',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg4',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'OCC Bulletin 2026-3',
        evidenceRef: 'ev_occ',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '2.1.0',
      content: Object.freeze({ rule: 'fail path' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: failingTests('ev_tests_fail'),
    });

    const activate = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('SUPERVISORY_ADMIN'),
      mode: 'IMMEDIATE',
    });
    assert.ok(!activate.ok);
    checks.testsFailBlocksActivation = activate.error!.code === 'TESTS_NOT_PASSED';
  });

  it('11. authorized activation', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const service = new RegulatoryTransparencyService({
      clock,
      evidence: vault,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_activate',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg5',
        kind: 'COUNSEL_DECISION',
        citation: 'Counsel memo 2026-09-01',
        evidenceRef: 'ev_counsel',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '3.0.0',
      content: Object.freeze({ rule: 'activated' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: passingTests('ev_tests_ok'),
    });

    service.advanceChangeRequest({
      changeRequestId: change.value!.changeRequestId,
      toState: 'APPROVAL_REQUIRED',
    });

    const activated = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('SUPERVISORY_ADMIN'),
      mode: 'IMMEDIATE',
    });
    assert.ok(activated.ok);
    checks.authorizedActivationWorks =
      activated.value!.state === 'ACTIVATED' &&
      service.store.isActivated(policyVersionRefFor('US', '3.0.0'));
  });

  it('12. scheduled effective date', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_sched',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg6',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'PRA SS26/2',
        evidenceRef: 'ev_pra',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('GB', '1.0.0'),
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'GB',
      versionNumber: '2.0.0',
      content: Object.freeze({ rule: 'scheduled' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: passingTests('ev_sched_tests'),
    });

    service.advanceChangeRequest({
      changeRequestId: change.value!.changeRequestId,
      toState: 'APPROVAL_REQUIRED',
    });

    const scheduled = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('LEGAL'),
      mode: 'SCHEDULED_EFFECTIVE_DATE',
      effectiveAt: LATER,
    });
    assert.ok(scheduled.ok);
    assert.equal(scheduled.value!.state, 'SCHEDULED');

    clock.set(LATER);
    const processed = service.processScheduledActivations({ approver: human('LEGAL') });
    checks.scheduledEffectiveDateWorks =
      processed.length === 1 && processed[0]!.state === 'ACTIVATED';
  });

  it('13. rollback — prospective disable without rewriting history', () => {
    const clock = new FrozenClock(NOW);
    const vault = new EvidenceVault(clock);
    const service = new RegulatoryTransparencyService({
      clock,
      evidence: vault,
      evidenceSource: createEvidenceSource([]),
    });

    const v1 = policyVersionRefFor('US', '1.0.0');
    service.store.putPolicyVersion(
      Object.freeze({
        versionRef: v1,
        packId: 'US',
        versionNumber: '1.0.0',
        contentHash: 'hash_v1',
        previousVersionRef: null,
        immutable: true as const,
        activatedAt: NOW,
        retiredAt: null,
      }),
    );

    const change = service.createChangeRequest({
      requestKey: 'h30_rollback',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg7',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'Fed SR 26-1',
        evidenceRef: 'ev_fed',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: v1,
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '2.0.0',
      content: Object.freeze({ rule: 'defective' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: passingTests('ev_rb_tests'),
    });

    service.advanceChangeRequest({
      changeRequestId: change.value!.changeRequestId,
      toState: 'APPROVAL_REQUIRED',
    });

    service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('SUPERVISORY_ADMIN'),
      mode: 'IMMEDIATE',
    });

    const historical = service.store.getPolicyVersion(v1);
    assert.ok(historical);

    const rolled = service.rollbackPolicy({
      changeRequestId: change.value!.changeRequestId,
      rollbackToVersionRef: v1,
      approver: human('SUPERVISORY_ADMIN'),
    });
    assert.ok(rolled.ok);
    checks.rollbackWorks =
      rolled.value!.state === 'ROLLBACK_REQUIRED' &&
      service.store.isActivated(v1) &&
      historical!.contentHash === 'hash_v1';
  });

  it('14. historical policy preserved — immutable version hash', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const v1Ref = policyVersionRefFor('US', '1.0.0');
    service.store.putPolicyVersion(
      Object.freeze({
        versionRef: v1Ref,
        packId: 'US',
        versionNumber: '1.0.0',
        contentHash: 'immutable_hash_v1',
        previousVersionRef: null,
        immutable: true as const,
        activatedAt: NOW,
        retiredAt: null,
      }),
    );

    assert.throws(() => {
      service.store.putPolicyVersion(
        Object.freeze({
          versionRef: v1Ref,
          packId: 'US',
          versionNumber: '1.0.0',
          contentHash: 'tampered_hash',
          previousVersionRef: null,
          immutable: true as const,
          activatedAt: NOW,
          retiredAt: null,
        }),
      );
    });

    checks.historicalPolicyPreserved = true;
  });

  it('15. pending workflow survives restart', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_restart',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg8',
        kind: 'LEGAL_MEMO',
        citation: 'Internal legal memo 2026-09-10',
        evidenceRef: 'ev_memo',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '4.0.0',
      content: Object.freeze({ rule: 'pending' }),
    });

    const snapshot = service.store.snapshot();
    const restarted = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
      store: new InMemoryRegulatoryTransparencyStore(),
    });
    restarted.store.restore(snapshot);

    const restored = restarted.store.getChangeRequest(change.value!.changeRequestId);
    checks.pendingWorkflowSurvivesRestart =
      restored?.state === 'TESTS_REQUIRED' &&
      restored.proposedPolicyVersion?.versionNumber === '4.0.0';
  });

  it('16. duplicate activation prevented', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const change = service.createChangeRequest({
      requestKey: 'h30_dup',
      actor: human('COMPLIANCE'),
      officialSource: Object.freeze({
        sourceId: 'src_reg9',
        kind: 'REGULATOR_PUBLICATION',
        citation: 'MAS Notice 626',
        evidenceRef: 'ev_mas',
        capturedAt: NOW,
      }),
      currentPolicyVersionRef: policyVersionRefFor('US', '1.0.0'),
    });
    assert.ok(change.ok);

    service.proposePolicyChange({
      changeRequestId: change.value!.changeRequestId,
      packId: 'US',
      versionNumber: '5.0.0',
      content: Object.freeze({ rule: 'once' }),
    });

    service.submitTestResults({
      changeRequestId: change.value!.changeRequestId,
      results: passingTests('ev_dup_tests'),
    });

    service.advanceChangeRequest({
      changeRequestId: change.value!.changeRequestId,
      toState: 'APPROVAL_REQUIRED',
    });

    const first = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('SUPERVISORY_ADMIN'),
      mode: 'IMMEDIATE',
    });
    assert.ok(first.ok);

    const second = service.requestPolicyActivation({
      changeRequestId: change.value!.changeRequestId,
      approver: human('SUPERVISORY_ADMIN'),
      mode: 'IMMEDIATE',
    });
    assert.ok(!second.ok);
    checks.duplicateActivationPrevented = second.error!.code === 'ALREADY_ACTIVATED';
  });

  it('17. jurisdiction isolation in export', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource(sampleRecords),
    });

    const created = service.createExportRequest({
      requestKey: 'h30_jur',
      actor: human('COMPLIANCE'),
      legalBasisRef: 'basis:gb',
      purposeRef: 'purpose:gb',
      exportMode: 'INTERNAL_REVIEW',
      scope: Object.freeze({
        jurisdictions: Object.freeze([asJurisdiction('GB')]),
        customerIds: Object.freeze([]),
        accountIds: Object.freeze([]),
        dateRangeStart: asUtcInstant('2026-09-01T00:00:00.000Z'),
        dateRangeEnd: asUtcInstant('2026-09-30T23:59:59.000Z'),
        artifactClasses: Object.freeze(['RISK_COMPLIANCE_DECISION' as ArtifactClass]),
      }),
    });
    assert.ok(created.ok);
    const pkg = service.generateExportPackage({ exportRequestId: created.value!.exportRequestId });
    assert.ok(pkg.ok);
    checks.jurisdictionIsolation =
      pkg.value!.artifacts.length === 1 &&
      pkg.value!.artifacts[0]!.sourceEvidenceRefs[0] === 'ev_gb_decision_1';
  });

  it('18. supervisory query reconstructs allow/refusal', () => {
    const clock = new FrozenClock(NOW);
    const service = new RegulatoryTransparencyService({
      clock,
      evidenceSource: createEvidenceSource([]),
    });

    const policyRef = policyVersionRefFor('US', '3.0.0');
    const reconstruction = reconstructActionDecision(
      service.store,
      Object.freeze({
        actionRef: 'action:transfer:001',
        outcome: 'ALLOW',
        policyVersionRef: policyRef,
        capabilityContext: Object.freeze({ capability: 'TRANSFER', jurisdiction: 'US' }),
        controlEvidenceRefs: Object.freeze(['ev_kernel_allow']),
        financialEvidenceRefs: Object.freeze(['ev_journal_001']),
        reportingHistoryRefs: Object.freeze(['ev_report_none']),
        modelStrategyVersions: Object.freeze(['capsule_v1.0.0']),
        evaluatedAt: NOW,
      }),
      NOW,
    );

    const explanation = explainAllowOrRefusal(reconstruction);
    checks.supervisoryQueryReconstructs =
      reconstruction.outcome === 'ALLOW' &&
      explanation.outcome === 'ALLOW' &&
      (explanation.evidenceUsed as readonly string[]).includes('ev_kernel_allow') &&
      explanation.chainOfThoughtExcluded === true;
  });

  it('HELIOS boundary lint passes', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });

  it('qualification marker HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED when all checks pass', () => {
    const result = evaluateRegulatoryTransparencyQualification(
      checks as RegulatoryTransparencyQualificationChecks,
    );
    assert.equal(result.blockers.length, 0, `blockers: ${result.blockers.join(', ')}`);
    assert.equal(result.marker, HELIOS_REGULATORY_TRANSPARENCY_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('chunk export authorization denies AI actors', () => {
    const auth = evaluateExportAuthorization(aiCompliance(), 'INTERNAL_REVIEW');
    assert.equal(auth.permitted, false);
  });
});
