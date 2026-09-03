/**
 * ACCESS-11 Access Fabric workflow engine.
 *
 * Canonical completion/evidence workflows for reserved access across
 * vehicle, hospitality, compute, energy, food, and generic services.
 *
 * Settlement and refund adjustments route through the settlement
 * proposal port (Kernel financial authority) — never direct ledger posts.
 */

import { FrozenClock } from '../../../config/src/clock.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import {
  deliveryClaimCommitment,
  grantCommitment,
  idempotencyCommitment,
  refundProposalCommitment,
  reservationCommitment,
  usageProofCommitment,
  workflowEventCommitment,
  disputeCommitment,
} from './commitments.ts';
import { createAccessChainAnchor, toChainIntentProjection, type PrivacySafeChainAnchor } from './chain-anchor.ts';
import {
  sealDeliveryClaimEvidence,
  sealDisputeEvidence,
  sealRefundProposalEvidence,
  sealUsageProofEvidence,
  sealWorkflowEvidence,
  sealCompletionSummary,
} from './evidence.ts';
import {
  ALLOWED_STATE_TRANSITIONS,
  HIGH_VALUE_MINOR_UNITS,
  ORACLE_REQUIRED_DOMAINS,
  evidenceQualityForSource,
  nextStatusAfterEvent,
} from './policy.ts';
import { buildProvenance, minimumQualityForContext, assertDeliveryClaimProvenance, assertUsageProofProvenance } from './provenance.ts';
import type { AccessFabricPorts } from './ports.ts';
import { developmentAccessPorts } from './ports.ts';
import {
  ACCESS_FABRIC_POLICY_VERSION,
  ACCESS_FABRIC_SCHEMA_VERSION,
  type AccessDispute,
  type AccessDisputeReason,
  type AccessGrantRecord,
  type AccessRejection,
  type AccessReservation,
  type AccessSession,
  type AccessWorkflowEvent,
  type AccessWorkflowRecord,
  type DeliveryClaim,
  type DeliveryClaimStatus,
  type EvidenceSourceClass,
  type RefundAdjustmentProposal,
  type UsageProof,
  type VerifiedAccessOracleFact,
} from './types.ts';

export type OpenAccessSessionInput = {
  readonly reservation: Omit<AccessReservation, 'schemaVersion' | 'policyVersion'>;
  readonly grant: Omit<AccessGrantRecord, 'schemaVersion' | 'policyVersion'>;
};

export type MeasureUsageInput = {
  readonly sessionId: string;
  readonly proofId: string;
  readonly measuredQuantity: bigint;
  readonly sourceClass: EvidenceSourceClass;
  readonly sourceSystem: string;
  readonly payloadDigest: string;
  readonly nonce: string;
  readonly oracleFactRefs?: readonly string[];
  readonly partial?: boolean;
  readonly settlementGrade?: boolean;
};

export type DeliverCapacityInput = {
  readonly sessionId: string;
  readonly claimId: string;
  readonly deliveredQuantity: bigint;
  readonly claimStatus: DeliveryClaimStatus;
  readonly sourceClass: EvidenceSourceClass;
  readonly sourceSystem: string;
  readonly payloadDigest: string;
  readonly nonce: string;
  readonly oracleFactRefs?: readonly string[];
  readonly settlementGrade?: boolean;
};

export type AccessWorkflowResult<T> = { readonly ok: true; readonly value: T } | AccessRejection;

function isRejection<T>(result: AccessWorkflowResult<T>): result is AccessRejection {
  return !result.ok;
}

export class AccessFabricEngine {
  readonly ports: AccessFabricPorts;
  private readonly vault: EvidenceVault;
  private clockMs: number;
  private seq = 0;
  private readonly sessions = new Map<string, AccessSession>();
  private readonly usageProofs = new Map<string, UsageProof>();
  private readonly deliveryClaims = new Map<string, DeliveryClaim>();
  private readonly workflowRecords = new Map<string, AccessWorkflowRecord>();
  private readonly disputes = new Map<string, AccessDispute>();
  private readonly proposals = new Map<string, RefundAdjustmentProposal>();
  private readonly usedNonces = new Set<string>();
  private readonly chainAnchors: PrivacySafeChainAnchor[] = [];
  private readonly chainIntents: ReturnType<typeof toChainIntentProjection>[] = [];

