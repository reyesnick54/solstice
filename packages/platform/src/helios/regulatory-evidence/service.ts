import type { Clock } from '../../../../config/src/clock.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { sha256Hex } from '../../../../security/src/hash.ts';
import {
  canAccessEvidencePackage,
  canAccessObligation,
  canAccessReportPackage,
  canAuthorizeSubmission,
} from './access.ts';
import {
  evidencePackageIdFor,
  obligationIdFor,
  submissionRecordIdFor,
} from './ids.ts';
import {
  sealRegulatoryEvidencePackage,
  sealReportPackage,
  sealReportingObligation,
} from './evidence.ts';
import { generateStructuredReportPackage } from './report-generator.ts';
import {
  approvedRetentionYears,
  type ApprovedPolicyObligationRef,
} from './reporting-policy.ts';
import { InMemoryRegulatoryEvidenceStore } from './store.ts';
import {
  classifyOrderEvent,
  computeDueAt,
  detectReportingTrigger,
  reportingPolicyVersion,
} from './trigger-engine.ts';
import {
  canTransitionSubmission,
  generationIsNotSubmission,
  HELIOS_H28_REPORTING_POLICY_VERSION,
  type ObligationStatus,
  type SubmissionLifecycleState,
} from './taxonomy.ts';
import {
  submissionStateAfterValidation,
  validateReportPackage,
} from './validation.ts';
import type {
  ConsequentialActionContext,
  RegulatoryAccessContext,
  RegulatoryEvidenceFailure,
  RegulatoryEvidencePackage,
  ReconstructionGraph,
  ReportingObligation,
  StructuredReportPackage,
  SubmissionAcknowledgement,
  TriggerDetectionInput,
} from './types.ts';

export const HELIOS_H29_REGULATORY_EVIDENCE_REPORTING = 'HELIOS_H29_REGULATORY_EVIDENCE_REPORTING' as const;

function fail(code: RegulatoryEvidenceFailure['code'], message: string): Result<never, RegulatoryEvidenceFailure> {
  return err({ code, message });
}

function obligationStatusFromSubmission(state: SubmissionLifecycleState): ObligationStatus {
  switch (state) {
    case 'NOT_REQUIRED':
      return 'CLOSED';
    case 'POTENTIALLY_REQUIRED':
      return 'OPEN';
    case 'PREPARATION_REQUIRED':
      return 'PREPARING';
    case 'DRAFT':
      return 'PREPARING';
    case 'VALIDATION_REQUIRED':
      return 'VALIDATING';
    case 'READY_FOR_AUTHORIZED_SUBMISSION':
      return 'READY';
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'ACKNOWLEDGED':
      return 'ACKNOWLEDGED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CORRECTION_REQUIRED':
      return 'CORRECTION_REQUIRED';
    case 'CORRECTED':
      return 'CORRECTED';
    case 'CLOSED':
      return 'CLOSED';
    case 'UNKNOWN':
      return 'UNMAPPED';
    default:
      return 'LEGAL_REVIEW_REQUIRED';
  }
}

