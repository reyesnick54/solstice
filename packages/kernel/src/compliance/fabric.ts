import type { Clock } from '../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthenticationAssurance } from '../../../identity/src/assurance.ts';
import { evaluateAmlProfile, type AmlProfileInput, type AmlRiskProfile } from './aml.ts';
import {
  assignCase,
  decideCase,
  openComplianceCase,
  type CaseDecisionResult,
  type ComplianceCase,
  type HumanDecision,
} from './cases.ts';
import { upsertCounterparty, type CounterpartyFact } from './counterparty.ts';
import type { ComplianceFacts } from './facts.ts';
import { evaluateFraud, type FraudEvaluation, type FraudEvaluationInput } from './fraud.ts';
import { snapshotMetrics, type ComplianceMetrics } from './metrics.ts';
import { evaluateTransactionMonitoring, type MonitoringAlert, type MonitoringEvent } from './monitoring.ts';
import type { ComplianceProviderPorts } from './ports.ts';
import { performScreening, rejectIfStale } from './screening.ts';
import { createSimulationProviders } from './simulation.ts';
import { ComplianceStore, type ComplianceSnapshot } from './store.ts';
import type {
  CaseType,
  ComplianceActorKind,
  HumanDecisionKind,
  ScreeningRequirements,
  ScreeningType,
  SubjectKind,
} from './types.ts';
import { DEFAULT_SIMULATION_SCREENING_REQUIREMENTS } from './types.ts';
import { VelocityEngine } from './velocity.ts';

export type ComplianceEventRecord = {
  readonly eventType:
    | 'ComplianceScreeningCompleted'
    | 'ComplianceScreeningReviewRequired'
    | 'ComplianceCaseOpened'
    | 'ComplianceCaseDecided'
    | 'ComplianceAlertCreated'
    | 'FraudRiskEvaluated';
  readonly schemaVersion: 1;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, string | null | readonly string[]>>;
};

export type ComplianceEventSink = {
  record(event: ComplianceEventRecord): void;
};

export type ComplianceFabricOptions = {
  readonly clock: Clock;
  readonly evidence?: EvidenceVault;
  readonly ports?: ComplianceProviderPorts;
  readonly store?: ComplianceStore;
  readonly events?: ComplianceEventSink;
  readonly requirements?: ScreeningRequirements;
};

export type CollectFactsInput = {
  readonly subjectRef: string;
  readonly subjectKind?: SubjectKind;
  readonly jurisdiction: string;
  readonly customerType?: 'PERSON' | 'BUSINESS';
  readonly kycState?: string;
  readonly accountAgeDays?: number;
  readonly productExposure?: readonly string[];
  readonly actorId?: string;
  readonly sessionAssurance?: AuthenticationAssurance | null;
  readonly deviceTrust?: FraudEvaluationInput['deviceTrust'];
  readonly amountMinor?: bigint | null;
  readonly destinationRisk?: 'LOW' | 'STANDARD' | 'HIGH';
  readonly identityUsable?: boolean;
  readonly counterpartyRef?: string;
  readonly policyVersionId?: string;
  readonly forceRefresh?: boolean;
};

/**
 * Canonical compliance screening and monitoring fabric.
 * Does not issue Execution Authority. Does not connect live providers.
 */
export class ComplianceFabric {
  readonly store: ComplianceStore;
  readonly velocity: VelocityEngine;
  private readonly clock: Clock;
  private readonly evidence: EvidenceVault | undefined;
  private readonly ports: ComplianceProviderPorts;
  private readonly events: ComplianceEventSink | undefined;
  private readonly requirements: ScreeningRequirements;
  private lastLatencyMs = 0;

  constructor(options: ComplianceFabricOptions) {
    this.clock = options.clock;
    this.evidence = options.evidence;
    this.ports = options.ports ?? createSimulationProviders();
    this.store = options.store ?? new ComplianceStore();
    this.events = options.events;
    this.requirements = options.requirements ?? DEFAULT_SIMULATION_SCREENING_REQUIREMENTS;
    this.velocity = new VelocityEngine(this.store.velocity);
  }

  hydrate(snapshot: ComplianceSnapshot): void {
    this.store.hydrate(snapshot);
  }

