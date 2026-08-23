import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import { addMs } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import { assuranceAtLeast } from '../../../identity/src/assurance.ts';
import type { StaffOperator } from '../../../identity/src/staff/operator.ts';
import {
  DUAL_CONTROL_ACTIONS,
  STEP_UP_ACTIONS,
  evaluateSegregationOfDuties,
  operatorMayAccessDomain,
  operatorMayReadSurface,
  staffHoldsCustodySigning,
  staffHoldsLedgerMutator,
  type OpsReadSurface,
  type PrivilegedStaffAction,
} from '../../../identity/src/staff/sod.ts';
import { decideCase } from '../compliance/cases.ts';
import {
  addApproval,
  addEvidence,
  addFinding,
  addNote,
  assignOperationalCase,
  openOperationalCase,
  resolveOperationalCase,
  transitionOperationalCase,
} from './cases.ts';
import { OPERATIONS_CONTROL_FLAGS } from './flags.ts';
import type {
  AgentOpsView,
  CustodyOpsView,
  PaymentOpsView,
  ProviderOpsView,
  ReconciliationOpsView,
  SecurityOpsView,
  SupportCustomerView,
  SurveillanceOpsView,
  TreasuryOpsView,
} from './reads.ts';
import { EMPTY_OPERATIONS_SNAPSHOT, OperationsStore, type OperationsSnapshot } from './store.ts';
import {
  isOperationalCaseDomain,
  isOperationalCaseState,
  type OperationalApproval,
  type OperationalCase,
  type OperationalCaseDomain,
  type OperationalCaseState,
  type OperationalFinding,
  type OperationalReference,
  type OperationalSeverity,
  type OperationalSource,
  type OperationsSearchQuery,
  type OperatorActionRecord,
  type SupportViewSession,
  type TimelineEntry,
} from './types.ts';

export type OperationsDenial = {
  readonly code: string;
  readonly message: string;
};

export type OperationsEventRecord = {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: UtcInstant;
  readonly evidenceId: string;
};

export type OperationsEventSink = {
  record(event: OperationsEventRecord): void;
};

export type PrivilegedActionInput = {
  readonly operator: StaffOperator;
  readonly action: PrivilegedStaffAction;
  readonly reason: string;
  readonly caseId?: string;
  readonly subjectRef?: string;
  readonly nextStatus?: OperationalCaseState;
  readonly finding?: OperationalFinding;
  readonly note?: string;
  readonly secondApprover?: StaffOperator;
  readonly resolution?: string;
  readonly now?: UtcInstant;
};

const SUPPORT_VIEW_TTL_MS = 15 * 60 * 1000;