  constructor(
    ports: AccessFabricPorts = developmentAccessPorts(),
    clockMs = Date.parse('2026-08-29T00:00:00.000Z'),
  ) {
    this.ports = ports;
    this.vault = new EvidenceVault(
      new FrozenClock(new Date(clockMs).toISOString() as UtcInstant),
    );
    this.clockMs = clockMs;
  }

  get evidenceVault(): EvidenceVault {
    return this.vault;
  }

  listChainAnchors(): readonly PrivacySafeChainAnchor[] {
    return this.chainAnchors.slice();
  }

  listChainIntents(): readonly ReturnType<typeof toChainIntentProjection>[] {
    return this.chainIntents.slice();
  }

  openSession(input: OpenAccessSessionInput): AccessWorkflowResult<AccessSession> {
    const reservation: AccessReservation = Object.freeze({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      ...input.reservation,
    });
    const grant: AccessGrantRecord = Object.freeze({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      ...input.grant,
    });
    if (!grant.considerationRef) {
      return this.reject(null, 'CONSIDERATION_REFERENCE_REQUIRED', 'consideration reference is required');
    }
    if (this.ports.oracles.providerRevoked(reservation.providerRef)) {
      return this.reject(reservation.sessionId, 'PROVIDER_REVOKED', 'provider is revoked');
    }
    const session: AccessSession = Object.freeze({
      sessionId: reservation.sessionId,
      reservation,
      grant,
      status: 'RESERVED',
      providerRevoked: false,
      serviceStartedAtUtc: null,
      activatedAtUtc: null,
      completedAtUtc: null,
      cumulativeUsage: 0n,
      usageProofIds: Object.freeze([]),
      deliveryClaimIds: Object.freeze([]),
      workflowRecordIds: Object.freeze([]),
    });
    this.sessions.set(session.sessionId, session);
    this.vault.seal('ACCESS_FABRIC_RESERVATION', {
      reservationCommitment: reservationCommitment(reservation),
      grantCommitment: grantCommitment(grant),
    });
    return { ok: true, value: session };
  }

  serviceStarted(sessionId: string): AccessWorkflowResult<AccessWorkflowRecord> {
    return this.emitLifecycle(sessionId, 'SERVICE_STARTED', () => ({
      serviceStartedAtUtc: this.nowUtc(),
    }));
  }

  accessActivated(sessionId: string): AccessWorkflowResult<AccessWorkflowRecord> {
    return this.emitLifecycle(sessionId, 'ACCESS_ACTIVATED', () => ({
      activatedAtUtc: this.nowUtc(),
    }));
  }

  measureUsage(input: MeasureUsageInput): AccessWorkflowResult<UsageProof> {
    const session = this.requireSession(input.sessionId);
    if (!session.ok) {
      return session;
    }
    const nonceRejection = this.guardNonce(input.nonce, input.sessionId);
    if (nonceRejection) {
      return nonceRejection;
    }
    const transition = this.guardTransition(session.value, input.partial ? 'PARTIAL_USAGE' : 'USAGE_MEASURED');
    if (!transition.ok) {
      return transition;
    }
    const minimum = minimumQualityForContext({
      serviceDomain: session.value.reservation.serviceDomain,
      considerationMinorUnits: session.value.grant.considerationMinorUnits,
      settlementGrade: input.settlementGrade ?? false,
    });
    const provenance = buildProvenance({
      sourceSystem: input.sourceSystem,
      sourceClass: input.sourceClass,
      ...(input.oracleFactRefs !== undefined ? { oracleFactRefs: input.oracleFactRefs } : {}),
      observedAtUtc: this.nowUtc(),
      payloadDigest: input.payloadDigest,
    });
    const proof: UsageProof = Object.freeze({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      proofId: input.proofId,
      sessionId: input.sessionId,
      measuredQuantity: input.measuredQuantity,
      unit: session.value.reservation.unit,
      measuredAtUtc: this.nowUtc(),
      evidenceQuality: evidenceQualityForSource(input.sourceClass),
      provenance,
      nonce: input.nonce,
      finalized: true,
    });
    const meterRejection = this.guardMeterConsistency(input.sessionId, input.measuredQuantity, session.value);
    if (meterRejection) {
      return meterRejection;
    }
    const provenanceRejection = assertUsageProofProvenance(proof, minimum, input.sessionId);
    if (provenanceRejection) {
      return provenanceRejection;
    }
    this.usageProofs.set(proof.proofId, proof);
    sealUsageProofEvidence(this.vault, proof);
    const event = input.partial ? 'PARTIAL_USAGE' : 'USAGE_MEASURED';
    const workflow = this.recordWorkflow(session.value, event, {
      usageProofId: proof.proofId,
      usageProofCommitment: usageProofCommitment(proof),
    });
    if (!workflow.ok) {
      return workflow;
    }
    const cumulative = session.value.cumulativeUsage + input.measuredQuantity;
    this.sessions.set(
      input.sessionId,
      Object.freeze({
        ...session.value,
        status: nextStatusAfterEvent(event, session.value.status) ?? session.value.status,
        cumulativeUsage: cumulative,
        usageProofIds: Object.freeze([...session.value.usageProofIds, proof.proofId]),
        workflowRecordIds: Object.freeze([...session.value.workflowRecordIds, workflow.value.recordId]),
      }),
    );
    return { ok: true, value: proof };
  }

