import { PersonalEconomyAgent } from '../../../agent/src/service.ts';
import type { AgentProposal } from '../../../agent/src/proposal.ts';
import type { Clock } from '../../../config/src/clock.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../../events/src/events.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate } from '../mandate/types.ts';
import type { GrowthPlan } from '../growth/types.ts';
import { authorizeViewEconomicValue, type PeveAccessFailure } from './access.ts';
import { freezeBaseline, GrowthAttributionLedger, type AttributionFailure, type RecordAttributionInput } from './attribution.ts';
import { computeVector, type ComputeFailure, type ValuationInput } from './compute.ts';
import { FormulaRegistry, FORMULA_V1, MODEL_V1 } from './formula.ts';
import {
  asEconomicValueModelVersion,
  asValuationFormulaVersion,
  counterfactualIdFor,
  dataContributionIdFor,
  profileIdFor,
  snapshotIdFor,
  type EconomicValueDimensionId,
  type EconomicValueModelVersion,
  type EconomicValueSnapshotId,
  type ValuationFormulaVersion,
} from './ids.ts';
import { PEVE_NOT_EXECUTION, PEVE_NOT_HUMAN_WORTH } from './taxonomy.ts';
import { InMemoryPeveStore } from './store.ts';
import type {
  AttributionEntry,
  CounterfactualBaseline,
  DataContributionReference,
  DimensionExplanation,
  DimensionResult,
  EconomicValueSnapshot,
  FormulaModel,
  FxValuationContext,
  ModelComparison,
} from './types.ts';

export type PeveFailure =
  | PeveAccessFailure
  | ComputeFailure
  | AttributionFailure
  | { readonly code: 'SNAPSHOT_NOT_FOUND'; readonly message: string }
  | { readonly code: 'DIMENSION_NOT_FOUND'; readonly message: string }
  | { readonly code: 'FORMULA_NOT_FOUND'; readonly message: string }
  | { readonly code: 'AI_CANNOT_SET_SCORE'; readonly message: string }
  | { readonly code: 'GUARANTEED_COMPENSATION_FORBIDDEN'; readonly message: string };

export type GenerateSnapshotInput = {
  readonly subjectId: string;
  readonly peg: PersonalEconomicSnapshot;
  readonly mandate?: CompiledEconomicMandate;
  readonly plan?: GrowthPlan;
  readonly fx?: FxValuationContext;
  readonly extraFacts?: Readonly<Record<string, unknown>>;
  readonly formulaVersion?: ValuationFormulaVersion;
  readonly modelVersion?: EconomicValueModelVersion;
  readonly restated?: boolean;
  readonly restatementOfSnapshotId?: EconomicValueSnapshotId;
  readonly riskContext?: {
    readonly assessmentId: string;
    readonly outcome: string;
    readonly higherRiskIsNotHigherValue: true;
    readonly unrealizedUpsideIsNotRealizedValue: true;
  };
};

export class PersonalEconomicValueEngine {
  private readonly clock: Clock;
  private readonly events: DomainEventLog;
  private readonly evidence?: EvidenceVault;
  private readonly agent: PersonalEconomyAgent;
  readonly store: InMemoryPeveStore;
  readonly formulas: FormulaRegistry;
  readonly attribution: GrowthAttributionLedger;

  constructor(input: {
    readonly clock: Clock;
    readonly events: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly agent?: PersonalEconomyAgent;
    readonly store?: InMemoryPeveStore;
    readonly formulas?: FormulaRegistry;
    readonly attribution?: GrowthAttributionLedger;
  }) {
    this.clock = input.clock;
    this.events = input.events;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.agent = input.agent ?? new PersonalEconomyAgent({ clock: input.clock });
    this.store = input.store ?? new InMemoryPeveStore();
    this.formulas = input.formulas ?? new FormulaRegistry();
    this.attribution = input.attribution ?? new GrowthAttributionLedger();
    for (const model of this.formulas.list()) {
      this.store.putFormula(model);
    }
  }