  screen(input: {
    readonly type: ScreeningType;
    readonly subjectRef: string;
    readonly subjectKind?: SubjectKind;
    readonly jurisdiction: string;
    readonly policyVersionId?: string;
    readonly forceRefresh?: boolean;
  }) {
    const started = Date.now();
    const now = this.clock.now();
    const result = performScreening(this.store, this.ports, {
      type: input.type,
      subjectKind: input.subjectKind ?? 'PERSON',
      subjectRef: input.subjectRef,
      jurisdiction: input.jurisdiction,
      now,
      requirements: this.requirements,
      ...(input.forceRefresh ? { forceRefresh: true } : {}),
      ...(input.policyVersionId ? { policyVersionId: input.policyVersionId } : {}),
    });
    this.lastLatencyMs = Date.now() - started;
    this.emit('ComplianceScreeningCompleted', now, {
      screeningId: result.screeningId,
      screeningType: result.screeningType,
      outcome: result.outcome,
      subjectRef: result.subjectRef,
      providerRef: result.providerRef,
      providerHash: result.providerHash,
      policyVersionId: result.policyVersionId,
      reasonCodes: result.reasonCodes,
      jurisdiction: result.jurisdiction,
    });
    if (result.outcome === 'REVIEW' || result.outcome === 'HOLD' || result.outcome === 'BLOCK') {
      this.emit('ComplianceScreeningReviewRequired', now, {
        screeningId: result.screeningId,
        screeningType: result.screeningType,
        outcome: result.outcome,
        subjectRef: result.subjectRef,
        reasonCodes: result.reasonCodes,
      });
      this.openFromScreening(result);
    }
    this.seal('COMPLIANCE_SCREENING', {
      screeningId: result.screeningId,
      providerHash: result.providerHash,
      outcome: result.outcome,
      reasonCodes: result.reasonCodes,
      policyVersionId: result.policyVersionId,
    });
    return result;
  }

  profileAml(input: Omit<AmlProfileInput, 'now'>): AmlRiskProfile {
    const previous = this.store.latestProfile(input.subjectRef);
    const profile = evaluateAmlProfile({ ...input, now: this.clock.now() }, previous?.version ?? 0);
    const list = this.store.profiles.get(input.subjectRef) ?? [];
    list.push(profile);
    this.store.profiles.set(input.subjectRef, list);
    return profile;
  }

  monitor(event: MonitoringEvent): readonly MonitoringAlert[] {
    const hour = this.velocity.increment({
      subjectRef: event.subjectRef,
      metric: 'TRANSFERS',
      windowMs: 60 * 60 * 1000,
      now: event.now,
      amountMinor: event.amountMinor,
    });
    const alerts = evaluateTransactionMonitoring(event, hour.count, BigInt(hour.amountMinor));
    for (const alert of alerts) {
      this.store.alerts.set(alert.alertId, alert);
      this.emit('ComplianceAlertCreated', event.now, {
        alertId: alert.alertId,
        outcome: alert.outcome,
        subjectRef: alert.subjectRef,
        reasonCodes: alert.reasonCodes,
      });
      const opened = openComplianceCase({
        caseType: 'TRANSACTION_MONITORING_ALERT',
        reasonCodes: alert.reasonCodes,
        originRefs: [alert.alertId],
        subjectRef: event.subjectRef,
        jurisdiction: 'GB',
        createdAt: event.now,
      });
      this.store.cases.set(opened.caseId, opened);
      this.emit('ComplianceCaseOpened', event.now, {
        caseId: opened.caseId,
        caseType: opened.caseType,
        subjectRef: opened.subjectRef,
        reasonCodes: opened.reasonCodes,
      });
    }
    return alerts;
  }

  evaluateFraudRisk(input: Omit<FraudEvaluationInput, 'now'>): FraudEvaluation {
    const now = this.clock.now();
    const evaluation = evaluateFraud({ ...input, now });
    this.store.fraud.set(evaluation.evaluationId, evaluation);
    this.emit('FraudRiskEvaluated', now, {
      evaluationId: evaluation.evaluationId,
      outcome: evaluation.outcome,
      subjectRef: evaluation.subjectRef,
      reasonCodes: evaluation.reasonCodes,
    });
    if (evaluation.outcome === 'REVIEW' || evaluation.outcome === 'HOLD' || evaluation.outcome === 'BLOCK') {
      const opened = openComplianceCase({
        caseType: 'FRAUD_ALERT',
        reasonCodes: evaluation.reasonCodes,
        originRefs: [evaluation.evaluationId],
        subjectRef: input.subjectRef,
        jurisdiction: 'GB',
        createdAt: now,
        hardBlock: evaluation.outcome === 'BLOCK',
      });
      this.store.cases.set(opened.caseId, opened);
    }
    this.seal('FRAUD_EVALUATION', {
      evaluationId: evaluation.evaluationId,
      outcome: evaluation.outcome,
      reasonCodes: evaluation.reasonCodes,
    });
    return evaluation;
  }