  deliverCapacity(input: DeliverCapacityInput): AccessWorkflowResult<DeliveryClaim> {
    const session = this.requireSession(input.sessionId);
    if (!session.ok) {
      return session;
    }
    const nonceRejection = this.guardNonce(input.nonce, input.sessionId);
    if (nonceRejection) {
      return nonceRejection;
    }
    const event: AccessWorkflowEvent =
      input.claimStatus === 'NOT_DELIVERED' || input.claimStatus === 'FAILED'
        ? 'CAPACITY_NOT_DELIVERED'
        : 'CAPACITY_DELIVERED';
    const transition = this.guardTransition(session.value, event);
    if (!transition.ok) {
      return transition;
    }
    if (input.deliveredQuantity > session.value.reservation.reservedQuantity) {
      return this.reject(input.sessionId, 'DELIVERY_EXCEEDS_RESERVATION', 'delivered quantity exceeds reservation');
    }
    const minimum = minimumQualityForContext({
      serviceDomain: session.value.reservation.serviceDomain,
      considerationMinorUnits: session.value.grant.considerationMinorUnits,
      settlementGrade: input.settlementGrade ?? true,
    });
    const provenance = buildProvenance({
      sourceSystem: input.sourceSystem,
      sourceClass: input.sourceClass,
      ...(input.oracleFactRefs !== undefined ? { oracleFactRefs: input.oracleFactRefs } : {}),
      observedAtUtc: this.nowUtc(),
      payloadDigest: input.payloadDigest,
    });
    const claim: DeliveryClaim = Object.freeze({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      claimId: input.claimId,
      sessionId: input.sessionId,
      deliveredQuantity: input.deliveredQuantity,
      reservedQuantity: session.value.reservation.reservedQuantity,
      unit: session.value.reservation.unit,
      claimStatus: input.claimStatus,
      claimedAtUtc: this.nowUtc(),
      evidenceQuality: evidenceQualityForSource(input.sourceClass),
      provenance,
      nonce: input.nonce,
    });
    const provenanceRejection = assertDeliveryClaimProvenance(claim, minimum, input.sessionId);
    if (provenanceRejection) {
      return provenanceRejection;
    }
    this.deliveryClaims.set(claim.claimId, claim);
    sealDeliveryClaimEvidence(this.vault, claim);
    const workflow = this.recordWorkflow(session.value, event, {
      deliveryClaimId: claim.claimId,
      deliveryClaimCommitment: deliveryClaimCommitment(claim),
    });
    if (!workflow.ok) {
      return workflow;
    }
    this.sessions.set(
      input.sessionId,
      Object.freeze({
        ...session.value,
        status: nextStatusAfterEvent(event, session.value.status) ?? session.value.status,
        deliveryClaimIds: Object.freeze([...session.value.deliveryClaimIds, claim.claimId]),
        workflowRecordIds: Object.freeze([...session.value.workflowRecordIds, workflow.value.recordId]),
      }),
    );
    return { ok: true, value: claim };
  }

  serviceCompleted(sessionId: string): AccessWorkflowResult<AccessWorkflowRecord> {
    const session = this.requireSession(sessionId);
    if (!session.ok) {
      return session;
    }
    const result = this.emitLifecycle(sessionId, 'SERVICE_COMPLETED', () => ({
      completedAtUtc: this.nowUtc(),
    }));
    if (result.ok) {
      const current = this.sessions.get(sessionId)!;
      sealCompletionSummary(this.vault, current);
    }
    return result;
  }

