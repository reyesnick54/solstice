import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import type { StrategyLabStore } from '../store.ts';
import { computeStrategyCapsuleMaterialHash } from './fingerprint.ts';
import {
  asStrategyCapsuleId,
  asStrategyCapsuleVersion,
  asStrategyFamilyId,
  type StrategyCapsuleId,
  type StrategyCapsuleVersion,
  type StrategyFamilyId,
} from './ids.ts';
import {
  canActivateCapsule,
  requiresReviewBeforePromotion,
  transitionCapsuleQualification,
} from './lifecycle.ts';
import type {
  StrategyCapsuleComparison,
  StrategyCapsuleEvidence,
  StrategyCapsuleFailure,
  StrategyCapsuleMaterial,
  StrategyCapsuleQualificationState,
  StrategyCapsuleRecord,
  StrategyCapsuleScope,
} from './types.ts';

export type CreateStrategyCapsuleDraftInput = {
  readonly strategyFamilyId: StrategyFamilyId;
  readonly version?: StrategyCapsuleVersion;
  readonly parentVersion?: StrategyCapsuleVersion | null;
  readonly scope: StrategyCapsuleScope;
  readonly customerId?: string | null;
  readonly createdBy: string;
  readonly environment: StrategyCapsuleRecord['environment'];
  readonly lineage?: StrategyCapsuleRecord['lineage'];
  readonly material: StrategyCapsuleMaterial;
  readonly evidence?: Partial<StrategyCapsuleEvidence>;
  readonly qualificationState?: StrategyCapsuleQualificationState;
};

export class StrategyCapsuleService {
  private readonly clock: Clock;
  private readonly store: StrategyLabStore;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;

  constructor(input: {
    readonly clock: Clock;
    readonly store: StrategyLabStore;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
  }) {
    this.clock = input.clock;
    this.store = input.store;
    this.events = input.events;
    this.evidence = input.evidence;
  }