export class OperationsControlPlane {
  readonly flags = OPERATIONS_CONTROL_FLAGS;
  readonly store: OperationsStore;
  readonly #clock: Clock;
  readonly #evidence: EvidenceVault;
  readonly #events: OperationsEventSink | null;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence: EvidenceVault;
    readonly events?: OperationsEventSink;
    readonly snapshot?: OperationsSnapshot;
  }) {
    this.#clock = input.clock;
    this.#evidence = input.evidence;
    this.#events = input.events ?? null;
    this.store = new OperationsStore();
    if (input.snapshot) {
      this.store.hydrate(input.snapshot);
    }
  }

  exportSnapshot(): OperationsSnapshot {
    return this.store.snapshot();
  }

  importSnapshot(snapshot: OperationsSnapshot): void {
    this.store.hydrate(snapshot);
  }

  createCase(input: {
    readonly operator: StaffOperator;
    readonly domain: OperationalCaseDomain;
    readonly type: string;
    readonly subject: string;
    readonly severity: OperationalSeverity;
    readonly source: OperationalSource;
    readonly reason: string;
    readonly references?: readonly OperationalReference[];
    readonly findings?: readonly OperationalFinding[];
  }): Result<OperationalCase, OperationsDenial> {
    const gated = this.#gate({
      operator: input.operator,
      action: 'CASE_CREATE',
      reason: input.reason,
      subjectRef: input.subject,
    });
    if (!gated.ok) return gated;
    if (!isOperationalCaseDomain(input.domain)) {
      return err({ code: 'UNKNOWN_DOMAIN', message: 'unknown operational case domain' });
    }
    if (!operatorMayAccessDomain(input.operator.capabilities, input.domain, 'write')) {
      return err({ code: 'ROLE_DENIED', message: 'role cannot open a case in this domain' });
    }
    const now = this.#clock.now();
    const opened = openOperationalCase({
      domain: input.domain,
      type: input.type,
      subject: input.subject,
      severity: input.severity,
      source: input.source,
      references: input.references,
      findings: input.findings,
      createdAt: now,
    });
    const withEvidence = addEvidence(opened.operational, gated.value.evidenceId, now);
    this.store.putCase(withEvidence);
    if (opened.specialized) {
      this.store.specialized.set(opened.specialized.caseId, opened.specialized);
    }
    this.#timeline('case', withEvidence.caseId, `case created ${input.domain}`, gated.value.evidenceId, now);
    this.#emit('OperationsCaseCreated', {
      caseId: withEvidence.caseId,
      domain: withEvidence.domain,
      operatorId: input.operator.operatorId,
      evidenceId: gated.value.evidenceId,
    }, now, gated.value.evidenceId);
    this.#recordAction(gated.value, withEvidence.caseId, input.subject, 'APPLIED');
    return ok(withEvidence);
  }

  assignCase(
    operator: StaffOperator,
    caseId: string,
    owner: string,
    reason: string,
  ): Result<OperationalCase, OperationsDenial> {
    const current = this.store.cases.get(caseId);
    if (!current) return err({ code: 'CASE_NOT_FOUND', message: 'case does not exist' });
    const gated = this.#gate({
      operator,
      action: 'CASE_ASSIGN',
      reason,
      caseId,
      priorActorId: current.investigatorId,
    });
    if (!gated.ok) return gated;
    const assigned = assignOperationalCase(current, owner, this.#clock.now());
    if (!assigned.ok) return err({ code: assigned.code, message: assigned.message });
    const withEvidence = addEvidence(assigned.case, gated.value.evidenceId, this.#clock.now());
    this.store.putCase(withEvidence);
    this.#timeline('case', caseId, `assigned to ${owner}`, gated.value.evidenceId, this.#clock.now());
    this.#emit('OperationsCaseAssigned', {
      caseId,
      owner,
      operatorId: operator.operatorId,
    }, this.#clock.now(), gated.value.evidenceId);
    this.#recordAction(gated.value, caseId, current.subject, 'APPLIED');
    return ok(withEvidence);
  }

  transitionCase(
    operator: StaffOperator,
    caseId: string,
    next: OperationalCaseState,
    reason: string,
  ): Result<OperationalCase, OperationsDenial> {
    const current = this.store.cases.get(caseId);
    if (!current) return err({ code: 'CASE_NOT_FOUND', message: 'case does not exist' });
    if (!isOperationalCaseState(next)) {
      return err({ code: 'INVALID_TRANSITION', message: 'unknown operational state' });
    }
    const action: PrivilegedStaffAction = next === 'ESCALATED' ? 'CASE_ESCALATE' : 'CASE_TRANSITION';
    const gated = this.#gate({
      operator,
      action,
      reason,
      caseId,
      priorActorId: current.investigatorId,
    });
    if (!gated.ok) return gated;
    const moved = transitionOperationalCase(current, next, this.#clock.now());
    if (!moved.ok) return err({ code: moved.code, message: moved.message });
    const withEvidence = addEvidence(moved.case, gated.value.evidenceId, this.#clock.now());
    this.store.putCase(withEvidence);
    this.#timeline('case', caseId, `status ${current.status} -> ${next}`, gated.value.evidenceId, this.#clock.now());
    if (next === 'ESCALATED') {
      this.#emit('OperationsCaseEscalated', {
        caseId,
        operatorId: operator.operatorId,
      }, this.#clock.now(), gated.value.evidenceId);
    }
    this.#recordAction(gated.value, caseId, current.subject, 'APPLIED');
    return ok(withEvidence);
  }

  addCaseNote(operator: StaffOperator, caseId: string, body: string, reason: string): Result<OperationalCase, OperationsDenial> {
    const current = this.store.cases.get(caseId);
    if (!current) return err({ code: 'CASE_NOT_FOUND', message: 'case does not exist' });
    const gated = this.#gate({ operator, action: 'CASE_NOTE', reason, caseId });
    if (!gated.ok) return gated;
    const now = this.#clock.now();
    const next = addNote(
      addEvidence(current, gated.value.evidenceId, now),
      { noteId: randomUUID(), authorId: operator.operatorId, body, createdAt: now, redacted: false },
      now,
    );
    this.store.putCase(next);
    this.#recordAction(gated.value, caseId, current.subject, 'APPLIED');
    return ok(next);
  }

  addCaseFinding(
    operator: StaffOperator,
    caseId: string,
    finding: OperationalFinding,
    reason: string,
  ): Result<OperationalCase, OperationsDenial> {
    const current = this.store.cases.get(caseId);
    if (!current) return err({ code: 'CASE_NOT_FOUND', message: 'case does not exist' });
    const gated = this.#gate({ operator, action: 'CASE_TRANSITION', reason, caseId });
    if (!gated.ok) return gated;
    const now = this.#clock.now();
    const next = addFinding(addEvidence(current, gated.value.evidenceId, now), finding, now);
    this.store.putCase(next);
    this.#recordAction(gated.value, caseId, current.subject, 'APPLIED');
    return ok(next);
  }

  resolveCase(
    operator: StaffOperator,
    caseId: string,
    reason: string,
    outcome: string,
    secondApprover?: StaffOperator,
  ): Result<OperationalCase, OperationsDenial> {
    const current = this.store.cases.get(caseId);
    if (!current) return err({ code: 'CASE_NOT_FOUND', message: 'case does not exist' });
    const gated = this.#gate({
      operator,
      action: current.status === 'ESCALATED' ? 'CASE_APPROVE' : 'CASE_RESOLVE',
      reason,
      caseId,
      priorActorId: current.investigatorId,
      secondApprover,
    });
    if (!gated.ok) return gated;
    const now = this.#clock.now();
    const resolved = resolveOperationalCase(
      current,
      {
        outcome,
        summary: reason,
        decidedBy: operator.operatorId,
        decidedAt: now,
        evidenceRefs: [gated.value.evidenceId],
      },
      now,
    );
    if (!resolved.ok) return err({ code: resolved.code, message: resolved.message });
    let next = addEvidence(resolved.case, gated.value.evidenceId, now);
    if (secondApprover) {
      next = addApproval(next, approvalOf(operator, secondApprover, 'CASE_RESOLVE', reason, now), now);
    }
    this.store.putCase(next);
    if (next.specializedCaseId) {
      const specialized = this.store.specialized.get(next.specializedCaseId);
      if (specialized) {
        const decided = decideCase(specialized, {
          decision: outcome === 'BLOCK' ? 'BLOCK' : 'CLEAR',
          operatorRef: operator.operatorId,
          actorKind: 'HUMAN_OPERATOR',
          reason,
          evidenceRefs: [gated.value.evidenceId],
          decidedAt: now,
        });
        if (decided.ok) {
          this.store.specialized.set(decided.case.caseId, decided.case);
          this.store.decisions.set(decided.decision.decisionId, decided.decision);
        }
      }
    }
    this.#timeline('resolution', caseId, `resolved ${outcome}`, gated.value.evidenceId, now);
    this.#emit('OperationsCaseResolved', {
      caseId,
      outcome,
      operatorId: operator.operatorId,
    }, now, gated.value.evidenceId);
    this.#recordAction(gated.value, caseId, current.subject, 'APPLIED');
    return ok(next);
  }

  privilegedAction(input: PrivilegedActionInput): Result<OperatorActionRecord, OperationsDenial> {
    if (input.action === 'CASE_CREATE' || input.action === 'CASE_ASSIGN' || input.action === 'CASE_TRANSITION') {
      return err({ code: 'USE_CASE_API', message: 'use the typed case methods for this action' });
    }
    const current = input.caseId ? this.store.cases.get(input.caseId) : null;
    const gated = this.#gate({
      operator: input.operator,
      action: input.action,
      reason: input.reason,
      caseId: input.caseId,
      subjectRef: input.subjectRef,
      priorActorId: current?.investigatorId ?? null,
      secondApprover: input.secondApprover,
    });
    if (!gated.ok) return gated;
    const now = input.now ?? this.#clock.now();
    if (input.action === 'PROVIDER_DISABLE' && input.subjectRef) {
      const provider = this.store.providers.get(input.subjectRef);
      if (provider) {
        this.store.providers.set(input.subjectRef, Object.freeze({ ...provider, killSwitch: true, updatedAt: now }));
      }
      this.#emit('OperationsProviderDisabled', {
        providerId: input.subjectRef,
        operatorId: input.operator.operatorId,
      }, now, gated.value.evidenceId);
    }
    if (input.action === 'MARKET_HALT' && input.subjectRef) {
      this.#emit('OperationsMarketHalted', {
        marketId: input.subjectRef,
        operatorId: input.operator.operatorId,
      }, now, gated.value.evidenceId);
    }
    if (input.action === 'ACCOUNT_RESTRICT' && input.subjectRef) {
      this.#emit('OperationsAccountRestricted', {
        accountId: input.subjectRef,
        operatorId: input.operator.operatorId,
      }, now, gated.value.evidenceId);
    }
    if (input.action === 'AGENT_PAUSE' && input.subjectRef) {
      const agent = this.store.agents.get(input.subjectRef);
      if (agent) {
        this.store.agents.set(input.subjectRef, Object.freeze({ ...agent, available: false, updatedAt: now }));
      }
    }
    if (input.action === 'BREAK_RECLASSIFY' && input.subjectRef) {
      const row = this.store.breaks.get(input.subjectRef);
      if (row) {
        this.store.breaks.set(
          input.subjectRef,
          Object.freeze({ ...row, status: 'INVESTIGATING', owner: input.operator.operatorId, updatedAt: now }),
        );
      }
    }
    this.#timeline('operator', input.subjectRef ?? input.caseId ?? input.operator.operatorId, input.action, gated.value.evidenceId, now);
    const recorded = this.#recordAction(gated.value, input.caseId ?? null, input.subjectRef ?? null, 'APPLIED');
    return ok(recorded);
  }

  openSupportView(
    operator: StaffOperator,
    customerId: string,
    reason: string,
    sensitive: boolean,
  ): Result<{ readonly session: SupportViewSession; readonly profile: SupportCustomerView }, OperationsDenial> {
    const gated = this.#gate({
      operator,
      action: sensitive ? 'SUPPORT_SENSITIVE_VIEW' : 'SUPPORT_VIEW_OPEN',
      reason,
      subjectRef: customerId,
    });
    if (!gated.ok) return gated;
    const now = this.#clock.now();
    const session: SupportViewSession = Object.freeze({
      sessionId: randomUUID(),
      operatorId: operator.operatorId,
      customerId,
      readLimited: true,
      audited: true,
      canApproveFinancialActions: false,
      expiresAt: addMs(now, SUPPORT_VIEW_TTL_MS),
      openedAt: now,
      evidenceId: gated.value.evidenceId,
    });
    this.store.supportSessions.set(session.sessionId, session);
    const seeded = this.store.supportProfiles.get(customerId);
    const profile = privacyFilter(
      seeded ?? {
        customerId,
        displayId: customerId,
        accountStatus: 'UNKNOWN',
        productStatus: Object.freeze([]),
        recentActivitySafe: Object.freeze([]),
        openCaseIds: Object.freeze(
          [...this.store.cases.values()].filter((row) => row.subject === customerId).map((row) => row.caseId),
        ),
        providerActionStatus: null,
        supportHistoryIds: Object.freeze([]),
        sensitiveKycVisible: false,
        balancesVisible: false,
      },
      sensitive,
    );
    this.#emit('OperationsSupportViewOpened', {
      customerId,
      operatorId: operator.operatorId,
      sensitive,
    }, now, gated.value.evidenceId);
    this.#recordAction(gated.value, null, customerId, 'APPLIED');
    return ok({ session, profile });
  }

  listCases(operator: StaffOperator): Result<readonly OperationalCase[], OperationsDenial> {
    if (!operatorMayReadSurface(operator.capabilities, 'cases')) {
      return err({ code: 'ROLE_DENIED', message: 'role cannot list operational cases' });
    }
    return ok(this.#visibleCases(operator, [...this.store.cases.values()]));
  }

  search(operator: StaffOperator, query: OperationsSearchQuery): Result<readonly OperationalCase[], OperationsDenial> {
    if (operator.roles.length === 0) {
      return err({ code: 'ROLE_DENIED', message: 'staff role is required' });
    }
    const keys = Object.values(query).filter((value) => typeof value === 'string' && value.length > 0);
    if (keys.length === 0) {
      return err({ code: 'SEARCH_UNRESTRICTED', message: 'arbitrary database search is not permitted' });
    }
    const matches = [...this.store.cases.values()].filter((row) => {
      if (query.caseId && row.caseId === query.caseId) return true;
      if (query.customerId && (row.subject === query.customerId || row.references.some((ref) => ref.kind === 'customer' && ref.id === query.customerId))) {
        return true;
      }
      if (query.paymentId && row.references.some((ref) => ref.kind === 'payment' && ref.id === query.paymentId)) return true;
      if (query.transactionId && row.references.some((ref) => ref.kind === 'transaction' && ref.id === query.transactionId)) {
        return true;
      }
      if (query.orderId && row.references.some((ref) => ref.kind === 'order' && ref.id === query.orderId)) return true;
      if (query.walletId && row.references.some((ref) => ref.kind === 'wallet' && ref.id === query.walletId)) return true;
      if (query.providerReference && row.references.some((ref) => ref.kind === 'provider' && ref.id === query.providerReference)) {
        return true;
      }
      if (query.correlationId && row.references.some((ref) => ref.kind === 'correlation' && ref.id === query.correlationId)) {
        return true;
      }
      return false;
    });
    return ok(this.#visibleCases(operator, matches));
  }

  authorizeRead(
    operator: StaffOperator,
    surface: OpsReadSurface,
  ): Result<true, OperationsDenial> {
    if (!operatorMayReadSurface(operator.capabilities, surface)) {
      return err({ code: 'ROLE_DENIED', message: `role cannot read ${surface} operations` });
    }
    return ok(true);
  }

  timeline(ref: string): readonly TimelineEntry[] {
    return Object.freeze(this.store.timeline.filter((row) => row.ref === ref || row.summary.includes(ref)));
  }

  paymentOps(): readonly PaymentOpsView[] {
    return Object.freeze([...this.store.payments.values()]);
  }

  treasuryOps(): readonly TreasuryOpsView[] {
    return Object.freeze([...this.store.treasury.values()]);
  }

  reconciliationOps(): readonly ReconciliationOpsView[] {
    return Object.freeze([...this.store.breaks.values()]);
  }

  surveillanceOps(): readonly SurveillanceOpsView[] {
    return Object.freeze([...this.store.surveillance.values()]);
  }

  custodyOps(): readonly CustodyOpsView[] {
    return Object.freeze(
      [...this.store.custody.values()].map((row) => Object.freeze({ ...row, privateKeyMaterial: null })),
    );
  }

  providerOps(): readonly ProviderOpsView[] {
    return Object.freeze(
      [...this.store.providers.values()].map((row) => Object.freeze({ ...row, rawCredential: null })),
    );
  }

  agentOps(): readonly AgentOpsView[] {
    return Object.freeze(
      [...this.store.agents.values()].map((row) => Object.freeze({ ...row, evidenceMutableByStaff: false as const })),
    );
  }

  securityOps(): readonly SecurityOpsView[] {
    return Object.freeze(
      [...this.store.security.values()].map((row) => Object.freeze({ ...row, rawSecret: null })),
    );
  }

  seedReadModels(input: Partial<OperationsSnapshot>): void {
    const current = this.store.snapshot();
    this.store.hydrate({
      ...EMPTY_OPERATIONS_SNAPSHOT,
      ...current,
      payments: input.payments ?? current.payments,
      treasury: input.treasury ?? current.treasury,
      breaks: input.breaks ?? current.breaks,
      surveillance: input.surveillance ?? current.surveillance,
      custody: input.custody ?? current.custody,
      providers: input.providers ?? current.providers,
      agents: input.agents ?? current.agents,
      security: input.security ?? current.security,
      supportProfiles: input.supportProfiles ?? current.supportProfiles,
    });
  }

  #visibleCases(operator: StaffOperator, cases: readonly OperationalCase[]): readonly OperationalCase[] {
    return Object.freeze(
      cases.filter((row) => operatorMayAccessDomain(operator.capabilities, row.domain, 'read')),
    );
  }

  refuseStaffLedgerWrite(): never {
    throw new Error('staff operations cannot post a ledger journal');
  }

  refuseStaffAuthorityIssue(): never {
    throw new Error('staff operations cannot issue Execution Authority');
  }

  refuseStaffCustodyKeyAccess(): never {
    throw new Error('staff operations cannot access custody private keys');
  }

  #gate(input: {
    readonly operator: StaffOperator;
    readonly action: PrivilegedStaffAction;
    readonly reason: string;
    readonly caseId?: string;
    readonly subjectRef?: string;
    readonly priorActorId?: string | null;
    readonly secondApprover?: StaffOperator;
  }): Result<OperatorActionRecord, OperationsDenial> {
    if (input.operator.principalKind !== 'STAFF') {
      return err({ code: 'UNAUTHENTICATED', message: 'staff principal is required' });
    }
    if (!input.reason || input.reason.trim().length < 3) {
      return err({ code: 'REASON_REQUIRED', message: 'operator reason is required' });
    }
    if (staffHoldsLedgerMutator(input.operator.capabilities) && input.operator.roles.includes('CUSTOMER_SUPPORT')) {
      return err({ code: 'LEDGER_MUTATION_FORBIDDEN', message: 'support cannot hold ledger mutation capability' });
    }
    if (staffHoldsCustodySigning(input.operator.capabilities) && input.operator.roles.includes('CUSTOMER_SUPPORT')) {
      return err({ code: 'CUSTODY_KEY_FORBIDDEN', message: 'support cannot hold custody signing authority' });
    }
    if (STEP_UP_ACTIONS.includes(input.action) && !input.operator.stepUpSatisfied) {
      if (!assuranceAtLeast(input.operator.assurance, 'STRONG')) {
        return err({ code: 'STEP_UP_REQUIRED', message: 'stronger authentication is required' });
      }
      return err({ code: 'STEP_UP_REQUIRED', message: 'step-up confirmation is required' });
    }
    const sod = evaluateSegregationOfDuties({
      roles: input.operator.roles,
      capabilities: input.operator.capabilities,
      action: input.action,
      actorId: input.operator.operatorId,
      priorActorId: input.priorActorId ?? null,
      secondApproverId: input.secondApprover?.operatorId ?? null,
      dualControlSatisfied: Boolean(input.secondApprover) || !DUAL_CONTROL_ACTIONS.includes(input.action),
      productionActivation: false,
    });
    if (!sod.ok) {
      return err({ code: sod.code, message: sod.message });
    }
    if (input.secondApprover) {
      const second = evaluateSegregationOfDuties({
        roles: input.secondApprover.roles,
        capabilities: input.secondApprover.capabilities,
        action: input.action === 'CASE_RESOLVE' ? 'CASE_APPROVE' : input.action,
        actorId: input.secondApprover.operatorId,
        priorActorId: input.operator.operatorId,
        secondApproverId: input.operator.operatorId,
        dualControlSatisfied: true,
        productionActivation: false,
      });
      if (!second.ok) {
        return err({ code: second.code, message: second.message });
      }
    }
    const now = this.#clock.now();
    const evidence = this.#evidence.seal('OPERATIONS_OPERATOR_ACTION', {
      operatorId: input.operator.operatorId,
      roles: input.operator.roles,
      action: input.action,
      reason: input.reason,
      caseId: input.caseId ?? null,
      subjectRef: input.subjectRef ?? null,
      sessionId: input.operator.sessionId,
      productionActive: false,
    });
    return ok(
      Object.freeze({
        actionId: randomUUID(),
        operatorId: input.operator.operatorId,
        roles: Object.freeze([...input.operator.roles]),
        action: input.action,
        reason: input.reason,
        caseId: input.caseId ?? null,
        subjectRef: input.subjectRef ?? null,
        stepUpSatisfied: input.operator.stepUpSatisfied,
        dualControlSatisfied: Boolean(input.secondApprover) || !DUAL_CONTROL_ACTIONS.includes(input.action),
        secondApproverId: input.secondApprover?.operatorId ?? null,
        evidenceId: evidence.evidenceId,
        eventType: 'OperationsOperatorAction',
        createdAt: now,
        outcome: 'APPLIED',
        denialCode: null,
      }),
    );
  }

  #recordAction(
    action: OperatorActionRecord,
    caseId: string | null,
    subjectRef: string | null,
    outcome: OperatorActionRecord['outcome'],
  ): OperatorActionRecord {
    const recorded = Object.freeze({
      ...action,
      caseId,
      subjectRef,
      outcome,
    });
    this.store.actions.set(recorded.actionId, recorded);
    this.#emit(
      'OperationsOperatorAction',
      {
        actionId: recorded.actionId,
        operatorId: recorded.operatorId,
        action: recorded.action,
        caseId,
        evidenceId: recorded.evidenceId,
      },
      recorded.createdAt,
      recorded.evidenceId,
    );
    return recorded;
  }

  #timeline(
    kind: TimelineEntry['kind'],
    ref: string,
    summary: string,
    evidenceId: string | null,
    at: UtcInstant,
  ): void {
    this.store.timeline.push(
      Object.freeze({
        at,
        kind,
        ref,
        summary,
        evidenceId,
      }),
    );
  }

  #emit(eventType: string, payload: Record<string, unknown>, occurredAt: UtcInstant, evidenceId: string): void {
    if (!this.#events) {
      return;
    }
    this.#events.record({
      eventType,
      payload: Object.freeze({ ...payload }),
      occurredAt,
      evidenceId,
    });
  }
}

function approvalOf(
  requester: StaffOperator,
  approver: StaffOperator,
  action: string,
  reason: string,
  now: UtcInstant,
): OperationalApproval {
  return Object.freeze({
    approvalId: randomUUID(),
    action,
    requesterId: requester.operatorId,
    approverId: approver.operatorId,
    status: 'APPROVED',
    reason,
    createdAt: now,
    decidedAt: now,
  });
}

function privacyFilter(profile: SupportCustomerView, sensitive: boolean): SupportCustomerView {
  if (sensitive) {
    return Object.freeze({ ...profile, sensitiveKycVisible: true, balancesVisible: false });
  }
  return Object.freeze({
    ...profile,
    sensitiveKycVisible: false,
    balancesVisible: false,
    recentActivitySafe: Object.freeze(profile.recentActivitySafe.slice(0, 5)),
  });
}