  returnCompleted(sessionId: string): AccessWorkflowResult<AccessWorkflowRecord> {
    return this.emitLifecycle(sessionId, 'RETURN_COMPLETED', () => ({
      completedAtUtc: this.nowUtc(),
    }));
  }

  recordOverage(input: {
    readonly sessionId: string;
    readonly overageQuantity: bigint;
    readonly proofId: string;
    readonly sourceClass: EvidenceSourceClass;
    readonly sourceSystem: string;
    readonly payloadDigest: string;
    readonly nonce: string;
    readonly oracleFactRefs?: readonly string[];
  }): AccessWorkflowResult<AccessWorkflowRecord> {
    const measured = this.measureUsage({
      ...input,
      measuredQuantity: input.overageQuantity,
      partial: true,
      settlementGrade: true,
    });
    if (!measured.ok) {
      return measured;
    }
    return this.emitLifecycle(input.sessionId, 'OVERAGE');
  }

  earlyTermination(sessionId: string, reason: string): AccessWorkflowResult<AccessWorkflowRecord> {
    const session = this.requireSession(sessionId);
    if (!session.ok) {
      return session;
    }
    const result = this.emitLifecycle(sessionId, 'EARLY_TERMINATION');
    if (result.ok) {
      this.vault.seal('ACCESS_FABRIC_EARLY_TERMINATION', { sessionId, reason });
    }
    return result;
  }

  openDispute(input: {
    readonly sessionId: string;
    readonly disputeId: string;
    readonly reason: AccessDisputeReason;
    readonly openedBy: string;
  }): AccessWorkflowResult<AccessDispute> {
    const session = this.requireSession(input.sessionId);
    if (!session.ok) {
      return session;
    }
    const transition = this.guardTransition(session.value, 'DISPUTE');
    if (!transition.ok) {
      return transition;
    }
    const existing = [...this.disputes.values()].find(
      (row) => row.sessionId === input.sessionId && row.status === 'OPEN',
    );
    if (existing) {
      return this.reject(input.sessionId, 'DISPUTE_ALREADY_OPEN', 'an open dispute already exists for this session');
    }
    const commitment = disputeCommitment({
      disputeId: input.disputeId,
      sessionId: input.sessionId,
      reason: input.reason,
      openedAtUtc: this.nowUtc(),
    });
    const evidenceVaultRef = sealDisputeEvidence(this.vault, {
      disputeId: input.disputeId,
      sessionId: input.sessionId,
      reason: input.reason,
      openedBy: input.openedBy,
    });
    const anchor = createAccessChainAnchor({
      event: 'DISPUTE',
      payloadCommitment: commitment,
      subjectRef: session.value.reservation.subjectRef,
      sessionId: input.sessionId,
    });
    this.chainAnchors.push(anchor);
    this.chainIntents.push(toChainIntentProjection(anchor));
    const dispute: AccessDispute = Object.freeze({
      disputeId: input.disputeId,
      sessionId: input.sessionId,
      reason: input.reason,
      openedAtUtc: this.nowUtc(),
      openedBy: input.openedBy,
      evidenceVaultRef,
      chainCommitment: commitment,
      status: 'OPEN',
    });
    this.disputes.set(dispute.disputeId, dispute);
    const workflow = this.recordWorkflow(session.value, 'DISPUTE', { chainCommitment: commitment });
    if (!workflow.ok) {
      return workflow;
    }
    this.sessions.set(
      input.sessionId,
      Object.freeze({
        ...session.value,
        status: 'DISPUTED',
        workflowRecordIds: Object.freeze([...session.value.workflowRecordIds, workflow.value.recordId]),
      }),
    );
    return { ok: true, value: dispute };
  }

