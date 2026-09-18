import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  APPROVED_HELIOS_REPORTING_POLICY,
  generationIsNotSubmission,
  HELIOS_H29_REGULATORY_EVIDENCE_REPORTING,
  regulatoryTraceIdFor,
  RegulatoryEvidenceReportingService,
  workOrderIdFor,
  type ConsequentialActionContext,
  type RegulatoryAccessContext,
} from '../packages/platform/src/helios/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-18T09:00:00.000Z');

function complianceAccess(customerId: string | null = null): RegulatoryAccessContext {
  return Object.freeze({
    actorId: 'actor_compliance_1',
    roles: Object.freeze(['COMPLIANCE'] as const),
    customerId: customerId ? asCustomerId(customerId) : null,
  });
}

function unauthorizedAccess(): RegulatoryAccessContext {
  return Object.freeze({
    actorId: 'actor_customer_user',
    roles: Object.freeze([]),
    customerId: asCustomerId('cust_h29_a'),
  });
}

function baseActionContext(customerId = 'cust_h29_a', key = 'h29'): ConsequentialActionContext {
  const workOrderId = workOrderIdFor(customerId, key);
  const traceId = regulatoryTraceIdFor(workOrderId, 'paper_order_complete');
  return Object.freeze({
    traceId,
    workOrderId,
    actionEventRef: `evt_${key}_complete`,
    actionEventKind: 'HELIOS_PAPER_ORDER_COMPLETE',
    customerScope: Object.freeze({
      customerId: asCustomerId(customerId),
      accountIds: Object.freeze([`acct_${customerId}`]),
      customerClass: 'RETAIL',
      jurisdiction: asJurisdiction('US'),
    }),
    authorityContext: Object.freeze({
      mandateRef: `mandate_${customerId}`,
      approvalRef: `approval_${key}`,
      legalEntityRef: 'le_sunrey_us_sim',
      providerId: 'sandbox_helios_investment_v1',
      capabilityPackVersion: 'helios-capability-pack-v1',
      policyVersion: APPROVED_HELIOS_REPORTING_POLICY.policyVersion,
    }),
    intelligenceContext: Object.freeze({
      observationRefs: Object.freeze(['obs_market_001']),
      observationTimestamps: Object.freeze([NOW]),
      provenanceRefs: Object.freeze(['prov_obs_001']),
      modelVersion: 'mdl_s3m_v1',
      researchResultRef: 'research_res_001',
      strategyCapsuleId: 'capsule_h29_ref',
      strategyCapsuleVersion: '1.0.0',
      quantitativeAssumptionRefs: Object.freeze(['qa_edge_bps_50']),
    }),
    controlDecisions: Object.freeze({
      riskDecisionRef: 'risk_dec_allow_001',
      riskOutcome: 'ALLOW',
      kernelDecisionRef: 'kernel_dec_allow_001',
      kernelOutcome: 'ALLOW',
      reasonCodes: Object.freeze(['OK']),
      envelopeId: 'env_h29_001',
      executionAuthorityRef: 'ea_sim_h29',
    }),
    financialRefs: Object.freeze({
      fundingRef: 'fund_res_001',
      orderId: `order_${key}`,
      acknowledgementRef: `ack_${key}`,
      fillRefs: Object.freeze([`fill_${key}_1`]),
      feeRefs: Object.freeze([`fee_${key}_1`]),
      settlementRefs: Object.freeze([`settle_${key}_1`]),
      reconciliationRef: `recon_${key}`,
      withdrawalRef: null,
      realizedStateRef: 'realized_pnl_001',
      unrealizedStateRef: 'unrealized_mtm_001',
    }),
    now: NOW,
    idempotencyKey: `idem_${key}`,
  });
}

type Harness = {
  readonly clock: FrozenClock;
  readonly vault: EvidenceVault;
  readonly service: RegulatoryEvidenceReportingService;
  readonly serviceWithSubmission: RegulatoryEvidenceReportingService;
};