  rememberCounterparty(input: {
    readonly counterpartyRef: string;
    readonly kind: CounterpartyFact['kind'];
    readonly jurisdiction?: string;
    readonly sanctionsId?: string;
    readonly pepId?: string;
  }): CounterpartyFact {
    const next = upsertCounterparty(this.store.counterparties.get(input.counterpartyRef), {
      ...input,
      now: this.clock.now(),
    });
    this.store.counterparties.set(next.counterpartyRef, next);
    return next;
  }

  assign(caseId: string, ownerRef: string): ComplianceCase | undefined {
    const current = this.store.cases.get(caseId);
    if (!current) {
      return undefined;
    }
    const next = assignCase(current, ownerRef);
    this.store.cases.set(caseId, next);
    return next;
  }

  decide(input: {
    readonly caseId: string;
    readonly decision: HumanDecisionKind;
    readonly operatorRef: string;
    readonly actorKind: ComplianceActorKind;
    readonly reason: string;
    readonly evidenceRefs?: readonly string[];
  }): CaseDecisionResult {
    const current = this.store.cases.get(input.caseId);
    if (!current) {
      return { ok: false, reasonCode: 'CASE_NOT_FOUND' };
    }
    const result = decideCase(current, {
      decision: input.decision,
      operatorRef: input.operatorRef,
      actorKind: input.actorKind,
      reason: input.reason,
      evidenceRefs: input.evidenceRefs ?? [],
      decidedAt: this.clock.now(),
    });
    if (!result.ok) {
      return result;
    }
    this.store.cases.set(result.case.caseId, result.case);
    this.store.decisions.set(result.decision.decisionId, result.decision);
    this.emit('ComplianceCaseDecided', result.decision.decidedAt, {
      caseId: result.case.caseId,
      decision: result.decision.decision,
      reasonCodes: result.case.reasonCodes,
    });
    this.seal('COMPLIANCE_CASE_DECISION', {
      caseId: result.case.caseId,
      decisionId: result.decision.decisionId,
      decision: result.decision.decision,
      operatorRef: result.decision.operatorRef,
      reason: result.decision.reason,
    });
    return result;
  }

