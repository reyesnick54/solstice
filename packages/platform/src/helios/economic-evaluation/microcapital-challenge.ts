import type { UtcInstant } from '../../../../domain/src/time.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { microcapitalChallengeIdFor, type HeliosExperimentId, type HeliosMicrocapitalChallengeId } from './ids.ts';
import { evaluationMoney } from './money.ts';
import { MICROCAPITAL_DEFAULTS } from './taxonomy.ts';
import type { FrozenExperimentSpec, MicrocapitalChallengeSpec, RiskLimitSpec } from './types.ts';
import type { BenchmarkKind } from './taxonomy.ts';

const TRACK_A_RULES = Object.freeze([
  'Fixed starting investment capital; no additional deposits.',
  'All execution costs included in net result.',
  'Realized and unrealized distinctions preserved.',
  'Declared benchmark and risk limits immutable during challenge.',
  'Cash, drawdown, and realizable net value tracked.',
  'Deposits are not performance.',
]);

const TRACK_B_RULES = Object.freeze([
  'Track B measures genuine paid economic activity only.',
  'Revenue, delivery cost, platform cost, and research cost tracked separately.',
  'Track B net economic value must not be labeled as investment P&L.',
  'Only actual supported/paid activities may be recorded.',
]);

export function buildMicrocapitalChallenge(input: {
  readonly experiment: FrozenExperimentSpec;
  readonly now: UtcInstant;
  readonly challengeId?: HeliosMicrocapitalChallengeId;
  readonly startingCapitalMinor?: string;
  readonly targetCapitalMinor?: string;
  readonly horizonDays?: number;
  readonly riskLimits?: RiskLimitSpec;
  readonly benchmarkKind?: BenchmarkKind;
  readonly benchmarkMethodology?: string;
  readonly allowedStrategyClasses?: readonly string[];
  readonly allowedEconomicActivities?: readonly string[];
  readonly researchBudgetMinor?: string;
  readonly operationalSubsidyMinor?: string;
  readonly stopConditions?: readonly string[];
}): MicrocapitalChallengeSpec {
  const currency = input.experiment.capital.currency;
  return Object.freeze({
    schema: 'sunrey.helios.microcapital-challenge.v1',
    challengeId: input.challengeId ?? microcapitalChallengeIdFor(),
    experimentId: input.experiment.experimentId,
    startingCapital: evaluationMoney(
      input.startingCapitalMinor ?? MICROCAPITAL_DEFAULTS.startingCapitalMinor,
      currency,
    ),
    targetCapital: evaluationMoney(
      input.targetCapitalMinor ?? MICROCAPITAL_DEFAULTS.targetCapitalMinor,
      currency,
    ),
    targetIsExperimentOnly: true,
    notGuaranteed: true,
    notCustomerFacing: true,
    horizonDays: input.horizonDays ?? MICROCAPITAL_DEFAULTS.horizonDays,
    riskLimits: input.riskLimits ?? input.experiment.riskLimits,
    benchmark: Object.freeze({
      kind: input.benchmarkKind ?? input.experiment.benchmark.kind,
      methodology: input.benchmarkMethodology ?? input.experiment.benchmark.methodology,
    }),
    allowedStrategyClasses: Object.freeze(
      input.allowedStrategyClasses ?? Object.freeze(['PAPER_GROW', 'SHADOW', 'PROVIDER_SANDBOX']),
    ),
    allowedEconomicActivities: Object.freeze(
      input.allowedEconomicActivities ?? Object.freeze(['INVESTMENT_EXECUTION']),
    ),
    researchBudget: evaluationMoney(
      input.researchBudgetMinor ?? input.experiment.researchBudget.minorUnits,
      currency,
    ),
    operationalSubsidyMinor: input.operationalSubsidyMinor ?? '0',
    costSchedule: Object.freeze([]),
    stopConditions: Object.freeze(
      input.stopConditions ?? Object.freeze([
        'Max drawdown breached',
        'Risk limit violation',
        'Horizon elapsed',
        'Manual abort',
        'Hidden capital detected',
      ]),
    ),
    trackARules: TRACK_A_RULES,
    trackBRules: TRACK_B_RULES,
    catchUpModeForbidden: true,
    frozenAt: input.now,
  });
}

export function assertRiskLimitsImmutable(input: {
  readonly original: RiskLimitSpec;
  readonly proposed: RiskLimitSpec;
  readonly challengeBehindSchedule: boolean;
}): Result<true, string> {
  const same =
    input.original.maxLeverageNumerator === input.proposed.maxLeverageNumerator &&
    input.original.maxLeverageDenominator === input.proposed.maxLeverageDenominator &&
    input.original.maxConcentrationBps === input.proposed.maxConcentrationBps &&
    input.original.maxDrawdownBps === input.proposed.maxDrawdownBps &&
    input.original.complianceProfile === input.proposed.complianceProfile &&
    JSON.stringify(input.original.allowedAssetClasses) ===
      JSON.stringify(input.proposed.allowedAssetClasses);
  if (!same) {
    if (input.challengeBehindSchedule) {
      return err('catch-up mode forbidden: risk limits cannot be loosened when challenge is behind schedule');
    }
    return err('risk limit mutation rejected after challenge freeze');
  }
  return ok(true);
}

export function bindChallengeToExperiment(
  experiment: FrozenExperimentSpec,
  challengeId: HeliosMicrocapitalChallengeId,
): FrozenExperimentSpec {
  return Object.freeze({
    ...experiment,
    microcapitalChallengeId: challengeId,
  });
}

export function challengeProgressBps(input: {
  readonly startingMinor: string;
  readonly currentMinor: string;
  readonly targetMinor: string;
}): number {
  const start = BigInt(input.startingMinor);
  const current = BigInt(input.currentMinor);
  const target = BigInt(input.targetMinor);
  if (target <= start) {
    return 0;
  }
  const progress = ((current - start) * 10_000n) / (target - start);
  return Number(progress > 10_000n ? 10_000n : progress < 0n ? 0n : progress);
}
