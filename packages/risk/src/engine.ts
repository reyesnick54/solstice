import { createHash } from 'node:crypto';

import type { Clock } from '../../config/src/clock.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import {
  CANONICAL_RISK_MODEL_ID,
  CANONICAL_RISK_MODEL_VERSION,
  ModelRegistry,
} from '../../model-registry/src/registry.ts';
import { applyRatio, ratioCmp, ratioPercent, shareOf, type Ratio } from './arithmetic.ts';
import { analyzeExtremeGoal, estimateMaxDrawdown, estimateVolatility } from './analytics.ts';
import {
  asPreTradeRiskDecisionId,
  asRiskAssessmentId,
  asRiskBudgetId,
  asRiskLimitId,
  asRiskModelId,
  asRiskModelVersion,
  asRiskPolicyVersion,
} from './ids.ts';
import { freezePortfolioRiskSnapshot, portfolioMarketValue } from './snapshot.ts';
import { DEFAULT_STRESS_SCENARIOS, runStressScenario } from './stress.ts';
import { RiskStore } from './store.ts';
import type {
  ExtremeGoalAnalysis,
  GrowthRiskAnnotation,
  InvestmentRiskKernelFacts,
  MandateLiquidityConstraint,
  PeveRiskContext,
  PortfolioRiskSnapshot,
  ProposedPaperTrade,
  RdtRiskPreview,
  RiskBudget,
  RiskCalculation,
  RiskDecision,
  RiskLimit,
  RiskOutcome,
  StaleDataPolicy,
  StressRun,
  StressScenario,
  TriggeredLimit,
} from './types.ts';

export const DEFAULT_RISK_POLICY_VERSION = asRiskPolicyVersion('risk-policy-v1');

export function defaultSimulationBudget(input: {
  readonly subjectId: string;
  readonly portfolioId: string;
  readonly reviewBy: UtcInstant;
  readonly maxInstrumentConcentration?: Ratio;
}): RiskBudget {
  return Object.freeze({
    budgetId: asRiskBudgetId('rbdg_default_simulation'),
    subjectId: input.subjectId,
    portfolioId: input.portfolioId,
    version: DEFAULT_RISK_POLICY_VERSION,
    permittedInstrumentClasses: Object.freeze(['EQUITY', 'ETF', 'BOND', 'FUND', 'CASH_EQUIVALENT']),
    maximumInstrumentConcentration: input.maxInstrumentConcentration ?? ratioPercent(60n),
    maximumAssetClassConcentration: ratioPercent(80n),
    maximumCurrencyConcentration: ratioPercent(100n),
    maximumPortfolioDeployment: ratioPercent(95n),
    minimumBrokerageCashMinor: 0n,
    drawdownGuard: ratioPercent(40n),
    maximumSimulatedStressLossMinor: 10_000_000_000n,
    allowedCurrencies: Object.freeze(['USD', 'GBP', 'EUR']),
    reviewBy: input.reviewBy,
    engineeringOnly: true,
    cannotLoosenMandate: true,
  });
}

function escalate(current: RiskOutcome, next: RiskOutcome): RiskOutcome {
  const rank: Record<RiskOutcome, number> = {
    ALLOW_SIMULATION: 0,
    REQUIRE_REVIEW: 1,
    INSUFFICIENT_DATA: 2,
    BLOCK: 3,
  };
  return rank[next] > rank[current] ? next : current;
}

function qualityOutcome(
  quality: PortfolioRiskSnapshot['positions'][number]['priceQuality'],
  stalePolicy: StaleDataPolicy,
): RiskOutcome | null {
  if (quality === 'CURRENT') {
    return null;
  }
  if (quality === 'MISSING') {
    return 'INSUFFICIENT_DATA';
  }
  if (quality === 'CONFLICTED') {
    return 'BLOCK';
  }
  return stalePolicy;
}