function createHarness(): Harness {
  const clock = new FrozenClock(NOW);
  const vault = new EvidenceVault(clock);
  const service = new RegulatoryEvidenceReportingService({ clock, evidence: vault });
  const serviceWithSubmission = new RegulatoryEvidenceReportingService({
    clock,
    evidence: vault,
    submissionIntegrationEnabled: true,
  });
  return { clock, vault, service, serviceWithSubmission };
}

describe('HELIOS H29 regulatory evidence and reporting lifecycle', () => {
  it('architecture guard: no competing HELIOS packages or authority bypass', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });

  it('exports chunk marker', () => {
    assert.equal(HELIOS_H29_REGULATORY_EVIDENCE_REPORTING, 'HELIOS_H29_REGULATORY_EVIDENCE_REPORTING');
  });

  it('1. evidence package creation', () => {
    const h = createHarness();
    const ctx = baseActionContext();
    const created = h.service.createEvidencePackage(ctx);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.ok(created.value.packageId);
    assert.ok(created.value.packageHash);
    assert.equal(created.value.traceId, ctx.traceId);
    assert.equal(created.value.customerScope.customerId, ctx.customerScope.customerId);
    assert.ok(created.value.vaultEvidenceId);
  });

  it('2. non-reportable event', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_non_reportable', 'non_reportable');
    const created = h.service.createEvidencePackage(ctx, 'NOT_REPORTABLE');
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.reportabilityDetermination, 'NOT_REPORTABLE');
    assert.equal(created.value.reportingStatus, 'NOT_REQUIRED');

    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_non_reportable',
      notionalMinorUnits: '100000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    assert.equal(triggered.value.category, 'ORDER_TRADING_EVENT');
    assert.equal(triggered.value.obligations.length, 1);
    assert.equal(triggered.value.obligations[0]!.submissionState, 'POTENTIALLY_REQUIRED');
  });

  it('3. potentially reportable event', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_potential', 'potential');
    h.service.createEvidencePackage(ctx, 'POTENTIALLY_REPORTABLE');
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_potential',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    assert.equal(triggered.value.obligations.length, 1);
    assert.equal(triggered.value.obligations[0]!.responsibleFiler, 'SUNREY_RESPONSIBLE');
    assert.equal(triggered.value.obligations[0]!.submissionState, 'POTENTIALLY_REQUIRED');
  });

  it('4. unknown obligation stays review-required', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_unknown', 'unknown');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processTrigger({
      sourceEventId: 'compliance_alert_001',
      sourceEventKind: 'COMPLIANCE_ALERT',
      triggerCategory: 'SUSPICIOUS_COMPLIANCE_EVENT',
      customerId: ctx.customerScope.customerId,
      jurisdiction: ctx.customerScope.jurisdiction,
      productActivity: 'HELIOS_COMPLIANCE',
      traceId: ctx.traceId,
      now: NOW,
      idempotencyKey: 'trigger:compliance_alert_001',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obl = triggered.value.obligations[0]!;
    assert.equal(obl.mappingStatus, 'LEGAL_REVIEW_REQUIRED');
    assert.equal(obl.submissionState, 'UNKNOWN');
    assert.equal(obl.dueAt, null);
  });

  it('5. responsible filer mapping', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_filer', 'filer');
    h.service.createEvidencePackage(ctx);
    const large = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_large',
      notionalMinorUnits: '600000000',
    });
    assert.equal(large.ok, true);
    if (!large.ok) throw new Error('large');
    assert.equal(large.value.category, 'THRESHOLD_REPORTABLE_ACTIVITY');
    const thresholdObl = large.value.obligations.find(
      (o) => o.policyObligationRef === 'helios.us.large_notional_threshold.v1',
    );
    assert.ok(thresholdObl);
    assert.equal(thresholdObl!.responsibleFiler, 'JOINT_WORKFLOW');
  });

  it('6. draft generation', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_draft', 'draft');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_draft',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.service.generateDraftReport(obligationId, complianceAccess('cust_draft'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    assert.equal(draft.value.submissionState, 'DRAFT');
    assert.ok(draft.value.sections.length >= 3);
    assert.ok(draft.value.sections.some((s) => s.financialRecordRefs.includes('order_draft')));
  });

  it('7. validation failure', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_validate_fail', 'validate_fail');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processTrigger({
      sourceEventId: 'provider_evt_unmapped',
      sourceEventKind: 'PROVIDER_ACCOUNT',
      triggerCategory: 'PROVIDER_ACCOUNT_EVENT',
      customerId: ctx.customerScope.customerId,
      jurisdiction: null,
      productActivity: 'HELIOS_PROVIDER',
      traceId: ctx.traceId,
      now: NOW,
      idempotencyKey: 'trigger:provider_unmapped',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.service.generateDraftReport(obligationId, complianceAccess('cust_validate_fail'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    const validated = h.service.validateReport(draft.value.reportPackageId, complianceAccess('cust_validate_fail'));
    assert.equal(validated.ok, false);
    if (validated.ok) throw new Error('expected validation failure');
    assert.equal(validated.error.code, 'VALIDATION_FAILED');
    const stored = h.service.store.getReportPackage(draft.value.reportPackageId);
    assert.equal(stored?.submissionState, 'VALIDATION_REQUIRED');
    assert.ok(stored!.validationFailures.includes('CRITICAL_MISMATCH'));
  });

  it('8. ready-for-submission', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_ready', 'ready');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_ready',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.service.generateDraftReport(obligationId, complianceAccess('cust_ready'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    const validated = h.service.validateReport(draft.value.reportPackageId, complianceAccess('cust_ready'));
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error('validate');
    assert.equal(validated.value.submissionState, 'READY_FOR_AUTHORIZED_SUBMISSION');
  });

  it('9. generation does not equal submission', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_not_submitted', 'not_submitted');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_not_submitted',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.service.generateDraftReport(obligationId, complianceAccess('cust_not_submitted'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    assert.equal(generationIsNotSubmission(draft.value.submissionState), true);
    assert.equal(h.service.assertGenerationIsNotSubmission('DRAFT'), true);
    assert.equal(h.service.assertGenerationIsNotSubmission('READY_FOR_AUTHORIZED_SUBMISSION'), true);

    const submitWithoutIntegration = h.service.submitReport(
      draft.value.reportPackageId,
      complianceAccess('cust_not_submitted'),
      { submitterAuthority: 'compliance_officer_1', submissionReference: 'sub_ref_001' },
    );
    assert.equal(submitWithoutIntegration.ok, false);
    if (submitWithoutIntegration.ok) throw new Error('expected block');
    assert.equal(submitWithoutIntegration.error.code, 'SUBMISSION_NOT_AUTHORIZED');
  });

  it('10. submission acknowledgement', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_ack', 'ack');
    h.serviceWithSubmission.createEvidencePackage(ctx);
    const triggered = h.serviceWithSubmission.processOrderEventTrigger({
      ctx,
      orderId: 'order_ack',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.serviceWithSubmission.generateDraftReport(obligationId, complianceAccess('cust_ack'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    const validated = h.serviceWithSubmission.validateReport(draft.value.reportPackageId, complianceAccess('cust_ack'));
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error('validate');
    const submitted = h.serviceWithSubmission.submitReport(
      draft.value.reportPackageId,
      complianceAccess('cust_ack'),
      { submitterAuthority: 'compliance_officer_1', submissionReference: 'sub_ref_ack_001' },
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) throw new Error('submit');
    assert.equal(submitted.value.responseStatus, 'PENDING');
    assert.equal(submitted.value.externalAcknowledgementRef, null);

    const acknowledged = h.serviceWithSubmission.acknowledgeSubmission(
      submitted.value.submissionRecordId,
      {
        externalAcknowledgementRef: 'reg_ack_12345',
        regulatorProviderReference: 'finra_sim_ref_001',
      },
      complianceAccess('cust_ack'),
    );
    assert.equal(acknowledged.ok, true);
    if (!acknowledged.ok) throw new Error('ack');
    assert.equal(acknowledged.value.responseStatus, 'ACKNOWLEDGED');
    assert.ok(acknowledged.value.acknowledgedAt);
    assert.equal(acknowledged.value.externalAcknowledgementRef, 'reg_ack_12345');
  });

  it('11. rejection', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_reject', 'reject');
    h.serviceWithSubmission.createEvidencePackage(ctx);
    const triggered = h.serviceWithSubmission.processOrderEventTrigger({
      ctx,
      orderId: 'order_reject',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.serviceWithSubmission.generateDraftReport(obligationId, complianceAccess('cust_reject'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    h.serviceWithSubmission.validateReport(draft.value.reportPackageId, complianceAccess('cust_reject'));
    const submitted = h.serviceWithSubmission.submitReport(
      draft.value.reportPackageId,
      complianceAccess('cust_reject'),
      { submitterAuthority: 'compliance_officer_1', submissionReference: 'sub_ref_reject_001' },
    );
    assert.equal(submitted.ok, true);
    if (!submitted.ok) throw new Error('submit');

    const rejected = h.serviceWithSubmission.rejectSubmission(
      submitted.value.submissionRecordId,
      'Missing required field X',
      complianceAccess('cust_reject'),
    );
    assert.equal(rejected.ok, true);
    if (!rejected.ok) throw new Error('reject');
    assert.equal(rejected.value.responseStatus, 'REJECTED');
    const obligation = h.serviceWithSubmission.store.getObligation(obligationId);
    assert.equal(obligation?.submissionState, 'CORRECTION_REQUIRED');
  });

  it('12. correction/amendment', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_correct', 'correct');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_correct',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    h.service.generateDraftReport(obligationId, complianceAccess('cust_correct'));

    const corrected = h.service.createCorrection(
      obligationId,
      'Amend fill quantity after reconciliation mismatch',
      complianceAccess('cust_correct'),
    );
    assert.equal(corrected.ok, true);
    if (!corrected.ok) throw new Error('correct');
    assert.equal(corrected.value.package.packageVersion, 2);
    assert.ok(corrected.value.package.supersedesPackageId);
    assert.equal(corrected.value.report.submissionState, 'CORRECTED');
    assert.ok(corrected.value.report.supersedesReportPackageId);
    assert.equal(corrected.value.report.correctionReason, 'Amend fill quantity after reconciliation mismatch');
  });

  it('13. duplicate trigger idempotency', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_idem', 'idem');
    h.service.createEvidencePackage(ctx);
    const first = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_idem',
      notionalMinorUnits: '10000000',
    });
    assert.equal(first.ok, true);
    if (!first.ok) throw new Error('first');
    const second = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_idem',
      notionalMinorUnits: '10000000',
    });
    assert.equal(second.ok, true);
    if (!second.ok) throw new Error('second');
    assert.equal(first.value.obligations[0]!.obligationId, second.value.obligations[0]!.obligationId);
    assert.equal(h.service.store.obligationsForTrace(ctx.traceId).length, first.value.obligations.length);
  });

  it('14. reconstruction test', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_recon', 'recon');
    h.serviceWithSubmission.createEvidencePackage(ctx);
    h.serviceWithSubmission.processOrderEventTrigger({
      ctx,
      orderId: 'order_recon',
      notionalMinorUnits: '10000000',
    });
    const graph = h.serviceWithSubmission.reconstruct(ctx.traceId);
    assert.ok(graph);
    assert.equal(graph!.customer.customerId, ctx.customerScope.customerId);
    assert.equal(graph!.jurisdiction, ctx.customerScope.jurisdiction);
    assert.equal(graph!.mandate, ctx.authorityContext.mandateRef);
    assert.equal(graph!.capabilityPolicy, ctx.authorityContext.capabilityPackVersion);
    assert.equal(graph!.model.modelVersion, 'mdl_s3m_v1');
    assert.equal(graph!.strategy.capsuleId, 'capsule_h29_ref');
    assert.equal(graph!.risk.riskOutcome, 'ALLOW');
    assert.equal(graph!.compliance.kernelOutcome, 'ALLOW');
    assert.equal(graph!.authorization, 'ea_sim_h29');
    assert.equal(graph!.execution.orderId, 'order_recon');
    assert.deepEqual([...graph!.fill], ['fill_recon_1']);
    assert.deepEqual([...graph!.fee], ['fee_recon_1']);
    assert.deepEqual([...graph!.settlement], ['settle_recon_1']);
    assert.equal(graph!.reconciliation, 'recon_recon');
    assert.equal(graph!.result.realized, 'realized_pnl_001');
    assert.ok(graph!.reportingObligation.length >= 1);
  });

  it('15. role-based access', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_access', 'access');
    const created = h.service.createEvidencePackage(ctx);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');

    const denied = h.service.getEvidencePackage(created.value.packageId, unauthorizedAccess());
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error('expected deny');
    assert.equal(denied.error.code, 'ACCESS_DENIED');

    const allowed = h.service.getEvidencePackage(created.value.packageId, complianceAccess('cust_access'));
    assert.equal(allowed.ok, true);
  });

  it('17. customer isolation', () => {
    const h = createHarness();
    const ctxA = baseActionContext('cust_h29_a', 'iso_a');
    const ctxB = baseActionContext('cust_h29_b', 'iso_b');
    h.service.createEvidencePackage(ctxA);
    h.service.createEvidencePackage(ctxB);
    h.service.processOrderEventTrigger({ ctx: ctxA, orderId: 'order_iso_a', notionalMinorUnits: '10000000' });
    h.service.processOrderEventTrigger({ ctx: ctxB, orderId: 'order_iso_b', notionalMinorUnits: '10000000' });

    const pkgA = h.service.store.latestPackageForTrace(ctxA.traceId)!;
    const crossCustomerAccess = complianceAccess('cust_h29_b');
    const denied = h.service.getEvidencePackage(pkgA.packageId, crossCustomerAccess);
    assert.equal(denied.ok, false);
    if (denied.ok) throw new Error('expected isolation');
    assert.equal(denied.error.code, 'ACCESS_DENIED');
  });

  it('18. report package references canonical financial truth', () => {
    const h = createHarness();
    const ctx = baseActionContext('cust_truth', 'truth');
    h.service.createEvidencePackage(ctx);
    const triggered = h.service.processOrderEventTrigger({
      ctx,
      orderId: 'order_truth',
      notionalMinorUnits: '10000000',
    });
    assert.equal(triggered.ok, true);
    if (!triggered.ok) throw new Error('trigger');
    const obligationId = triggered.value.obligations[0]!.obligationId;
    const draft = h.service.generateDraftReport(obligationId, complianceAccess('cust_truth'));
    assert.equal(draft.ok, true);
    if (!draft.ok) throw new Error('draft');
    const financialSection = draft.value.sections.find((s) => s.sectionId === 'financial_lifecycle');
    assert.ok(financialSection);
    assert.ok(financialSection!.financialRecordRefs.includes('order_truth'));
    assert.ok(financialSection!.financialRecordRefs.includes('fill_truth_1'));
    assert.ok(financialSection!.financialRecordRefs.includes('settle_truth_1'));
    assert.ok(financialSection!.canonicalEventIds.includes('order_truth'));
    assert.equal(financialSection!.narrativeSummary, null);
  });
});