function initialSubmissionState(reportability: string): SubmissionLifecycleState {
  switch (reportability) {
    case 'NOT_REPORTABLE':
      return 'NOT_REQUIRED';
    case 'POTENTIALLY_REPORTABLE':
      return 'POTENTIALLY_REQUIRED';
    case 'REPORTABLE':
      return 'PREPARATION_REQUIRED';
    case 'LEGAL_REVIEW_REQUIRED':
    case 'UNMAPPED':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

function buildRetention(
  policyObl: ApprovedPolicyObligationRef,
  startEventRef: string,
  eventAt: ConsequentialActionContext['now'],
): ReportingObligation['retention'] {
  const years = approvedRetentionYears(policyObl.retentionClassRef);
  let expiry: ReportingObligation['retention']['expiryOrReviewDate'] = null;
  if (years !== null) {
    const d = new Date(eventAt);
    d.setUTCFullYear(d.getUTCFullYear() + years);
    expiry = d.toISOString() as ReportingObligation['retention']['expiryOrReviewDate'];
  }
  return Object.freeze({
    retentionClass:
      policyObl.retentionClassRef === 'ret_legal_hold_pending_review'
        ? 'LEGAL_HOLD'
        : policyObl.retentionClassRef === 'ret_unmapped'
          ? 'UNMAPPED'
          : 'REGULATORY_STANDARD',
    retentionClassRef: policyObl.retentionClassRef,
    startEventRef,
    expiryOrReviewDate: expiry,
    holdState: policyObl.mappingStatus === 'LEGAL_REVIEW_REQUIRED' ? 'LEGAL_HOLD' : 'NONE',
    jurisdiction: policyObl.jurisdiction,
    evidenceRefs: Object.freeze([...policyObl.evidenceRequirementRefs]),
  });
}

/**
 * Canonical HELIOS regulatory evidence and reporting lifecycle coordinator.
 * Generates evidence packages and report drafts; does not claim filing authority.
 */
export class RegulatoryEvidenceReportingService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  readonly store: InMemoryRegulatoryEvidenceStore;
  private readonly submissionIntegrationEnabled: boolean;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly store?: InMemoryRegulatoryEvidenceStore;
    readonly submissionIntegrationEnabled?: boolean;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.store = input.store ?? new InMemoryRegulatoryEvidenceStore();
    this.submissionIntegrationEnabled = input.submissionIntegrationEnabled ?? false;
  }

  createEvidencePackage(
    ctx: ConsequentialActionContext,
    reportabilityOverride?: RegulatoryEvidencePackage['reportabilityDetermination'],
  ): Result<RegulatoryEvidencePackage, RegulatoryEvidenceFailure> {
    const idempotencyKey = `pkg:${ctx.idempotencyKey}`;
    if (this.store.hasIdempotencyKey(idempotencyKey)) {
      const existing = this.store.latestPackageForTrace(ctx.traceId);
      if (existing) {
        return ok(existing);
      }
      return fail('DUPLICATE_IDEMPOTENCY', 'idempotency key already processed');
    }

    const existingPackages = this.store.packagesForTrace(ctx.traceId);
    const packageVersion = existingPackages.length + 1;
    const packageId = evidencePackageIdFor(ctx.traceId, packageVersion);

    const reportability =
      reportabilityOverride ??
      (ctx.controlDecisions.kernelOutcome === 'REFUSE' ? 'NOT_REPORTABLE' : 'POTENTIALLY_REPORTABLE');

    const reportingStatus = initialSubmissionState(reportability);

    const body = {
      packageId,
      traceId: ctx.traceId,
      packageVersion,
      customerScope: ctx.customerScope,
      actionEventRef: ctx.actionEventRef,
      controlDecisions: ctx.controlDecisions,
      financialRefs: ctx.financialRefs,
    };
    const packageHash = sha256Hex(JSON.stringify(body));

    const evidenceRefs = Object.freeze([
      ...ctx.intelligenceContext.observationRefs,
      ...(ctx.controlDecisions.kernelDecisionRef ? [ctx.controlDecisions.kernelDecisionRef] : []),
      ...(ctx.controlDecisions.riskDecisionRef ? [ctx.controlDecisions.riskDecisionRef] : []),
      ...(ctx.controlDecisions.envelopeId ? [ctx.controlDecisions.envelopeId] : []),
    ]);

    const pkg: RegulatoryEvidencePackage = Object.freeze({
      packageId,
      traceId: ctx.traceId,
      packageVersion,
      packageHash,
      customerScope: ctx.customerScope,
      actionEventRef: ctx.actionEventRef,
      actionEventKind: ctx.actionEventKind,
      workOrderId: ctx.workOrderId,
      jurisdiction: ctx.customerScope.jurisdiction,
      legalEntityRef: ctx.authorityContext.legalEntityRef,
      capabilityPolicyVersion: ctx.authorityContext.capabilityPackVersion,
      obligationRefs: Object.freeze([]),
      evidenceRefs,
      controlDecisions: ctx.controlDecisions,
      authorityContext: ctx.authorityContext,
      intelligenceContext: ctx.intelligenceContext,
      financialRefs: ctx.financialRefs,
      reportabilityDetermination: reportability,
      reportingStatus,
      vaultEvidenceId: null,
      createdAt: ctx.now,
      supersedesPackageId: existingPackages.length > 0 ? existingPackages[existingPackages.length - 1]!.packageId : null,
      correctionReason: null,
    });

    const vaultEvidenceId = sealRegulatoryEvidencePackage(this.evidence, pkg);
    const sealed = Object.freeze({ ...pkg, vaultEvidenceId });

    this.store.putPackage(sealed);
    this.store.markIdempotencyKey(idempotencyKey);

    return ok(sealed);
  }

  processTrigger(
    input: TriggerDetectionInput,
  ): Result<
    { readonly trigger: ReturnType<typeof detectReportingTrigger>['trigger']; readonly obligations: readonly ReportingObligation[] },
    RegulatoryEvidenceFailure
  > {
    if (this.store.hasIdempotencyKey(input.idempotencyKey)) {
      const existingTrigger = this.store.getTriggerByIdempotencyKey(input.idempotencyKey);
      if (existingTrigger) {
        const obligations = this.store.obligationsForTrace(input.traceId).filter(
          (o) => o.triggerEventId === existingTrigger.triggerEventId,
        );
        return ok({ trigger: existingTrigger, obligations });
      }
      const evaluation = detectReportingTrigger(input);
      const obligations = this.store.obligationsForTrace(input.traceId).filter((o) =>
        evaluation.matchedObligations.some((m) => m.policyObligationRef === o.policyObligationRef),
      );
      if (obligations.length > 0) {
        return ok({ trigger: evaluation.trigger, obligations });
      }
      return fail('DUPLICATE_IDEMPOTENCY', 'trigger idempotency key already processed');
    }

    const evaluation = detectReportingTrigger(input);
    this.store.putTrigger(evaluation.trigger);
    this.store.markIdempotencyKey(input.idempotencyKey);

    const evidencePackage = this.store.latestPackageForTrace(input.traceId);
    if (!evidencePackage) {
      return fail('TRACE_NOT_FOUND', `no evidence package for trace ${input.traceId}`);
    }

    const obligations: ReportingObligation[] = [];
    for (const policyObl of evaluation.matchedObligations) {
      const obligationId = obligationIdFor(evaluation.trigger.triggerEventId, policyObl.policyObligationRef);
      const dueAt = computeDueAt(policyObl, input.now);
      const submissionState =
        policyObl.mappingStatus === 'LEGAL_REVIEW_REQUIRED' || policyObl.mappingStatus === 'UNMAPPED'
          ? 'UNKNOWN'
          : evaluation.reportability === 'NOT_REPORTABLE'
            ? 'NOT_REQUIRED'
            : 'POTENTIALLY_REQUIRED';

      const obligation: ReportingObligation = Object.freeze({
        obligationId,
        traceId: input.traceId,
        packageId: evidencePackage.packageId,
        policyObligationRef: policyObl.policyObligationRef,
        policyVersion: reportingPolicyVersion(),
        approvedPolicySourceRef: policyObl.approvedPolicySourceRef,
        jurisdiction: policyObl.jurisdiction,
        legalEntityRef: policyObl.legalEntityRef,
        productActivity: policyObl.productActivity,
        triggerCategory: policyObl.triggerCategory,
        triggerEventId: evaluation.trigger.triggerEventId,
        reportType: policyObl.reportType,
        responsibleFiler: policyObl.responsibleFiler,
        dueRuleKind: policyObl.dueRuleKind,
        dueAt,
        reportingWindowStart: input.now,
        reportingWindowEnd: dueAt,
        evidenceRequirementRefs: policyObl.evidenceRequirementRefs,
        submissionChannelRef: policyObl.submissionChannelRef,
        retention: buildRetention(policyObl, input.sourceEventId, input.now),
        status: obligationStatusFromSubmission(submissionState),
        submissionState,
        mappingStatus: policyObl.mappingStatus,
        reportPackageId: null,
        createdAt: input.now,
        updatedAt: input.now,
      });

      sealReportingObligation(this.evidence, obligation);
      this.store.putObligation(obligation);
      obligations.push(obligation);
    }

    return ok({ trigger: evaluation.trigger, obligations: Object.freeze(obligations) });
  }

  processOrderEventTrigger(input: {
    readonly ctx: ConsequentialActionContext;
    readonly orderId: string;
    readonly notionalMinorUnits: string;
  }): Result<
    { readonly category: ReturnType<typeof classifyOrderEvent>; readonly obligations: readonly ReportingObligation[] },
    RegulatoryEvidenceFailure
  > {
    const category = classifyOrderEvent(input.notionalMinorUnits);
    const triggered = this.processTrigger({
      sourceEventId: input.orderId,
      sourceEventKind: 'HELIOS_ORDER',
      triggerCategory: category,
      customerId: input.ctx.customerScope.customerId,
      jurisdiction: input.ctx.customerScope.jurisdiction,
      productActivity: 'HELIOS_PAPER_INVESTMENT',
      traceId: input.ctx.traceId,
      now: input.ctx.now,
      idempotencyKey: `trigger:${input.ctx.idempotencyKey}:${category}`,
      metadata: Object.freeze({ notionalMinorUnits: input.notionalMinorUnits }),
    });
    if (!triggered.ok) {
      return triggered;
    }
    return ok(Object.freeze({ category, obligations: triggered.value.obligations }));
  }

  generateDraftReport(
    obligationId: ReportingObligation['obligationId'],
    access: RegulatoryAccessContext,
  ): Result<StructuredReportPackage, RegulatoryEvidenceFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) {
      return fail('OBLIGATION_NOT_FOUND', `obligation not found: ${obligationId}`);
    }

    const evidencePackage = this.store.getPackage(obligation.packageId);
    if (!evidencePackage) {
      return fail('PACKAGE_NOT_FOUND', `evidence package not found: ${obligation.packageId}`);
    }

    if (!canAccessObligation(access, obligation, evidencePackage.customerScope.customerId)) {
      return fail('ACCESS_DENIED', 'insufficient role or customer scope for draft generation');
    }

    const existing = this.store.reportPackagesForObligation(obligationId);
    const revision = existing.length + 1;
    const report = generateStructuredReportPackage({
      obligation,
      evidencePackage,
      revision,
      now: this.clock.now(),
    });

    const draft = Object.freeze({ ...report, submissionState: 'DRAFT' as SubmissionLifecycleState });
    sealReportPackage(this.evidence, draft);
    this.store.putReportPackage(draft);

    const updatedObligation = Object.freeze({
      ...obligation,
      reportPackageId: draft.reportPackageId,
      submissionState: 'DRAFT' as SubmissionLifecycleState,
      status: 'PREPARING' as ObligationStatus,
      updatedAt: this.clock.now(),
    });
    this.store.updateObligation(updatedObligation);

    return ok(draft);
  }

  validateReport(
    reportPackageId: StructuredReportPackage['reportPackageId'],
    access: RegulatoryAccessContext,
  ): Result<StructuredReportPackage, RegulatoryEvidenceFailure> {
    const report = this.store.getReportPackage(reportPackageId);
    if (!report) {
      return fail('REPORT_NOT_FOUND', `report not found: ${reportPackageId}`);
    }

    const obligation = this.store.getObligation(report.obligationId);
    if (!obligation) {
      return fail('OBLIGATION_NOT_FOUND', `obligation not found: ${report.obligationId}`);
    }

    const evidencePackage = this.store.getPackage(report.packageId);
    if (!evidencePackage) {
      return fail('PACKAGE_NOT_FOUND', `evidence package not found: ${report.packageId}`);
    }

    if (!canAccessReportPackage(access, report, evidencePackage.customerScope.customerId)) {
      return fail('ACCESS_DENIED', 'insufficient role for validation');
    }

    const validation = validateReportPackage(report, obligation, evidencePackage);
    const nextState = submissionStateAfterValidation(validation);

    const updatedReport = Object.freeze({
      ...report,
      validationFailures: validation.failures,
      submissionState: nextState,
    });
    this.store.updateReportPackage(updatedReport);

    const updatedObligation = Object.freeze({
      ...obligation,
      submissionState: nextState,
      status: obligationStatusFromSubmission(nextState),
      updatedAt: this.clock.now(),
    });
    this.store.updateObligation(updatedObligation);

    if (!validation.ok) {
      return fail('VALIDATION_FAILED', `validation failures: ${validation.failures.join(', ')}`);
    }

    return ok(updatedReport);
  }

  markReadyForAuthorizedSubmission(
    reportPackageId: StructuredReportPackage['reportPackageId'],
    access: RegulatoryAccessContext,
  ): Result<StructuredReportPackage, RegulatoryEvidenceFailure> {
    const validated = this.validateReport(reportPackageId, access);
    if (!validated.ok) {
      return validated;
    }
    if (validated.value.submissionState !== 'READY_FOR_AUTHORIZED_SUBMISSION') {
      return fail('VALIDATION_FAILED', 'report is not ready for authorized submission');
    }
    return validated;
  }

  submitReport(
    reportPackageId: StructuredReportPackage['reportPackageId'],
    access: RegulatoryAccessContext,
    input: {
      readonly submitterAuthority: string;
      readonly submissionReference: string;
    },
  ): Result<SubmissionAcknowledgement, RegulatoryEvidenceFailure> {
    if (!canAuthorizeSubmission(access)) {
      return fail('ACCESS_DENIED', 'submission requires COMPLIANCE or LEGAL role');
    }

    if (!this.submissionIntegrationEnabled) {
      return fail('SUBMISSION_NOT_AUTHORIZED', 'no authorized regulator/provider submission integration connected');
    }

    const report = this.store.getReportPackage(reportPackageId);
    if (!report) {
      return fail('REPORT_NOT_FOUND', `report not found: ${reportPackageId}`);
    }

    if (report.submissionState !== 'READY_FOR_AUTHORIZED_SUBMISSION') {
      return fail('INVALID_STATE_TRANSITION', 'report must be READY_FOR_AUTHORIZED_SUBMISSION before submission');
    }

    const obligation = this.store.getObligation(report.obligationId)!;
    const now = this.clock.now();
    const attempt = this.store.submissionsForObligation(obligation.obligationId).length + 1;
    const submissionRecordId = submissionRecordIdFor(reportPackageId, attempt);

    const submission: SubmissionAcknowledgement = Object.freeze({
      submissionRecordId,
      reportPackageId,
      obligationId: obligation.obligationId,
      submissionReference: input.submissionReference,
      submittedAt: now,
      submitterAuthority: input.submitterAuthority,
      externalAcknowledgementRef: null,
      regulatorProviderReference: null,
      responseStatus: 'PENDING',
      acknowledgedAt: null,
      rejectionReason: null,
    });

    this.store.addSubmission(submission);

    const updatedReport = Object.freeze({ ...report, submissionState: 'SUBMITTED' as SubmissionLifecycleState });
    this.store.updateReportPackage(updatedReport);

    const updatedObligation = Object.freeze({
      ...obligation,
      submissionState: 'SUBMITTED' as SubmissionLifecycleState,
      status: 'SUBMITTED' as ObligationStatus,
      updatedAt: now,
    });
    this.store.updateObligation(updatedObligation);

    return ok(submission);
  }

  acknowledgeSubmission(
    submissionRecordId: SubmissionAcknowledgement['submissionRecordId'],
    input: {
      readonly externalAcknowledgementRef: string;
      readonly regulatorProviderReference: string;
    },
    access: RegulatoryAccessContext,
  ): Result<SubmissionAcknowledgement, RegulatoryEvidenceFailure> {
    if (!canAuthorizeSubmission(access)) {
      return fail('ACCESS_DENIED', 'acknowledgement requires COMPLIANCE or LEGAL role');
    }

    const submission = this.store
      .snapshot()
      .submissions.find((s) => s.submissionRecordId === submissionRecordId);
    if (!submission) {
      return fail('REPORT_NOT_FOUND', 'submission record not found');
    }

    const now = this.clock.now();
    const acknowledged: SubmissionAcknowledgement = Object.freeze({
      ...submission,
      externalAcknowledgementRef: input.externalAcknowledgementRef,
      regulatorProviderReference: input.regulatorProviderReference,
      responseStatus: 'ACKNOWLEDGED',
      acknowledgedAt: now,
    });

    const report = this.store.getReportPackage(submission.reportPackageId)!;
    const obligation = this.store.getObligation(submission.obligationId)!;

    this.store.addSubmission(acknowledged);
    this.store.updateReportPackage(
      Object.freeze({ ...report, submissionState: 'ACKNOWLEDGED' as SubmissionLifecycleState }),
    );
    this.store.updateObligation(
      Object.freeze({
        ...obligation,
        submissionState: 'ACKNOWLEDGED' as SubmissionLifecycleState,
        status: 'ACKNOWLEDGED' as ObligationStatus,
        updatedAt: now,
      }),
    );

    return ok(acknowledged);
  }

  rejectSubmission(
    submissionRecordId: SubmissionAcknowledgement['submissionRecordId'],
    rejectionReason: string,
    access: RegulatoryAccessContext,
  ): Result<SubmissionAcknowledgement, RegulatoryEvidenceFailure> {
    if (!canAuthorizeSubmission(access)) {
      return fail('ACCESS_DENIED', 'rejection handling requires COMPLIANCE or LEGAL role');
    }

    const submission = this.store
      .snapshot()
      .submissions.find((s) => s.submissionRecordId === submissionRecordId);
    if (!submission) {
      return fail('REPORT_NOT_FOUND', 'submission record not found');
    }

    const now = this.clock.now();
    const rejected: SubmissionAcknowledgement = Object.freeze({
      ...submission,
      responseStatus: 'REJECTED',
      rejectionReason,
      acknowledgedAt: now,
    });

    const report = this.store.getReportPackage(submission.reportPackageId)!;
    const obligation = this.store.getObligation(submission.obligationId)!;

    this.store.addSubmission(rejected);
    this.store.updateReportPackage(
      Object.freeze({ ...report, submissionState: 'REJECTED' as SubmissionLifecycleState }),
    );
    this.store.updateObligation(
      Object.freeze({
        ...obligation,
        submissionState: 'CORRECTION_REQUIRED' as SubmissionLifecycleState,
        status: 'REJECTED' as ObligationStatus,
        updatedAt: now,
      }),
    );

    return ok(rejected);
  }

  createCorrection(
    obligationId: ReportingObligation['obligationId'],
    correctionReason: string,
    access: RegulatoryAccessContext,
  ): Result<{ readonly package: RegulatoryEvidencePackage; readonly report: StructuredReportPackage }, RegulatoryEvidenceFailure> {
    const obligation = this.store.getObligation(obligationId);
    if (!obligation) {
      return fail('OBLIGATION_NOT_FOUND', `obligation not found: ${obligationId}`);
    }

    const priorPackage = this.store.getPackage(obligation.packageId);
    if (!priorPackage) {
      return fail('PACKAGE_NOT_FOUND', 'prior evidence package not found');
    }

    if (!canAccessObligation(access, obligation, priorPackage.customerScope.customerId)) {
      return fail('ACCESS_DENIED', 'insufficient role for correction');
    }

    const now = this.clock.now();
    const packageVersion = priorPackage.packageVersion + 1;
    const packageId = evidencePackageIdFor(priorPackage.traceId, packageVersion);
    const packageHash = sha256Hex(`${priorPackage.packageHash}:${correctionReason}:${packageVersion}`);

    const correctedPackage: RegulatoryEvidencePackage = Object.freeze({
      ...priorPackage,
      packageId,
      packageVersion,
      packageHash,
      supersedesPackageId: priorPackage.packageId,
      correctionReason,
      reportingStatus: 'CORRECTION_REQUIRED',
      createdAt: now,
      vaultEvidenceId: null,
    });

    const vaultEvidenceId = sealRegulatoryEvidencePackage(this.evidence, correctedPackage);
    const sealed = Object.freeze({ ...correctedPackage, vaultEvidenceId });
    this.store.putPackage(sealed);

    const existingReports = this.store.reportPackagesForObligation(obligationId);
    const priorReport = existingReports[existingReports.length - 1];
    const revision = existingReports.length + 1;
    const report = generateStructuredReportPackage({
      obligation: Object.freeze({ ...obligation, packageId }),
      evidencePackage: sealed,
      revision,
      now,
      supersedesReportPackageId: priorReport?.reportPackageId ?? null,
      correctionReason,
    });

    const correctedReport = Object.freeze({
      ...report,
      submissionState: 'CORRECTED' as SubmissionLifecycleState,
    });
    sealReportPackage(this.evidence, correctedReport);
    this.store.putReportPackage(correctedReport);

    const updatedObligation = Object.freeze({
      ...obligation,
      packageId,
      reportPackageId: correctedReport.reportPackageId,
      submissionState: 'CORRECTED' as SubmissionLifecycleState,
      status: 'CORRECTED' as ObligationStatus,
      updatedAt: now,
    });
    this.store.updateObligation(updatedObligation);

    return ok({ package: sealed, report: correctedReport });
  }

  reconstruct(traceId: ConsequentialActionContext['traceId']): ReconstructionGraph | null {
    const evidencePackage = this.store.latestPackageForTrace(traceId);
    if (!evidencePackage) {
      return null;
    }

    const obligations = this.store.obligationsForTrace(traceId);
    const reportPackages = obligations.flatMap((o) => [...this.store.reportPackagesForObligation(o.obligationId)]);
    const submissions = obligations.flatMap((o) => [...this.store.submissionsForObligation(o.obligationId)]);

    return Object.freeze({
      traceId,
      customer: evidencePackage.customerScope,
      jurisdiction: evidencePackage.jurisdiction,
      mandate: evidencePackage.authorityContext.mandateRef,
      capabilityPolicy: evidencePackage.capabilityPolicyVersion,
      evidencePackage,
      obligations,
      reportPackages,
      submissions,
      model: evidencePackage.intelligenceContext,
      strategy: Object.freeze({
        capsuleId: evidencePackage.intelligenceContext.strategyCapsuleId,
        version: evidencePackage.intelligenceContext.strategyCapsuleVersion,
      }),
      risk: evidencePackage.controlDecisions,
      compliance: evidencePackage.controlDecisions,
      authorization: evidencePackage.controlDecisions.executionAuthorityRef,
      execution: evidencePackage.financialRefs,
      fill: evidencePackage.financialRefs.fillRefs,
      fee: evidencePackage.financialRefs.feeRefs,
      settlement: evidencePackage.financialRefs.settlementRefs,
      reconciliation: evidencePackage.financialRefs.reconciliationRef,
      result: Object.freeze({
        realized: evidencePackage.financialRefs.realizedStateRef,
        unrealized: evidencePackage.financialRefs.unrealizedStateRef,
      }),
      reportingObligation: obligations,
      reportingStatus: evidencePackage.reportingStatus,
    });
  }

  getEvidencePackage(
    packageId: RegulatoryEvidencePackage['packageId'],
    access: RegulatoryAccessContext,
  ): Result<RegulatoryEvidencePackage, RegulatoryEvidenceFailure> {
    const pkg = this.store.getPackage(packageId);
    if (!pkg) {
      return fail('PACKAGE_NOT_FOUND', `package not found: ${packageId}`);
    }
    if (!canAccessEvidencePackage(access, pkg)) {
      return fail('ACCESS_DENIED', 'insufficient role or customer scope');
    }
    return ok(pkg);
  }

  assertGenerationIsNotSubmission(state: SubmissionLifecycleState): boolean {
    return generationIsNotSubmission(state);
  }

  assertValidTransition(from: SubmissionLifecycleState, to: SubmissionLifecycleState): boolean {
    return canTransitionSubmission(from, to);
  }

  policyVersion(): typeof HELIOS_H28_REPORTING_POLICY_VERSION {
    return HELIOS_H28_REPORTING_POLICY_VERSION;
  }
}
