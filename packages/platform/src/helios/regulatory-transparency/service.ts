import type { Clock } from '../../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  evaluateExportApproval,
  evaluateExportAuthorization,
} from './authorization.ts';
import {
  activatePolicyVersion,
  assessApplicability,
  proposePolicyVersion,
  recordTestResults,
  rollbackPolicyVersion,
  schedulePolicyActivation,
  transitionChangeRequest,
  validateOfficialSource,
  type ChangeGovernanceFailure,
} from './change-governance.ts';
import {
  sealChangeRequest,
  sealExportPackage,
  sealExportRequest,
  sealPolicyActivation,
  sealPolicyRollback,
} from './evidence.ts';
import { exportPackageIdFor, exportRequestIdFor, changeRequestIdFor } from './ids.ts';
import { buildExportPackage } from './package-integrity.ts';
import { buildExportArtifact } from './redaction.ts';
import { InMemoryRegulatoryTransparencyStore } from './store.ts';
import type {
  EvidenceSourcePort,
  ExportScope,
  OfficialSourceReference,
  PolicyChangeTestResult,
  PolicyVersionRecord,
  RegulatoryChangeRequest,
  SupervisoryActor,
  SupervisoryExportRequest,
} from './types.ts';
import type {
  ExportMode,
  ActivationMode,
  ChangeRequestState,
} from './taxonomy.ts';
import type { PolicyVersionRef, RegulatoryChangeRequestId, SupervisoryExportRequestId } from './ids.ts';

export type RegulatoryTransparencyFailure = {
  readonly code:
    | 'UNAUTHORIZED'
    | 'APPROVAL_REQUIRED'
    | 'APPROVAL_DENIED'
    | 'SCOPE_VIOLATION'
    | 'REQUEST_NOT_FOUND'
    | 'REQUEST_NOT_APPROVED'
    | 'CHANGE_NOT_FOUND'
    | ChangeGovernanceFailure['code'];
  readonly message: string;
};

const ACCESS_EXPIRY_HOURS = 72;

/**
 * HELIOS H30 — Supervisory access and regulated change governance coordinator.
 * Bounded evidence export and policy-change lifecycle. No financial mutation.
 */