  createDraft(input: CreateStrategyCapsuleDraftInput): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const scopeCheck = this.validateScope(input.scope, input.customerId ?? null);
    if (!scopeCheck.ok) {
      return scopeCheck;
    }
    const leakage = this.detectCustomerLeakage(input.material, input.scope, input.customerId ?? null);
    if (leakage) {
      return err(leakage);
    }
    const version = input.version ?? asStrategyCapsuleVersion('1');
    const strategyCapsuleId = asStrategyCapsuleId(`${input.strategyFamilyId.replace('sfam_', 'scap_')}_${version}`);
    if (this.store.getStrategyCapsule(strategyCapsuleId, version)) {
      return err({ code: 'MATERIAL_UNCHANGED', message: `capsule ${strategyCapsuleId}@${version} already exists` });
    }
    const parent = input.parentVersion
      ? this.store.getStrategyCapsuleByFamily(input.strategyFamilyId, input.parentVersion)
      : undefined;
    const record = this.freezeRecord({
      strategyCapsuleId,
      strategyFamilyId: input.strategyFamilyId,
      version,
      parentVersion: input.parentVersion ?? null,
      scope: input.scope,
      customerId: input.scope === 'CUSTOMER_SCOPED' ? (input.customerId ?? null) : null,
      environment: input.environment,
      createdAt: this.clock.now(),
      createdBy: input.createdBy,
      lineage: input.lineage ?? Object.freeze({ workOrderId: null, researchLineageRefs: [], parentProposalIds: [] }),
      material: input.material,
      evidence: this.mergeEvidence(input.evidence),
      qualificationState: input.qualificationState ?? (parent ? 'DRAFT' : 'DRAFT'),
      qualificationAt: null,
      frozen: false,
      evaluationRefs: [],
    });
    this.store.putStrategyCapsule(record);
    this.emit('StrategyCapsuleCreated', record);
    this.sealEvidence('STRATEGY_CAPSULE_CREATED', record);
    return ok(record);
  }

  createVersionFromParent(input: {
    readonly strategyFamilyId: StrategyFamilyId;
    readonly parentVersion: StrategyCapsuleVersion;
    readonly newVersion: StrategyCapsuleVersion;
    readonly material: StrategyCapsuleMaterial;
    readonly createdBy: string;
    readonly evidence?: Partial<StrategyCapsuleEvidence>;
  }): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const parent = this.store.getStrategyCapsuleByFamily(input.strategyFamilyId, input.parentVersion);
    if (!parent) {
      return err({ code: 'NOT_FOUND', message: `parent capsule ${input.strategyFamilyId}@${input.parentVersion} not found` });
    }
    const parentHash = computeStrategyCapsuleMaterialHash(parent.material, parent.scope);
    const nextHash = computeStrategyCapsuleMaterialHash(input.material, parent.scope);
    if (parentHash === nextHash) {
      return err({ code: 'MATERIAL_UNCHANGED', message: 'material change required for new capsule version' });
    }
    const draft = this.createDraft({
      strategyFamilyId: input.strategyFamilyId,
      version: input.newVersion,
      parentVersion: input.parentVersion,
      scope: parent.scope,
      customerId: parent.customerId,
      createdBy: input.createdBy,
      environment: parent.environment,
      lineage: parent.lineage,
      material: input.material,
      ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
      qualificationState: 'DRAFT',
    });
    if (!draft.ok) {
      return draft;
    }
    this.emit('StrategyCapsuleVersioned', draft.value, { parentVersion: input.parentVersion });
    this.sealEvidence('STRATEGY_CAPSULE_VERSIONED', draft.value);
    return draft;
  }

  getVersion(strategyCapsuleId: StrategyCapsuleId, version: StrategyCapsuleVersion): StrategyCapsuleRecord | undefined {
    return this.store.getStrategyCapsule(strategyCapsuleId, version);
  }

  listVersions(strategyFamilyId: StrategyFamilyId): readonly StrategyCapsuleRecord[] {
    return this.store.listStrategyCapsulesByFamily(strategyFamilyId);
  }

  compareVersions(
    strategyFamilyId: StrategyFamilyId,
    leftVersion: StrategyCapsuleVersion,
    rightVersion: StrategyCapsuleVersion,
  ): Result<StrategyCapsuleComparison, StrategyCapsuleFailure> {
    const left = this.store.getStrategyCapsuleByFamily(strategyFamilyId, leftVersion);
    const right = this.store.getStrategyCapsuleByFamily(strategyFamilyId, rightVersion);
    if (!left || !right) {
      return err({ code: 'NOT_FOUND', message: 'one or both capsule versions were not found' });
    }
    const changedSections: string[] = [];
    if (left.materialHash !== right.materialHash) {
      for (const section of [
        'description',
        'instrumentUniverse',
        'featureSpecification',
        'modelDependencies',
        'decisionRule',
        'operatingAssumptions',
        'costModel',
        'validity',
        'fixedQualifiedParameters',
      ] as const) {
        if (JSON.stringify(left.material[section]) !== JSON.stringify(right.material[section])) {
          changedSections.push(section);
        }
      }
    }
    return ok(
      Object.freeze({
        leftVersion,
        rightVersion,
        materialHashEqual: left.materialHash === right.materialHash,
        qualificationEqual: left.qualificationState === right.qualificationState,
        changedSections: Object.freeze(changedSections),
      }),
    );
  }

  freezeVersion(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    if (existing.frozen) {
      return ok(existing);
    }
    const frozen = Object.freeze({ ...existing, frozen: true });
    this.store.putStrategyCapsule(frozen);
    this.emit('StrategyCapsuleFrozen', frozen);
    this.sealEvidence('STRATEGY_CAPSULE_FROZEN', frozen);
    return ok(frozen);
  }

  attachEvidence(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
    evidence: Partial<StrategyCapsuleEvidence>,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    if (existing.frozen) {
      return err({ code: 'FROZEN_IMMUTABLE', message: 'frozen capsule versions cannot attach evidence in-place' });
    }
    const updated = Object.freeze({
      ...existing,
      evidence: this.mergeEvidence({ ...existing.evidence, ...evidence }),
    });
    this.store.putStrategyCapsule(updated);
    return ok(updated);
  }

  attachEvaluationRef(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
    evaluationRef: string,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    const updated = Object.freeze({
      ...existing,
      evaluationRefs: Object.freeze([...existing.evaluationRefs, evaluationRef]),
    });
    this.store.putStrategyCapsule(updated);
    this.emit('EvaluationRequested', updated, { evaluationRef });
    this.sealEvidence('STRATEGY_CAPSULE_EVALUATION_REQUESTED', updated);
    return ok(updated);
  }

  transitionQualification(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
    to: StrategyCapsuleQualificationState,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    const moved = transitionCapsuleQualification(existing.qualificationState, to);
    if (!moved.ok) {
      return moved;
    }
    const updated = Object.freeze({
      ...existing,
      qualificationState: moved.value,
      qualificationAt: this.isQualifiedState(moved.value) ? this.clock.now() : existing.qualificationAt,
    });
    this.store.putStrategyCapsule(updated);
    return ok(updated);
  }

  markExpired(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
    expiresAt: UtcInstant,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    const withExpiry = Object.freeze({
      ...existing,
      material: Object.freeze({
        ...existing.material,
        validity: Object.freeze({ ...existing.material.validity, expiresAt }),
      }),
    });
    this.store.putStrategyCapsule(withExpiry);
    const transitioned = this.transitionQualification(strategyCapsuleId, version, 'EXPIRED');
    if (!transitioned.ok) {
      return transitioned;
    }
    this.emit('StrategyCapsuleExpired', transitioned.value);
    this.sealEvidence('STRATEGY_CAPSULE_EXPIRED', transitioned.value);
    return transitioned;
  }

  registerPrebuilt(record: StrategyCapsuleRecord): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const scopeCheck = this.validateScope(record.scope, record.customerId);
    if (!scopeCheck.ok) {
      return scopeCheck;
    }
    const leakage = this.detectCustomerLeakage(record.material, record.scope, record.customerId);
    if (leakage) {
      return err(leakage);
    }
    if (this.store.getStrategyCapsule(record.strategyCapsuleId, record.version)) {
      return ok(this.store.getStrategyCapsule(record.strategyCapsuleId, record.version)!);
    }
    this.store.putStrategyCapsule(record);
    this.emit('StrategyCapsuleCreated', record);
    this.sealEvidence('STRATEGY_CAPSULE_CREATED', record);
    return ok(record);
  }

  revoke(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
  ): Result<StrategyCapsuleRecord, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    const transitioned = this.transitionQualification(strategyCapsuleId, version, 'REVOKED');
    if (!transitioned.ok) {
      return transitioned;
    }
    this.emit('StrategyCapsuleRevoked', transitioned.value);
    this.sealEvidence('STRATEGY_CAPSULE_REVOKED', transitioned.value);
    return transitioned;
  }

  assertActivationAllowed(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
  ): Result<true, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    if (existing.qualificationState === 'REVOKED') {
      return err({ code: 'REVOKED', message: 'revoked capsule cannot be activated' });
    }
    if (existing.qualificationState === 'EXPIRED') {
      return err({ code: 'EXPIRED', message: 'expired capsule cannot be activated without review' });
    }
    if (!canActivateCapsule(existing.qualificationState)) {
      return err({
        code: 'ACTIVATION_FORBIDDEN',
        message: `capsule qualification ${existing.qualificationState} cannot be activated`,
      });
    }
    return ok(true);
  }

  assertPromotionAllowed(
    strategyCapsuleId: StrategyCapsuleId,
    version: StrategyCapsuleVersion,
  ): Result<true, StrategyCapsuleFailure> {
    const existing = this.store.getStrategyCapsule(strategyCapsuleId, version);
    if (!existing) {
      return err({ code: 'NOT_FOUND', message: `capsule ${strategyCapsuleId}@${version} not found` });
    }
    if (existing.qualificationState === 'REVOKED') {
      return err({ code: 'REVOKED', message: 'revoked capsule cannot be promoted' });
    }
    if (requiresReviewBeforePromotion(existing.qualificationState)) {
      return err({
        code: 'PROMOTION_REQUIRES_REVIEW',
        message: `capsule in ${existing.qualificationState} requires review before promotion`,
      });
    }
    return ok(true);
  }

  private freezeRecord(
    input: Omit<StrategyCapsuleRecord, 'materialHash' | 'simulationOnly' | 'llmDeployable'>,
  ): StrategyCapsuleRecord {
    return Object.freeze({
      ...input,
      materialHash: computeStrategyCapsuleMaterialHash(input.material, input.scope),
      simulationOnly: true,
      llmDeployable: false,
    });
  }

  private validateScope(
    scope: StrategyCapsuleScope,
    customerId: string | null,
  ): Result<true, StrategyCapsuleFailure> {
    if (scope === 'CUSTOMER_SCOPED' && !customerId) {
      return err({ code: 'INVALID_SCOPE', message: 'customer-scoped capsules require customerId' });
    }
    if (scope === 'GLOBAL' && customerId) {
      return err({ code: 'INVALID_SCOPE', message: 'global capsules cannot embed customerId' });
    }
    return ok(true);
  }

  private detectCustomerLeakage(
    material: StrategyCapsuleMaterial,
    scope: StrategyCapsuleScope,
    customerId: string | null,
  ): StrategyCapsuleFailure | null {
    if (scope !== 'GLOBAL') {
      return null;
    }
    const serialized = JSON.stringify(material);
    const leakagePatterns = ['customerId', 'mandateId', 'accountBalance', 'privateHin'];
    for (const pattern of leakagePatterns) {
      if (serialized.includes(pattern)) {
        return {
          code: 'CUSTOMER_LEAKAGE',
          message: `global capsule material must not embed customer-private field ${pattern}`,
        };
      }
    }
    if (customerId) {
      return { code: 'CUSTOMER_LEAKAGE', message: 'global capsule cannot carry customerId' };
    }
    return null;
  }

  private mergeEvidence(partial?: Partial<StrategyCapsuleEvidence>): StrategyCapsuleEvidence {
    return Object.freeze({
      researchResultRefs: Object.freeze(partial?.researchResultRefs ?? []),
      observationRefs: Object.freeze(partial?.observationRefs ?? []),
      provenanceRefs: Object.freeze(partial?.provenanceRefs ?? []),
      sourceIndependenceNotes: Object.freeze(partial?.sourceIndependenceNotes ?? []),
      knownContradictions: Object.freeze(partial?.knownContradictions ?? []),
      rejectedEvidenceRefs: Object.freeze(partial?.rejectedEvidenceRefs ?? []),
      evidenceVaultRefs: Object.freeze(partial?.evidenceVaultRefs ?? []),
    });
  }

  private isQualifiedState(state: StrategyCapsuleQualificationState): boolean {
    return state === 'SHADOW_ELIGIBLE' || state === 'PAPER_ELIGIBLE';
  }

  private emit(
    eventType:
      | 'StrategyCapsuleCreated'
      | 'StrategyCapsuleVersioned'
      | 'StrategyCapsuleFrozen'
      | 'EvaluationRequested'
      | 'StrategyCapsuleExpired'
      | 'StrategyCapsuleRevoked',
    record: StrategyCapsuleRecord,
    extra?: Record<string, unknown>,
  ): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      aggregateId: record.strategyCapsuleId,
      aggregateType: 'strategy_capsule',
      occurredAt: this.clock.now(),
      payload: Object.freeze({
        strategyCapsuleId: record.strategyCapsuleId,
        strategyFamilyId: record.strategyFamilyId,
        version: record.version,
        materialHash: record.materialHash,
        qualificationState: record.qualificationState,
        scope: record.scope,
        llmDeployable: false,
        simulationOnly: true,
        ...extra,
      }),
    } as never);
  }

  private sealEvidence(kind: string, record: StrategyCapsuleRecord): void {
    this.evidence?.seal(kind, {
      strategyCapsuleId: record.strategyCapsuleId,
      strategyFamilyId: record.strategyFamilyId,
      version: record.version,
      materialHash: record.materialHash,
      qualificationState: record.qualificationState,
      scope: record.scope,
    });
  }
}

export { asStrategyFamilyId };