  proposeRefundAdjustment(input: {
    readonly sessionId: string;
    readonly proposalId: string;
    readonly adjustmentMinorUnits: bigint;
    readonly reason: string;
    readonly disputeId?: string | null;
  }): AccessWorkflowResult<RefundAdjustmentProposal> {
    const session = this.requireSession(input.sessionId);
    if (!session.ok) {
      return session;
    }
    const transition = this.guardTransition(session.value, 'REFUND_ADJUSTMENT_PROPOSAL');
    if (!transition.ok) {
      return transition;
    }
    const commitment = refundProposalCommitment({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      proposalId: input.proposalId,
      sessionId: input.sessionId,
      disputeId: input.disputeId ?? null,
      adjustmentMinorUnits: input.adjustmentMinorUnits,
      currency: session.value.grant.considerationCurrency,
      reason: input.reason,
      proposedAtUtc: this.nowUtc(),
      considerationRef: session.value.grant.considerationRef,
      requiresKernelReview: true,
      routedToFinancialAuthority: true,
      evidenceVaultRef: '',
      chainCommitment: '',
    });
    const evidenceVaultRef = sealRefundProposalEvidence(this.vault, {
      proposalId: input.proposalId,
      sessionId: input.sessionId,
      adjustmentMinorUnits: input.adjustmentMinorUnits.toString(),
      reason: input.reason,
    });
    const proposal: RefundAdjustmentProposal = Object.freeze({
      schemaVersion: ACCESS_FABRIC_SCHEMA_VERSION,
      policyVersion: ACCESS_FABRIC_POLICY_VERSION,
      proposalId: input.proposalId,
      sessionId: input.sessionId,
      disputeId: input.disputeId ?? null,
      adjustmentMinorUnits: input.adjustmentMinorUnits,
      currency: session.value.grant.considerationCurrency,
      reason: input.reason,
      proposedAtUtc: this.nowUtc(),
      considerationRef: session.value.grant.considerationRef,
      requiresKernelReview: true,
      routedToFinancialAuthority: true,
      evidenceVaultRef,
      chainCommitment: commitment,
    });
    const route = this.ports.settlement.routeRefundAdjustment(proposal);
    if (!route.routed || route.directLedgerPost) {
      return this.reject(input.sessionId, 'SETTLEMENT_NOT_ROUTED', 'refund adjustment must route through financial authority');
    }
    const anchor = createAccessChainAnchor({
      event: 'REFUND_ADJUSTMENT_PROPOSAL',
      payloadCommitment: commitment,
      subjectRef: session.value.reservation.subjectRef,
      sessionId: input.sessionId,
    });
    this.chainAnchors.push(anchor);
    this.chainIntents.push(toChainIntentProjection(anchor));
    this.proposals.set(proposal.proposalId, proposal);
    const workflow = this.recordWorkflow(session.value, 'REFUND_ADJUSTMENT_PROPOSAL', { chainCommitment: commitment });
    if (!workflow.ok) {
      return workflow;
    }
    this.sessions.set(
      input.sessionId,
      Object.freeze({
        ...session.value,
        workflowRecordIds: Object.freeze([...session.value.workflowRecordIds, workflow.value.recordId]),
      }),
    );
    return { ok: true, value: proposal };
  }

  recordOracleFact(fact: VerifiedAccessOracleFact): void {
    this.ports.oracles.record(fact);
  }

  getSession(sessionId: string): AccessSession | undefined {
    return this.sessions.get(sessionId);
  }

  private emitLifecycle(
    sessionId: string,
    event: AccessWorkflowEvent,
    patch?: () => Partial<AccessSession>,
  ): AccessWorkflowResult<AccessWorkflowRecord> {
    const session = this.requireSession(sessionId);
    if (!session.ok) {
      return session;
    }
    const transition = this.guardTransition(session.value, event);
    if (!transition.ok) {
      return transition;
    }
    const workflow = this.recordWorkflow(session.value, event);
    if (!workflow.ok) {
      return workflow;
    }
    const nextStatus = nextStatusAfterEvent(event, session.value.status);
    this.sessions.set(
      sessionId,
      Object.freeze({
        ...session.value,
        ...patch?.(),
        status: nextStatus ?? session.value.status,
        workflowRecordIds: Object.freeze([...session.value.workflowRecordIds, workflow.value.recordId]),
      }),
    );
    return workflow;
  }