  generateSnapshot(
    actor: unknown,
    input: GenerateSnapshotInput,
  ): Result<EconomicValueSnapshot, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, input.subjectId);
    if (!access.ok) {
      return access;
    }
    const formula = this.resolveFormula(input.formulaVersion, input.modelVersion);
    if (!formula.ok) {
      return formula;
    }
    const now = this.clock.now();
    const sequence = this.store.snapshotsFor(input.subjectId).length + 1;
    const snapshotId = snapshotIdFor(input.subjectId, now, formula.value.modelVersion, sequence);
    const prior = this.store.latestSnapshotFor(input.subjectId);
    const valuation: ValuationInput = {
      subjectId: input.subjectId,
      generatedAt: now,
      snapshotId,
      peg: input.peg,
      formula: formula.value,
      attributions: this.attribution.list(input.subjectId),
      ...(input.mandate ? { mandate: input.mandate } : {}),
      ...(input.plan ? { plan: input.plan } : {}),
      ...(prior
        ? { prior: { dimensions: prior.vector.dimensions, generatedAt: prior.generatedAt } }
        : {}),
      ...(input.fx ? { fx: input.fx } : {}),
      ...(input.extraFacts ? { extraFacts: input.extraFacts } : {}),
    };
    const computed = computeVector(valuation);
    if (!computed.ok) {
      return computed;
    }
    const previousByKind = new Map(prior?.vector.dimensions.map((item) => [item.kind, item]) ?? []);
    const snapshot: EconomicValueSnapshot = Object.freeze({
      snapshotId,
      profileId: profileIdFor(input.subjectId),
      subjectId: input.subjectId,
      generatedAt: now,
      pegSnapshotId: input.peg.snapshotId,
      ...(input.plan ? { growthPlanId: input.plan.planId } : {}),
      formulaVersion: formula.value.formulaVersion,
      modelVersion: formula.value.modelVersion,
      valuationContext: Object.freeze({
        primaryCurrency: input.fx?.baseCurrency ?? input.mandate?.currency ?? 'USD',
        ...(input.fx ? { fx: input.fx } : {}),
        notHumanWorth: true,
        notCreditScore: true,
        notExecutionAuthority: true,
      }),
      vector: computed.value.vector,
      composite: computed.value.composite,
      reserveCoverage: computed.value.reserveCoverage,
      cashFlowCapacity: computed.value.cashFlowCapacity,
      debtBurden: computed.value.debtBurden,
      goalProgress: computed.value.goalProgress,
      opportunityCapacity: computed.value.opportunityCapacity,
      confidence: computed.value.confidence,
      completeness: computed.value.completeness,
      assumptions: Object.freeze([
        PEVE_NOT_HUMAN_WORTH,
        PEVE_NOT_EXECUTION,
        'PEG facts are non-authoritative; the ledger wins for balances.',
        'Projected attribution is excluded from realized totals.',
        ...(input.riskContext
          ? [
              'Higher investment risk is not higher human value.',
              'Unrealized portfolio upside is not realized economic value.',
            ]
          : []),
      ]),
      warnings: computed.value.warnings,
      sourceReferences: Object.freeze([
        input.peg.snapshotId,
        formula.value.formulaVersion,
        formula.value.modelVersion,
        ...this.attribution.list(input.subjectId).map((item) => item.entryId),
        ...(input.plan ? [input.plan.planId] : []),
        ...(input.riskContext ? [input.riskContext.assessmentId] : []),
      ]),
      restated: input.restated === true,
      ...(input.restatementOfSnapshotId ? { restatementOfSnapshotId: input.restatementOfSnapshotId } : {}),
    });
    this.store.putSnapshot(snapshot);
    this.emit('EconomicValueSnapshotCreated', {
      snapshotId: snapshot.snapshotId,
      subjectId: snapshot.subjectId,
      formulaVersion: snapshot.formulaVersion,
      modelVersion: snapshot.modelVersion,
      pegSnapshotId: snapshot.pegSnapshotId,
      completeness: snapshot.completeness,
      compositePoints: snapshot.composite.measure.points,
    });
    for (const dimension of snapshot.vector.dimensions) {
      const previous = previousByKind.get(dimension.kind);
      if (previous && previous.measure.points !== dimension.measure.points) {
        this.emit('EconomicValueDimensionChanged', {
          snapshotId: snapshot.snapshotId,
          dimensionId: dimension.dimensionId,
          kind: dimension.kind,
          points: dimension.measure.points,
          priorPoints: previous.measure.points,
        });
      }
    }
    if (snapshot.goalProgress.length > 0) {
      this.emit('EconomicValueGoalProgressUpdated', {
        snapshotId: snapshot.snapshotId,
        subjectId: snapshot.subjectId,
        goalCount: snapshot.goalProgress.length,
      });
    }
    this.seal('PEVE_SNAPSHOT_CREATED', {
      snapshotId: snapshot.snapshotId,
      subjectId: snapshot.subjectId,
      pegSnapshotId: snapshot.pegSnapshotId,
      formulaVersion: snapshot.formulaVersion,
      modelVersion: snapshot.modelVersion,
      actorId: access.value.actorId,
      completeness: snapshot.completeness,
      compositePoints: snapshot.composite.measure.points,
      growthPlanId: snapshot.growthPlanId,
    });
    return ok(snapshot);
  }

  getEconomicValueSnapshot(
    actor: unknown,
    subjectId: string,
    snapshotId?: EconomicValueSnapshotId,
  ): Result<EconomicValueSnapshot, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const snapshot = snapshotId ? this.store.getSnapshot(snapshotId) : this.store.latestSnapshotFor(subjectId);
    if (!snapshot || snapshot.subjectId !== subjectId) {
      return err({ code: 'SNAPSHOT_NOT_FOUND', message: 'no PEVE snapshot for subject' });
    }
    return ok(snapshot);
  }

  getEconomicValueDimension(
    actor: unknown,
    subjectId: string,
    dimensionId: EconomicValueDimensionId,
  ): Result<DimensionResult, PeveFailure> {
    const snapshot = this.getEconomicValueSnapshot(actor, subjectId);
    if (!snapshot.ok) {
      return snapshot;
    }
    const dimension = snapshot.value.vector.dimensions.find((item) => item.dimensionId === dimensionId);
    if (!dimension) {
      return err({ code: 'DIMENSION_NOT_FOUND', message: 'dimension not found on the current snapshot' });
    }
    return ok(dimension);
  }

  getGrowthAttribution(actor: unknown, subjectId: string): Result<readonly AttributionEntry[], PeveFailure> {
    const access = authorizeViewEconomicValue(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    return ok(this.attribution.list(subjectId));
  }

  getValueChangeExplanation(
    actor: unknown,
    subjectId: string,
  ): Result<readonly DimensionExplanation[], PeveFailure> {
    const snapshot = this.getEconomicValueSnapshot(actor, subjectId);
    if (!snapshot.ok) {
      return snapshot;
    }
    return ok(
      Object.freeze(
        snapshot.value.vector.dimensions.map((dimension) => ({
          dimension,
          value: dimension.measure,
          meaning: dimension.meaning,
          factsUsed: dimension.factsUsed,
          factsMissing: dimension.factsMissing,
          calculations: dimension.calculation,
          confidence: dimension.confidence,
          ...(dimension.priorPoints
            ? {
                priorValue: {
                  kind: 'INDEX' as const,
                  points: dimension.priorPoints,
                  scale: 100 as const,
                  unit: 'POINTS_PER_HUNDRED' as const,
                  isMoney: false as const,
                },
              }
            : {}),
          ...(dimension.changePoints ? { change: dimension.changePoints } : {}),
          formulaVersion: dimension.formulaVersion,
        })),
      ),
    );
  }

  recordAttribution(
    actor: unknown,
    input: RecordAttributionInput,
  ): Result<AttributionEntry, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, input.subjectId);
    if (!access.ok) {
      return access;
    }
    const recorded = this.attribution.record(input);
    if (!recorded.ok) {
      return recorded;
    }
    this.store.putAttribution(recorded.value);
    this.emit('EconomicValueAttributionRecorded', {
      entryId: recorded.value.entryId,
      subjectId: recorded.value.subjectId,
      sourceEventId: recorded.value.sourceEventId,
      realization: recorded.value.realization,
      attributionType: recorded.value.attributionType,
      minorUnits: recorded.value.amount.minorUnits,
      currency: recorded.value.amount.currency,
      groupId: recorded.value.groupId,
    });
    this.seal('PEVE_ATTRIBUTION_RECORDED', {
      entryId: recorded.value.entryId,
      sourceEventId: recorded.value.sourceEventId,
      realization: recorded.value.realization,
      formulaVersion: recorded.value.formulaVersion,
      growthPlanId: recorded.value.growthPlanId,
      baselineId: recorded.value.baselineId,
      actorId: access.value.actorId,
    });
    return recorded;
  }

  recordBaseline(actor: unknown, baseline: CounterfactualBaseline): Result<CounterfactualBaseline, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, baseline.subjectId);
    if (!access.ok) {
      return access;
    }
    const frozen = freezeBaseline(baseline);
    this.store.putBaseline(frozen);
    return ok(frozen);
  }

  recordDataContribution(
    actor: unknown,
    input: Omit<DataContributionReference, 'referenceId' | 'guaranteedCompensation' | 'tokenValuation'> & {
      readonly guaranteedCompensation?: boolean;
    },
  ): Result<DataContributionReference, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, input.subjectId);
    if (!access.ok) {
      return access;
    }
    if (input.guaranteedCompensation === true) {
      return err({
        code: 'GUARANTEED_COMPENSATION_FORBIDDEN',
        message: 'data-contribution estimates must not be represented as guaranteed compensation',
      });
    }
    const reference: DataContributionReference = Object.freeze({
      ...input,
      referenceId: dataContributionIdFor(`${input.subjectId}_${input.purpose}`.toLowerCase().replace(/\s+/g, '_')),
      estimatedLabeled: input.estimatedValue !== undefined,
      guaranteedCompensation: false,
      tokenValuation: false,
    });
    this.store.putContribution(reference);
    return ok(reference);
  }

  activateModel(
    actor: unknown,
    subjectId: string,
    formulaVersion: ValuationFormulaVersion,
    modelVersion: EconomicValueModelVersion,
  ): Result<FormulaModel, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const activated = this.formulas.activate(formulaVersion, modelVersion, this.clock.now());
    if (!activated.ok) {
      return err({ code: 'FORMULA_NOT_FOUND', message: activated.error.message });
    }
    for (const model of this.formulas.list()) {
      this.store.putFormula(model);
    }
    this.emit('EconomicValueModelActivated', {
      formulaVersion: activated.value.formulaVersion,
      modelVersion: activated.value.modelVersion,
      lifecycle: activated.value.lifecycle,
    });
    this.seal('PEVE_MODEL_ACTIVATED', {
      formulaVersion: activated.value.formulaVersion,
      modelVersion: activated.value.modelVersion,
      actorId: access.value.actorId,
    });
    return activated;
  }

  compareModels(
    actor: unknown,
    subjectId: string,
    left: { readonly formulaVersion: ValuationFormulaVersion; readonly modelVersion: EconomicValueModelVersion },
    right: { readonly formulaVersion: ValuationFormulaVersion; readonly modelVersion: EconomicValueModelVersion },
    peg: PersonalEconomicSnapshot,
    extras?: { readonly mandate?: CompiledEconomicMandate; readonly plan?: GrowthPlan; readonly fx?: FxValuationContext },
  ): Result<ModelComparison, PeveFailure> {
    const access = authorizeViewEconomicValue(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    const leftSnap = this.generateUnder(actor, {
      subjectId,
      peg,
      formulaVersion: left.formulaVersion,
      modelVersion: left.modelVersion,
      restated: true,
      ...(extras?.mandate ? { mandate: extras.mandate } : {}),
      ...(extras?.plan ? { plan: extras.plan } : {}),
      ...(extras?.fx ? { fx: extras.fx } : {}),
    });
    if (!leftSnap.ok) {
      return leftSnap;
    }
    const rightSnap = this.generateUnder(actor, {
      subjectId,
      peg,
      formulaVersion: right.formulaVersion,
      modelVersion: right.modelVersion,
      restated: true,
      restatementOfSnapshotId: leftSnap.value.snapshotId,
      ...(extras?.mandate ? { mandate: extras.mandate } : {}),
      ...(extras?.plan ? { plan: extras.plan } : {}),
      ...(extras?.fx ? { fx: extras.fx } : {}),
    });
    if (!rightSnap.ok) {
      return rightSnap;
    }
    const compared = this.formulas.compare(left, right, { left: leftSnap.value, right: rightSnap.value });
    if (!compared.ok) {
      return err({ code: 'FORMULA_NOT_FOUND', message: compared.error.message });
    }
    this.store.putComparison(compared.value);
    return compared;
  }

  timeline(actor: unknown, subjectId: string): Result<readonly EconomicValueSnapshot[], PeveFailure> {
    const access = authorizeViewEconomicValue(actor, subjectId);
    if (!access.ok) {
      return access;
    }
    return ok(this.store.snapshotsFor(subjectId));
  }

  explainWithAgent(actor: unknown, subjectId: string): Result<AgentProposal, PeveFailure> {
    const explanations = this.getValueChangeExplanation(actor, subjectId);
    if (!explanations.ok) {
      return explanations;
    }
    const snapshot = this.getEconomicValueSnapshot(actor, subjectId);
    if (!snapshot.ok) {
      return snapshot;
    }
    const summary = explanations.value
      .map((item) => `${item.dimension.kind}=${item.value.points}${item.change ? ` change=${item.change}` : ''}`)
      .join('; ');
    const explained = this.agent.explainEconomicValue(actor, {
      subjectId,
      valueSummary: `${PEVE_NOT_HUMAN_WORTH} Completeness=${snapshot.value.completeness}. ${summary}`,
    });
    if (!explained.ok) {
      return err({ code: 'AI_CANNOT_SET_SCORE', message: explained.error.message });
    }
    return explained;
  }

  refuseAiScore(_actor: unknown, _points: string): Result<never, PeveFailure> {
    return err({
      code: 'AI_CANNOT_SET_SCORE',
      message: 'The Personal Economy Agent cannot set PEVE scores. PEVE computes deterministic values.',
    });
  }

  planningSignals(subjectId: string): {
    readonly resiliencePoints: string;
    readonly opportunityMinorUnits?: string;
    readonly currency?: string;
    readonly completeness?: string;
    readonly mayExecute: false;
  } {
    const snapshot = this.store.latestSnapshotFor(subjectId);
    const resilience = snapshot?.vector.dimensions.find((item) => item.kind === 'ECONOMIC_RESILIENCE');
    const opportunity = snapshot?.opportunityCapacity[0];
    return {
      resiliencePoints: resilience?.measure.points ?? '0',
      ...(opportunity?.informationalFlexibility
        ? { opportunityMinorUnits: opportunity.informationalFlexibility.minorUnits }
        : {}),
      ...(opportunity ? { currency: opportunity.currency } : {}),
      ...(snapshot ? { completeness: snapshot.completeness } : {}),
      mayExecute: false,
    };
  }

  rebuildFromCanonical(
    actor: unknown,
    input: {
      readonly subjectId: string;
      readonly peg: PersonalEconomicSnapshot;
      readonly attributions: readonly AttributionEntry[];
      readonly baselines: readonly CounterfactualBaseline[];
      readonly formulaVersion: ValuationFormulaVersion;
      readonly modelVersion: EconomicValueModelVersion;
      readonly generatedAt: string;
    },
  ): Result<EconomicValueSnapshot, PeveFailure> {
    const existing = this.store.snapshotByFormula(
      input.subjectId,
      input.formulaVersion,
      input.modelVersion,
      input.generatedAt,
    );
    if (existing) {
      const access = authorizeViewEconomicValue(actor, input.subjectId);
      if (!access.ok) {
        return access;
      }
      return ok(existing);
    }
    this.attribution.load(input.attributions);
    for (const baseline of input.baselines) {
      if (!this.store.getBaseline(baseline.baselineId)) {
        this.store.putBaseline(freezeBaseline(baseline));
      }
    }
    return this.generateSnapshot(actor, {
      subjectId: input.subjectId,
      peg: input.peg,
      formulaVersion: input.formulaVersion,
      modelVersion: input.modelVersion,
    });
  }

  newBaselineId(kind: string, key: string) {
    return counterfactualIdFor(kind, key);
  }

  defaultFormula(): { readonly formulaVersion: ValuationFormulaVersion; readonly modelVersion: EconomicValueModelVersion } {
    return { formulaVersion: FORMULA_V1, modelVersion: MODEL_V1 };
  }

  private generateUnder(
    actor: unknown,
    input: GenerateSnapshotInput,
  ): Result<EconomicValueSnapshot, PeveFailure> {
    return this.generateSnapshot(actor, input);
  }

  private resolveFormula(
    formulaVersion?: ValuationFormulaVersion,
    modelVersion?: EconomicValueModelVersion,
  ): Result<FormulaModel, PeveFailure> {
    if (!formulaVersion && !modelVersion) {
      return ok(this.formulas.active());
    }
    const formula = this.formulas.get(
      formulaVersion ?? asValuationFormulaVersion('peve-formula-v1'),
      modelVersion ?? asEconomicValueModelVersion('peve-model-v1'),
    );
    if (!formula) {
      return err({ code: 'FORMULA_NOT_FOUND', message: 'requested PEVE formula is not registered' });
    }
    return ok(formula);
  }

  private emit(eventType: DomainEvent['eventType'], payload: Record<string, unknown>): void {
    this.events.append({
      eventType,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
    } as DomainEvent);
  }

  private seal(kind: string, payload: Record<string, unknown>): void {
    this.evidence?.seal(kind, payload);
  }
}