export class RegulatoryTransparencyService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly evidenceSource: EvidenceSourcePort;
  readonly store: InMemoryRegulatoryTransparencyStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly evidenceSource: EvidenceSourcePort;
    readonly store?: InMemoryRegulatoryTransparencyStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.evidenceSource = input.evidenceSource;
    this.store = input.store ?? new InMemoryRegulatoryTransparencyStore();
  }

  createExportRequest(input: {
    readonly requestKey: string;
    readonly actor: SupervisoryActor;
    readonly legalBasisRef: string;
    readonly purposeRef: string;
    readonly exportMode: ExportMode;
    readonly scope: ExportScope;
  }): Result<SupervisoryExportRequest, RegulatoryTransparencyFailure> {
    const auth = evaluateExportAuthorization(input.actor, input.exportMode);
    if (!auth.permitted) {
      return err({ code: 'UNAUTHORIZED', message: auth.reason });
    }

    const now = this.clock.now();
    const exportRequestId = exportRequestIdFor(input.requestKey);
    const auditRef = sealExportRequest(this.evidence, {
      exportRequestId,
      requestingAuthority: input.actor,
      legalBasisRef: input.legalBasisRef,
      purposeRef: input.purposeRef,
      exportMode: input.exportMode,
      scope: input.scope,
      approvalState: auth.requiredApproval ? 'PENDING' : 'APPROVED',
      approvedBy: auth.requiredApproval ? null : input.actor,
      approvedAt: auth.requiredApproval ? null : now,
      generatedAt: null,
      accessExpiry: null,
      packageRefs: Object.freeze([]),
      auditTrailRefs: Object.freeze([]),
      createdAt: now,
    }) ?? `audit:export-request:${exportRequestId}`;

    const request: SupervisoryExportRequest = Object.freeze({
      exportRequestId,
      requestingAuthority: input.actor,
      legalBasisRef: input.legalBasisRef,
      purposeRef: input.purposeRef,
      exportMode: input.exportMode,
      scope: input.scope,
      approvalState: auth.requiredApproval ? 'PENDING' : 'APPROVED',
      approvedBy: auth.requiredApproval ? null : input.actor,
      approvedAt: auth.requiredApproval ? null : now,
      generatedAt: null,
      accessExpiry: null,
      packageRefs: Object.freeze([]),
      auditTrailRefs: Object.freeze([auditRef]),
      createdAt: now,
    });

    this.store.putExportRequest(request);
    return ok(request);
  }

  approveExportRequest(input: {
    readonly exportRequestId: SupervisoryExportRequestId;
    readonly approver: SupervisoryActor;
  }): Result<SupervisoryExportRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getExportRequest(input.exportRequestId);
    if (!existing) {
      return err({ code: 'REQUEST_NOT_FOUND', message: 'export request not found' });
    }
    if (existing.approvalState !== 'PENDING') {
      return err({ code: 'APPROVAL_DENIED', message: `request already ${existing.approvalState}` });
    }

    const auth = evaluateExportApproval(input.approver, existing.exportMode);
    if (!auth.permitted) {
      return err({ code: 'UNAUTHORIZED', message: auth.reason });
    }

    const now = this.clock.now();
    const updated: SupervisoryExportRequest = Object.freeze({
      ...existing,
      approvalState: 'APPROVED',
      approvedBy: input.approver,
      approvedAt: now,
      auditTrailRefs: Object.freeze([
        ...existing.auditTrailRefs,
        `audit:export-approved:${input.exportRequestId}:${now}`,
      ]),
    });
    this.store.putExportRequest(updated);
    return ok(updated);
  }

  generateExportPackage(input: {
    readonly exportRequestId: SupervisoryExportRequestId;
    readonly identified?: boolean;
  }): Result<import('./types.ts').SupervisoryExportPackage, RegulatoryTransparencyFailure> {
    const request = this.store.getExportRequest(input.exportRequestId);
    if (!request) {
      return err({ code: 'REQUEST_NOT_FOUND', message: 'export request not found' });
    }
    if (request.approvalState !== 'APPROVED') {
      return err({ code: 'REQUEST_NOT_APPROVED', message: 'export requires approval' });
    }

    const records = this.evidenceSource.queryByScope({
      customerIds: request.scope.customerIds,
      jurisdictions: request.scope.jurisdictions,
      dateRangeStart: request.scope.dateRangeStart,
      dateRangeEnd: request.scope.dateRangeEnd,
      artifactClasses: request.scope.artifactClasses,
    });

    const identified = input.identified ?? request.exportMode !== 'REGULATOR_EXPORT';
    const artifacts = records.map((record) =>
      buildExportArtifact(
        record.artifactClass,
        record.payload as Readonly<Record<string, unknown>>,
        record.ref,
        identified,
      ),
    );

    const now = this.clock.now();
    const packageId = exportPackageIdFor(request.exportRequestId);
    const pkg = buildExportPackage({
      packageId,
      exportRequestId: request.exportRequestId,
      artifacts,
      generatedAt: now,
    });

    const packageAuditRef =
      sealExportPackage(this.evidence, pkg) ?? `audit:export-package:${packageId}`;
    const accessExpiry = addHours(now, ACCESS_EXPIRY_HOURS);

    const updatedRequest: SupervisoryExportRequest = Object.freeze({
      ...request,
      generatedAt: now,
      accessExpiry,
      packageRefs: Object.freeze([...request.packageRefs, packageId]),
      auditTrailRefs: Object.freeze([...request.auditTrailRefs, packageAuditRef]),
    });
    this.store.putExportRequest(updatedRequest);
    this.store.putExportPackage(pkg);
    return ok(pkg);
  }

  createChangeRequest(input: {
    readonly requestKey: string;
    readonly actor: SupervisoryActor;
    readonly officialSource: OfficialSourceReference;
    readonly currentPolicyVersionRef: PolicyVersionRef;
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const sourceCheck = validateOfficialSource(input.officialSource);
    if (!sourceCheck.ok) {
      return err({ code: sourceCheck.error.code, message: sourceCheck.error.message });
    }

    const now = this.clock.now();
    const changeRequestId = changeRequestIdFor(input.requestKey);
    const auditRef =
      sealChangeRequest(this.evidence, {
        changeRequestId,
        state: 'OFFICIAL_SOURCE_CAPTURED',
        officialSource: input.officialSource,
        applicability: null,
        proposedPolicyVersion: null,
        currentPolicyVersionRef: input.currentPolicyVersionRef,
        testResults: Object.freeze([]),
        activationMode: null,
        scheduledEffectiveAt: null,
        activatedAt: null,
        approvals: Object.freeze([]),
        auditTrailRefs: Object.freeze([]),
        createdAt: now,
        updatedAt: now,
        createdBy: input.actor,
      }) ?? `audit:change-request:${changeRequestId}`;

    const request: RegulatoryChangeRequest = Object.freeze({
      changeRequestId,
      state: 'OFFICIAL_SOURCE_CAPTURED',
      officialSource: input.officialSource,
      applicability: null,
      proposedPolicyVersion: null,
      currentPolicyVersionRef: input.currentPolicyVersionRef,
      testResults: Object.freeze([]),
      activationMode: null,
      scheduledEffectiveAt: null,
      activatedAt: null,
      approvals: Object.freeze([]),
      auditTrailRefs: Object.freeze([auditRef]),
      createdAt: now,
      updatedAt: now,
      createdBy: input.actor,
    });

    this.store.putChangeRequest(request);
    return ok(request);
  }

  advanceChangeRequest(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly toState: ChangeRequestState;
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }
    const now = this.clock.now();
    const auditRef = `audit:transition:${input.changeRequestId}:${input.toState}:${now}`;
    const result = transitionChangeRequest(existing, input.toState, now, auditRef);
    if (!result.ok) {
      return err({ code: result.error.code, message: result.error.message });
    }
    this.store.putChangeRequest(result.value);
    return ok(result.value);
  }

  submitApplicability(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly assessment: Parameters<typeof assessApplicability>[0];
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }

    const assessed = assessApplicability(input.assessment);
    if (!assessed.ok) {
      return err({ code: assessed.error.code, message: assessed.error.message });
    }

    const now = this.clock.now();
    let request: RegulatoryChangeRequest = Object.freeze({
      ...existing,
      applicability: assessed.value,
      updatedAt: now,
    });

    let transition = transitionChangeRequest(
      request,
      'APPLICABILITY_ASSESSMENT',
      now,
      `audit:applicability:${input.changeRequestId}`,
    );
    if (!transition.ok) {
      return err({ code: transition.error.code, message: transition.error.message });
    }
    request = transition.value;

    if (assessed.value.uncertainty === 'UNKNOWN') {
      transition = transitionChangeRequest(
        request,
        'REVIEW_REQUIRED',
        now,
        `audit:applicability-review:${input.changeRequestId}`,
      );
      if (!transition.ok) {
        return err({ code: transition.error.code, message: transition.error.message });
      }
      request = transition.value;
    }

    this.store.putChangeRequest(request);
    return ok(request);
  }

  proposePolicyChange(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly packId: string;
    readonly versionNumber: string;
    readonly content: Readonly<Record<string, unknown>>;
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }

    const proposed = proposePolicyVersion({
      packId: input.packId,
      versionNumber: input.versionNumber,
      content: input.content,
      previousVersionRef: existing.currentPolicyVersionRef,
    });

    const now = this.clock.now();
    this.store.putPolicyVersion(proposed);

    let request: RegulatoryChangeRequest = Object.freeze({
      ...existing,
      proposedPolicyVersion: proposed,
      updatedAt: now,
    });

    const steps: ChangeRequestState[] = [
      'APPLICABILITY_ASSESSMENT',
      'LEGAL_COMPLIANCE_REVIEW',
      'POLICY_CHANGE_PROPOSED',
      'TESTS_REQUIRED',
    ];
    for (const step of steps) {
      if (request.state === step) continue;
      const transition = transitionChangeRequest(
        request,
        step,
        now,
        `audit:propose:${input.changeRequestId}:${step}`,
      );
      if (transition.ok) {
        request = transition.value;
      }
    }

    this.store.putChangeRequest(request);
    return ok(request);
  }

  submitTestResults(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly results: readonly PolicyChangeTestResult[];
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }
    const now = this.clock.now();
    const result = recordTestResults(
      existing,
      input.results,
      now,
      `audit:tests:${input.changeRequestId}`,
    );
    if (!result.ok) {
      return err({ code: result.error.code, message: result.error.message });
    }
    this.store.putChangeRequest(result.value);
    return ok(result.value);
  }

  requestPolicyActivation(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly approver: SupervisoryActor;
    readonly mode: ActivationMode;
    readonly effectiveAt?: UtcInstant;
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }

    const now = this.clock.now();

    if (input.mode === 'IMMEDIATE') {
      let request = existing;
      if (request.state === 'TESTS_PASSED') {
        const toApproval = transitionChangeRequest(
          request,
          'APPROVAL_REQUIRED',
          now,
          `audit:approval-required:${input.changeRequestId}`,
        );
        if (toApproval.ok) {
          request = toApproval.value;
        }
      }

      const activation = activatePolicyVersion({
        request,
        approver: input.approver,
        now,
        auditRef: `audit:activate:${input.changeRequestId}`,
        evidenceRef: `evidence:activation:${input.changeRequestId}`,
        alreadyActivated: this.store.wasActivationExecuted(input.changeRequestId),
      });
      if (!activation.ok) {
        return err({ code: activation.error.code, message: activation.error.message });
      }

      sealPolicyActivation(this.evidence, {
        changeRequestId: input.changeRequestId,
        policyVersionRef: activation.value.version.versionRef,
        activatedAt: now,
        approverId: input.approver.operatorId,
      });

      this.store.putPolicyVersion(activation.value.version);
      this.store.markActivated(activation.value.version.versionRef);
      this.store.markActivationExecuted(input.changeRequestId);
      this.store.putChangeRequest(activation.value.request);
      return ok(activation.value.request);
    }

    let request = existing;
    const toApproval = transitionChangeRequest(
      request,
      'APPROVAL_REQUIRED',
      now,
      `audit:approval-required:${input.changeRequestId}`,
    );
    if (toApproval.ok) {
      request = toApproval.value;
    }

    const scheduled = schedulePolicyActivation(
      request,
      input.mode,
      input.effectiveAt ?? null,
      now,
      `audit:schedule:${input.changeRequestId}`,
    );
    if (!scheduled.ok) {
      return err({ code: scheduled.error.code, message: scheduled.error.message });
    }

    if (input.effectiveAt && scheduled.value.proposedPolicyVersion) {
      this.store.scheduleActivation(
        Object.freeze({
          changeRequestId: input.changeRequestId,
          policyVersionRef: scheduled.value.proposedPolicyVersion.versionRef,
          effectiveAt: input.effectiveAt,
          executed: false,
        }),
      );
    }

    this.store.putChangeRequest(scheduled.value);
    return ok(scheduled.value);
  }

  processScheduledActivations(input: {
    readonly approver: SupervisoryActor;
  }): readonly RegulatoryChangeRequest[] {
    const now = this.clock.now();
    const activated: RegulatoryChangeRequest[] = [];

    for (const schedule of this.store.pendingScheduledActivations()) {
      if (schedule.effectiveAt > now) {
        continue;
      }
      const existing = this.store.getChangeRequest(schedule.changeRequestId);
      if (!existing) continue;

      const result = activatePolicyVersion({
        request: existing,
        approver: input.approver,
        now,
        auditRef: `audit:scheduled-activate:${schedule.changeRequestId}`,
        evidenceRef: `evidence:scheduled-activation:${schedule.changeRequestId}`,
        alreadyActivated: this.store.wasActivationExecuted(schedule.changeRequestId),
      });
      if (!result.ok) continue;

      sealPolicyActivation(this.evidence, {
        changeRequestId: schedule.changeRequestId,
        policyVersionRef: result.value.version.versionRef,
        activatedAt: now,
        approverId: input.approver.operatorId,
      });

      this.store.putPolicyVersion(result.value.version);
      this.store.markActivated(result.value.version.versionRef);
      this.store.markActivationExecuted(schedule.changeRequestId);
      this.store.putChangeRequest(result.value.request);
      activated.push(result.value.request);
    }

    return Object.freeze(activated);
  }

  rollbackPolicy(input: {
    readonly changeRequestId: RegulatoryChangeRequestId;
    readonly rollbackToVersionRef: PolicyVersionRef;
    readonly approver: SupervisoryActor;
  }): Result<RegulatoryChangeRequest, RegulatoryTransparencyFailure> {
    const existing = this.store.getChangeRequest(input.changeRequestId);
    if (!existing) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'change request not found' });
    }

    const rollbackVersion = this.store.getPolicyVersion(input.rollbackToVersionRef);
    if (!rollbackVersion) {
      return err({ code: 'CHANGE_NOT_FOUND', message: 'rollback target version not found' });
    }

    const now = this.clock.now();
    const result = rollbackPolicyVersion({
      request: existing,
      rollbackToVersion: rollbackVersion,
      now,
      auditRef: `audit:rollback:${input.changeRequestId}`,
      approver: input.approver,
    });
    if (!result.ok) {
      return err({ code: result.error.code, message: result.error.message });
    }

    sealPolicyRollback(this.evidence, {
      changeRequestId: input.changeRequestId,
      retiredVersionRef: existing.proposedPolicyVersion!.versionRef,
      rollbackVersionRef: input.rollbackToVersionRef,
      rolledBackAt: now,
    });

    this.store.putPolicyVersion(result.value.reactivatedVersion);
    this.store.markActivated(result.value.reactivatedVersion.versionRef);
    this.store.putChangeRequest(result.value.request);
    return ok(result.value.request);
  }

  restoreFromSnapshot(): void {
    // snapshot restore is on store directly
  }
}

function addHours(instant: UtcInstant, hours: number): UtcInstant {
  const ms = Date.parse(instant) + hours * 60 * 60 * 1000;
  return new Date(ms).toISOString() as UtcInstant;
}