  private recordWorkflow(
    session: AccessSession,
    event: AccessWorkflowEvent,
    refs?: {
      readonly usageProofId?: string | null;
      readonly deliveryClaimId?: string | null;
      readonly usageProofCommitment?: string | null;
      readonly deliveryClaimCommitment?: string | null;
      readonly chainCommitment?: string | null;
    },
  ): AccessWorkflowResult<AccessWorkflowRecord> {
    const recordId = `access_wf_${++this.seq}`;
    const commitment =
      refs?.chainCommitment ??
      workflowEventCommitment({
        event,
        sessionId: session.sessionId,
        recordId,
        occurredAtUtc: this.nowUtc(),
        usageProofCommitment: refs?.usageProofCommitment ?? null,
        deliveryClaimCommitment: refs?.deliveryClaimCommitment ?? null,
      });
    const evidenceVaultRef = sealWorkflowEvidence(this.vault, {
      event,
      sessionId: session.sessionId,
      recordId,
      chainCommitment: commitment,
      usageProofId: refs?.usageProofId ?? null,
      deliveryClaimId: refs?.deliveryClaimId ?? null,
    });
    const anchor = createAccessChainAnchor({
      event,
      payloadCommitment: commitment,
      subjectRef: session.reservation.subjectRef,
      sessionId: session.sessionId,
    });
    this.chainAnchors.push(anchor);
    this.chainIntents.push(toChainIntentProjection(anchor));
    const record: AccessWorkflowRecord = Object.freeze({
      recordId,
      sessionId: session.sessionId,
      event,
      occurredAtUtc: this.nowUtc(),
      evidenceVaultRef,
      chainCommitment: commitment,
      usageProofId: refs?.usageProofId ?? null,
      deliveryClaimId: refs?.deliveryClaimId ?? null,
    });
    this.workflowRecords.set(recordId, record);
    return { ok: true, value: record };
  }

  private guardTransition(session: AccessSession, event: AccessWorkflowEvent): AccessWorkflowResult<true> {
    if (session.providerRevoked || this.ports.oracles.providerRevoked(session.reservation.providerRef)) {
      return this.reject(session.sessionId, 'PROVIDER_REVOKED', 'provider is revoked');
    }
    if (this.ports.oracles.hasConflict(session.sessionId)) {
      return this.reject(session.sessionId, 'ORACLE_CONFLICT', 'oracle conflict blocks workflow progression');
    }
    const allowed = ALLOWED_STATE_TRANSITIONS[event];
    if (!allowed.includes(session.status)) {
      return this.reject(
        session.sessionId,
        'INVALID_STATE_TRANSITION',
        `${event} is not allowed from status ${session.status}`,
      );
    }
    return { ok: true, value: true };
  }

  private guardNonce(nonce: string, sessionId: string): AccessRejection | null {
    const key = idempotencyCommitment(nonce, sessionId);
    if (this.usedNonces.has(key)) {
      return this.reject(sessionId, 'PROOF_REPLAY', 'proof nonce has already been used',);
    }
    this.usedNonces.add(key);
    return null;
  }

  private guardMeterConsistency(
    sessionId: string,
    measuredQuantity: bigint,
    session: AccessSession,
  ): AccessRejection | null {
    const facts = this.ports.oracles.factsFor(sessionId).filter((fact) => fact.finalized && !fact.conflicted);
    if (facts.length === 0) {
      return null;
    }
    const oracleTotal = facts
      .filter((fact) => fact.source === 'ORACLE_NETWORK')
      .reduce((sum, fact) => sum + fact.quantity, 0n);
    const selfTotal = facts
      .filter((fact) => fact.source === 'PROVIDER_SELF_REPORT')
      .reduce((sum, fact) => sum + fact.quantity, 0n);
    if (oracleTotal > 0n && selfTotal > 0n && oracleTotal !== selfTotal && measuredQuantity === selfTotal) {
      return this.reject(sessionId, 'METER_INCONSISTENT', 'provider meter disagrees with independent oracle facts');
    }
    if (measuredQuantity + session.cumulativeUsage > session.reservation.reservedQuantity * 2n) {
      return this.reject(sessionId, 'METER_INCONSISTENT', 'cumulative usage exceeds plausible bound');
    }
    return null;
  }

  private requireSession(sessionId: string): AccessWorkflowResult<AccessSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.reject(sessionId, 'SESSION_NOT_FOUND', 'access session not found');
    }
    return { ok: true, value: session };
  }

  private reject(sessionId: string | null, code: AccessRejection['code'], message: string): AccessRejection {
    return Object.freeze({ ok: false, code, message, sessionId });
  }

  private nowUtc(): string {
    return new Date(this.clockMs).toISOString();
  }
}

export function isAccessRejection<T>(result: AccessWorkflowResult<T>): result is AccessRejection {
  return isRejection(result);
}

export { ORACLE_REQUIRED_DOMAINS, HIGH_VALUE_MINOR_UNITS };