  collectFacts(input: CollectFactsInput): ComplianceFacts {
    const kind = input.subjectKind ?? 'PERSON';
    const sanctions = this.screen({
      type: 'SANCTIONS',
      subjectRef: input.subjectRef,
      subjectKind: kind,
      jurisdiction: input.jurisdiction,
      ...(input.forceRefresh ? { forceRefresh: true } : {}),
      ...(input.policyVersionId ? { policyVersionId: input.policyVersionId } : {}),
    });
    const pep = this.screen({
      type: 'PEP',
      subjectRef: input.subjectRef,
      subjectKind: kind,
      jurisdiction: input.jurisdiction,
      ...(input.forceRefresh ? { forceRefresh: true } : {}),
      ...(input.policyVersionId ? { policyVersionId: input.policyVersionId } : {}),
    });
    const media = this.screen({
      type: 'ADVERSE_MEDIA',
      subjectRef: input.subjectRef,
      subjectKind: kind,
      jurisdiction: input.jurisdiction,
      ...(input.forceRefresh ? { forceRefresh: true } : {}),
      ...(input.policyVersionId ? { policyVersionId: input.policyVersionId } : {}),
    });
    const now = this.clock.now();
    const sanctionsFresh = !rejectIfStale(sanctions, now).reasonCodes.includes('SCREENING_STALE') &&
      sanctions.outcome !== 'UNAVAILABLE';
    const pepFresh = !rejectIfStale(pep, now).reasonCodes.includes('SCREENING_STALE') &&
      pep.outcome !== 'UNAVAILABLE';
    const mediaFresh = !rejectIfStale(media, now).reasonCodes.includes('SCREENING_STALE') &&
      media.outcome !== 'UNAVAILABLE';
    const profile = this.profileAml({
      subjectRef: input.subjectRef,
      jurisdiction: input.jurisdiction,
      customerType: input.customerType ?? 'PERSON',
      kycState: input.kycState ?? 'VERIFIED',
      accountAgeDays: input.accountAgeDays ?? 30,
      productExposure: input.productExposure ?? [],
      sanctionsOutcome: sanctions.outcome,
      pepOutcome: pep.outcome,
      knownRiskFactor: false,
    });
    const hour = this.velocity.read(input.subjectRef, 'TRANSFERS', 60 * 60 * 1000);
    const velocityTriggered = (hour?.count ?? 0) > 5;
    const fraud = this.evaluateFraudRisk({
      subjectRef: input.subjectRef,
      actorId: input.actorId ?? input.subjectRef,
      sessionAssurance: input.sessionAssurance ?? 'STRONG',
      deviceTrust: input.deviceTrust ?? 'TRUSTED',
      recentAuthChange: false,
      accountAgeDays: input.accountAgeDays ?? 30,
      beneficiaryAgeDays: null,
      amountMinor: input.amountMinor ?? null,
      destinationRisk: input.destinationRisk ?? 'LOW',
      identityUsable: input.identityUsable ?? true,
      velocityTriggered,
    });
    if (input.counterpartyRef) {
      this.rememberCounterparty({
        counterpartyRef: input.counterpartyRef,
        kind: 'COUNTERPARTY',
        jurisdiction: input.jurisdiction,
        sanctionsId: sanctions.screeningId,
        pepId: pep.screeningId,
      });
    }
    const unavailable =
      sanctions.outcome === 'UNAVAILABLE' ||
      pep.outcome === 'UNAVAILABLE' ||
      media.outcome === 'UNAVAILABLE';
    const hardBlock = sanctions.outcome === 'BLOCK' || profile.category === 'PROHIBITED';
    const latestCase = [...this.store.cases.values()].at(-1);
    return Object.freeze({
      sanctionsOutcome: sanctions.outcome,
      pepOutcome: pep.outcome,
      adverseMediaOutcome: media.outcome,
      sanctionsFresh,
      pepFresh,
      adverseMediaFresh: mediaFresh,
      requiredScreeningMissing: false,
      providerAvailable: !unavailable,
      outagePosture: unavailable ? this.requirements.sanctions.onUnavailable : null,
      amlCategory: profile.category,
      fraudOutcome: fraud.outcome,
      velocityTriggered,
      hardBlock,
      stepUpRequired: fraud.outcome === 'STEP_UP',
      latestScreeningId: sanctions.screeningId,
      latestCaseId: latestCase?.caseId ?? null,
      policyVersionId: input.policyVersionId ?? null,
    });
  }

  metrics(): ComplianceMetrics {
    const screenings = [...this.store.screenings.values()];
    return snapshotMetrics({
      screeningTypes: screenings.map((row) => row.screeningType),
      screeningOutcomes: screenings.map((row) => row.outcome),
      alertCount: this.store.alerts.size,
      openCases: [...this.store.cases.values()].filter((row) =>
        row.status === 'OPEN' || row.status === 'ASSIGNED' || row.status === 'IN_REVIEW',
      ).length,
      unavailableProviders: [...this.store.providers.values()].filter((row) => !row.available).length,
      lastLatencyMs: this.lastLatencyMs,
    });
  }

  private openFromScreening(result: ReturnType<typeof performScreening>): void {
    const type: CaseType =
      result.screeningType === 'SANCTIONS'
        ? 'SANCTIONS_REVIEW'
        : result.screeningType === 'PEP'
          ? 'PEP_REVIEW'
          : 'AML_ALERT';
    const opened = openComplianceCase({
      caseType: type,
      reasonCodes: result.reasonCodes,
      originRefs: [result.screeningId],
      subjectRef: result.subjectRef,
      jurisdiction: result.jurisdiction,
      createdAt: result.screenedAt,
      hardBlock: result.screeningType === 'SANCTIONS' && result.outcome === 'BLOCK',
      ...(result.policyVersionId ? { policyVersionId: result.policyVersionId } : {}),
    });
    this.store.cases.set(opened.caseId, opened);
    this.emit('ComplianceCaseOpened', result.screenedAt, {
      caseId: opened.caseId,
      caseType: opened.caseType,
      subjectRef: opened.subjectRef,
      reasonCodes: opened.reasonCodes,
      screeningId: result.screeningId,
    });
  }

  private emit(
    eventType: ComplianceEventRecord['eventType'],
    occurredAt: UtcInstant,
    payload: ComplianceEventRecord['payload'],
  ): void {
    this.events?.record({
      eventType,
      schemaVersion: 1,
      occurredAt,
      payload,
    });
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