function hashId(prefix: 'ras_' | 'prd_', material: string): string {
  return `${prefix}${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

export class RiskEngine {
  private readonly clock: Clock;
  private readonly registry: ModelRegistry;
  readonly store: RiskStore;
  private readonly events: DomainEventLog | undefined;
  private readonly evidence: EvidenceVault | undefined;
  private readonly stalePolicy: StaleDataPolicy;

  constructor(input: {
    readonly clock: Clock;
    readonly registry: ModelRegistry;
    readonly store?: RiskStore;
    readonly events?: DomainEventLog;
    readonly evidence?: EvidenceVault;
    readonly stalePolicy?: StaleDataPolicy;
  }) {
    this.clock = input.clock;
    this.registry = input.registry;
    this.store = input.store ?? new RiskStore();
    this.events = input.events;
    this.evidence = input.evidence;
    this.stalePolicy = input.stalePolicy ?? 'REQUIRE_REVIEW';
    for (const scenario of DEFAULT_STRESS_SCENARIOS) {
      this.store.putScenario(scenario);
    }
  }

  putBudget(budget: RiskBudget): void {
    this.store.putBudget(Object.freeze({ ...budget, cannotLoosenMandate: true, engineeringOnly: true }));
  }

  captureSnapshot(snapshot: PortfolioRiskSnapshot): PortfolioRiskSnapshot {
    const frozen = freezePortfolioRiskSnapshot(snapshot);
    this.store.putSnapshot(frozen);
    this.emit('RiskPortfolioSnapshotCreated', frozen.snapshotId, {
      snapshotId: frozen.snapshotId,
      portfolioId: frozen.portfolioId,
    });
    return frozen;
  }

  assessPreTrade(input: {
    readonly snapshot: PortfolioRiskSnapshot;
    readonly proposed: ProposedPaperTrade;
    readonly budget: RiskBudget;
    readonly mandate?: MandateLiquidityConstraint;
  }): RiskDecision {
    const model = this.registry.get(CANONICAL_RISK_MODEL_ID, CANONICAL_RISK_MODEL_VERSION);
    if (!model || model.lifecycle !== 'APPROVED_FOR_SIMULATION') {
      return this.decision(input, 'INSUFFICIENT_DATA', [], [], ['registered risk model is not APPROVED_FOR_SIMULATION']);
    }
    const snapshot = this.captureSnapshot(input.snapshot);
    const mandate = input.mandate ?? snapshot.mandate;
    const calculations: RiskCalculation[] = [];
    const triggered: TriggeredLimit[] = [];
    const stale: string[] = [];
    let outcome: RiskOutcome = 'ALLOW_SIMULATION';

    const currentInstrument = snapshot.positions
      .filter((row) => row.instrumentId === input.proposed.instrumentId)
      .reduce((sum, row) => sum + row.marketValueMinor, 0n);
    const currentClass = snapshot.positions
      .filter((row) => row.instrumentType === input.proposed.instrumentType)
      .reduce((sum, row) => sum + row.marketValueMinor, 0n);
    const currentCurrency = snapshot.positions
      .filter((row) => row.currency === input.proposed.currency)
      .reduce((sum, row) => sum + row.marketValueMinor, 0n);
    const signedNotional = input.proposed.side === 'BUY' ? input.proposed.notionalMinor : -input.proposed.notionalMinor;
    const postInstrument = currentInstrument + signedNotional;
    const postClass = currentClass + signedNotional;
    const postCurrency = currentCurrency + signedNotional;
    const cashAfter =
      input.proposed.side === 'BUY'
        ? snapshot.brokerageCashMinor - input.proposed.notionalMinor - input.proposed.feeMinor
        : snapshot.brokerageCashMinor + input.proposed.notionalMinor - input.proposed.feeMinor;
    const marketAfter = portfolioMarketValue(snapshot.positions) + signedNotional;
    const totalAfter = marketAfter + cashAfter;

    const positionRatio = shareOf(postInstrument < 0n ? 0n : postInstrument, totalAfter <= 0n ? 1n : totalAfter);
    const classRatio = shareOf(postClass < 0n ? 0n : postClass, totalAfter <= 0n ? 1n : totalAfter);
    const currencyRatio = shareOf(postCurrency < 0n ? 0n : postCurrency, totalAfter <= 0n ? 1n : totalAfter);
    const deployment = shareOf(marketAfter < 0n ? 0n : marketAfter, totalAfter <= 0n ? 1n : totalAfter);

    calculations.push(
      Object.freeze({
        name: 'post_trade_instrument_concentration',
        dimension: 'INSTRUMENT_CONCENTRATION',
        inputs: Object.freeze([currentInstrument.toString(), signedNotional.toString(), totalAfter.toString()]),
        resultRatio: positionRatio,
        method: 'part_minor * RATIO_UNIT / portfolio_minor',
        precision: 'RATIO_SCALE_8',
      }),
      Object.freeze({
        name: 'current_position_size',
        dimension: 'POSITION_SIZE',
        inputs: Object.freeze([currentInstrument.toString()]),
        resultMinor: currentInstrument,
        method: 'sum(position.marketValueMinor)',
        precision: 'MONEY_MINOR_UNITS',
      }),
    );

    if (cashAfter < 0n) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit('rlim_structural_cash', 'CASH_RESERVE', 'STRUCTURAL_IMPOSSIBILITY', 'proposed buy exceeds brokerage cash', {
          observedMinor: cashAfter,
        }),
      );
    }

    if (!input.budget.permittedInstrumentClasses.includes(input.proposed.instrumentType)) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_instrument_class',
          'MANDATE_ALIGNMENT',
          'HARD_RISK_LIMIT',
          `instrument class ${input.proposed.instrumentType} is not permitted by the risk budget`,
        ),
      );
    }

    if (!input.budget.allowedCurrencies.includes(input.proposed.currency)) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_currency',
          'CURRENCY_EXPOSURE',
          'HARD_RISK_LIMIT',
          `currency ${input.proposed.currency} is not permitted by the risk budget`,
        ),
      );
    }

    if (ratioCmp(positionRatio, input.budget.maximumInstrumentConcentration) > 0) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_instrument_concentration',
          'INSTRUMENT_CONCENTRATION',
          'HARD_RISK_LIMIT',
          'proposed trade exceeds the engineering single-instrument concentration limit',
          {
            observedRatio: positionRatio,
            limitRatio: input.budget.maximumInstrumentConcentration,
          },
        ),
      );
    }

    if (ratioCmp(classRatio, input.budget.maximumAssetClassConcentration) > 0) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_asset_class',
          'ASSET_CLASS_CONCENTRATION',
          'HARD_RISK_LIMIT',
          'proposed trade exceeds the engineering asset-class concentration limit',
          { observedRatio: classRatio, limitRatio: input.budget.maximumAssetClassConcentration },
        ),
      );
    }

    if (ratioCmp(currencyRatio, input.budget.maximumCurrencyConcentration) > 0) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_currency_concentration',
          'CURRENCY_EXPOSURE',
          'HARD_RISK_LIMIT',
          'proposed trade exceeds the engineering currency concentration limit',
          { observedRatio: currencyRatio, limitRatio: input.budget.maximumCurrencyConcentration },
        ),
      );
    }

    if (ratioCmp(deployment, input.budget.maximumPortfolioDeployment) > 0) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_deployment',
          'PORTFOLIO_CONCENTRATION',
          'HARD_RISK_LIMIT',
          'proposed trade exceeds maximum portfolio deployment',
          { observedRatio: deployment, limitRatio: input.budget.maximumPortfolioDeployment },
        ),
      );
    }

    if (cashAfter < input.budget.minimumBrokerageCashMinor) {
      outcome = escalate(outcome, 'BLOCK');
      triggered.push(
        this.limit(
          'rlim_budget_cash',
          'CASH_RESERVE',
          'HARD_RISK_LIMIT',
          'proposed trade would leave brokerage cash below the risk-budget minimum',
          { observedMinor: cashAfter, limitMinor: input.budget.minimumBrokerageCashMinor },
        ),
      );
    }

    if (mandate) {
      const protectedFloor = mandate.kind === 'KEEP_ALL_LIQUID' ? snapshot.brokerageCashMinor : mandate.minimumLiquidMinor;
      if (cashAfter < protectedFloor) {
        outcome = escalate(outcome, 'BLOCK');
        triggered.push(
          this.limit(
            'rlim_mandate_cash',
            'CASH_RESERVE',
            'HARD_MANDATE_CONSTRAINT',
            'proposed trade would reduce protected liquidity below the active mandate floor',
            { observedMinor: cashAfter, limitMinor: protectedFloor },
          ),
        );
      }
    }

    if (input.proposed.liquidityClass === 'UNKNOWN') {
      outcome = escalate(outcome, 'INSUFFICIENT_DATA');
      stale.push(`liquidity UNKNOWN for ${input.proposed.instrumentId}`);
    } else if (input.proposed.liquidityClass === 'LOW' && input.proposed.notionalMinor > 50_000n) {
      outcome = escalate(outcome, 'REQUIRE_REVIEW');
      triggered.push(
        this.limit(
          'rlim_liquidity',
          'LIQUIDITY',
          'HARD_RISK_LIMIT',
          'LOW fixture liquidity on a material paper order requires review',
        ),
      );
    }

    for (const position of snapshot.positions) {
      const next = qualityOutcome(position.priceQuality, this.stalePolicy);
      if (next) {
        outcome = escalate(outcome, next);
        stale.push(`${position.instrumentId}:${position.priceQuality}`);
        if (position.instrumentId === input.proposed.instrumentId && position.priceQuality === 'STALE') {
          triggered.push(
            this.limit(
              'rlim_stale_price',
              'MARKET_DATA_FRESHNESS',
              'HARD_RISK_LIMIT',
              'stale market data cannot be treated as current',
            ),
          );
        }
      }
    }

    const drawdown = estimateMaxDrawdown(snapshot.observations);
    if (drawdown.sufficient && ratioCmp(drawdown.maxDrawdown, input.budget.drawdownGuard) > 0) {
      outcome = escalate(outcome, 'REQUIRE_REVIEW');
      calculations.push(
        Object.freeze({
          name: 'max_drawdown',
          dimension: 'DRAWDOWN',
          inputs: Object.freeze([String(drawdown.observations)]),
          resultRatio: drawdown.maxDrawdown,
          method: drawdown.method,
          precision: 'RATIO_SCALE_8',
        }),
      );
    }
    const volatility = estimateVolatility(snapshot.observations, String(CANONICAL_RISK_MODEL_VERSION));
    if (!volatility.sufficient && snapshot.observations.length > 0 && snapshot.observations.length < 3) {
      calculations.push(
        Object.freeze({
          name: 'volatility',
          dimension: 'VOLATILITY',
          inputs: Object.freeze([String(snapshot.observations.length)]),
          method: volatility.method,
          precision: 'INSUFFICIENT_DATA',
        }),
      );
    }

    const decision = this.decision(
      { ...input, snapshot },
      outcome,
      triggered,
      calculations,
      stale,
      String(model.modelId),
      String(model.version),
    );
    this.store.putAssessment(decision);
    this.emit('RiskAssessmentCompleted', decision.assessmentId, {
      assessmentId: decision.assessmentId,
      outcome: decision.outcome,
      proposedActionRef: decision.proposedActionRef,
    });
    if (decision.outcome === 'BLOCK') {
      this.emit('RiskLimitBreached', decision.assessmentId, {
        assessmentId: decision.assessmentId,
        triggered: decision.triggeredLimits.map((row) => row.limitId),
      });
    }
    this.evidence?.seal('RISK_ASSESSMENT', {
      assessmentId: decision.assessmentId,
      snapshotId: decision.snapshotId,
      modelId: decision.modelId,
      modelVersion: decision.modelVersion,
      outcome: decision.outcome,
      triggered: decision.triggeredLimits,
      proposedActionRef: decision.proposedActionRef,
    });
    return decision;
  }

  runStress(snapshot: PortfolioRiskSnapshot, scenario: StressScenario): StressRun {
    const budget = this.store.listBudgets().find((row) => row.portfolioId === snapshot.portfolioId);
    const run = runStressScenario({
      snapshot,
      scenario,
      generatedAt: this.clock.now(),
      ...(budget ? { maxLossMinor: budget.maximumSimulatedStressLossMinor } : {}),
    });
    this.store.putRun(run);
    this.emit('RiskStressCompleted', run.runId, {
      runId: run.runId,
      scenarioId: run.scenarioId,
      estimatedLossMinor: run.estimatedLossMinor.toString(),
      mutatesFinancialState: false,
    });
    return run;
  }

  analyzeExtremeGoal(input: {
    readonly goalText: string;
    readonly baselineMinor: bigint;
    readonly targetMinor: bigint;
    readonly intervalDays: bigint;
    readonly budget: RiskBudget;
  }): ExtremeGoalAnalysis {
    return analyzeExtremeGoal({
      ...input,
      maxImpliedGrowth: input.budget.maximumInstrumentConcentration,
    });
  }

  annotateGrowthCandidate(input: {
    readonly candidateRef: string;
    readonly snapshot: PortfolioRiskSnapshot;
    readonly proposed: ProposedPaperTrade;
    readonly budget: RiskBudget;
  }): GrowthRiskAnnotation {
    const decision = this.assessPreTrade({
      snapshot: input.snapshot,
      proposed: input.proposed,
      budget: input.budget,
    });
    return Object.freeze({
      candidateRef: input.candidateRef,
      compatible: decision.outcome === 'ALLOW_SIMULATION',
      outcome: decision.outcome,
      reason:
        decision.triggeredLimits[0]?.message ??
        (decision.outcome === 'ALLOW_SIMULATION' ? 'risk-compatible' : decision.outcome),
    });
  }

  peveContext(decision: RiskDecision): PeveRiskContext {
    return Object.freeze({
      assessmentId: decision.assessmentId,
      outcome: decision.outcome,
      higherRiskIsNotHigherValue: true,
      unrealizedUpsideIsNotRealizedValue: true,
    });
  }

  previewBudgetChange(current: RiskBudget, candidate: RiskBudget): RdtRiskPreview {
    const loosen =
      ratioCmp(candidate.maximumInstrumentConcentration, current.maximumInstrumentConcentration) > 0 ||
      candidate.minimumBrokerageCashMinor < current.minimumBrokerageCashMinor ||
      candidate.maximumSimulatedStressLossMinor > current.maximumSimulatedStressLossMinor;
    return Object.freeze({
      wouldLoosenCurrentLimits: loosen,
      applied: false,
      notes: Object.freeze([
        'RDT may simulate how a candidate policy would affect Risk requirements',
        'RDT cannot change current Risk limits or activate models',
      ]),
    });
  }

  kernelFacts(decision: RiskDecision): InvestmentRiskKernelFacts {
    return Object.freeze({
      assessmentId: decision.assessmentId,
      outcome: decision.outcome,
      triggeredLimitIds: Object.freeze(decision.triggeredLimits.map((row) => row.limitId)),
      modelId: String(decision.modelId),
      modelVersion: String(decision.modelVersion),
      generatedAt: decision.generatedAt,
    });
  }

  private limit(
    id: string,
    dimension: TriggeredLimit['dimension'],
    priority: TriggeredLimit['priority'],
    message: string,
    extras: Partial<Pick<TriggeredLimit, 'observedRatio' | 'limitRatio' | 'observedMinor' | 'limitMinor'>> = {},
  ): TriggeredLimit {
    return Object.freeze({
      limitId: asRiskLimitId(id),
      dimension,
      priority,
      message,
      ...extras,
    });
  }

  private decision(
    input: {
      readonly snapshot: PortfolioRiskSnapshot;
      readonly proposed: ProposedPaperTrade;
      readonly budget: RiskBudget;
    },
    outcome: RiskOutcome,
    triggered: readonly TriggeredLimit[],
    calculations: readonly RiskCalculation[],
    stale: readonly string[],
    modelId = String(CANONICAL_RISK_MODEL_ID),
    modelVersion = String(CANONICAL_RISK_MODEL_VERSION),
  ): RiskDecision {
    const material = JSON.stringify(
      {
        snapshotId: input.snapshot.snapshotId,
        proposed: input.proposed,
        budgetVersion: input.budget.version,
        modelId,
        modelVersion,
        outcome,
        triggered: triggered.map((row) => row.limitId),
      },
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    );
    return Object.freeze({
      assessmentId: asRiskAssessmentId(hashId('ras_', material)),
      decisionId: asPreTradeRiskDecisionId(hashId('prd_', material)),
      snapshotId: input.snapshot.snapshotId,
      proposedActionRef: input.proposed.proposalRef,
      modelId: asRiskModelId(modelId.startsWith('mdl_') ? modelId : `mdl_${modelId}`),
      modelVersion: asRiskModelVersion(modelVersion),
      policyVersion: input.budget.version,
      outcome,
      triggeredLimits: Object.freeze([...triggered]),
      calculations: Object.freeze([...calculations]),
      sourceFacts: Object.freeze([...input.snapshot.sourceRefs, input.proposed.proposalRef]),
      staleOrMissingFacts: Object.freeze([...stale]),
      generatedAt: this.clock.now(),
      guaranteedOutcome: false,
    });
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events?.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'risk',
      aggregateId,
    } as never);
  }
}

export function defaultInstrumentLimits(budget: RiskBudget): readonly RiskLimit[] {
  return Object.freeze([
    Object.freeze({
      limitId: asRiskLimitId('rlim_instrument_concentration'),
      dimension: 'INSTRUMENT_CONCENTRATION' as const,
      priority: 'HARD_RISK_LIMIT' as const,
      maxRatio: budget.maximumInstrumentConcentration,
      engineeringOnly: true as const,
      regulatoryRequirement: false as const,
    }),
  ]);
}
