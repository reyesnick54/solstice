import type { SerializedMoney } from '../mandate/types.ts';
import type { EffectKind, RiskClass } from './taxonomy.ts';

export type DeterministicEffect = {
  readonly kind: 'DETERMINISTIC_EFFECT';
  readonly amount: SerializedMoney;
  readonly description: string;
};

export type EstimatedEffect = {
  readonly kind: 'ESTIMATED_EFFECT';
  readonly low: SerializedMoney;
  readonly high: SerializedMoney;
  readonly assumptions: readonly string[];
  readonly confidenceScore: number;
  readonly horizonDays: number;
};

export type UncertainMarketOutcome = {
  readonly kind: 'UNCERTAIN_MARKET_OUTCOME';
  readonly scenario: string;
  readonly low: SerializedMoney;
  readonly high: SerializedMoney;
  readonly assumptions: readonly string[];
  readonly confidenceScore: number;
  readonly horizonDays: number;
  readonly riskClass: RiskClass;
  readonly achievementPromised: false;
};

export type EconomicEffect = DeterministicEffect | EstimatedEffect | UncertainMarketOutcome;

export function isDeterministicEffect(effect: EconomicEffect): effect is DeterministicEffect {
  return effect.kind === 'DETERMINISTIC_EFFECT';
}

export function assertNoGuaranteedReturn(effect: EconomicEffect): void {
  if (effect.kind === 'UNCERTAIN_MARKET_OUTCOME' && effect.achievementPromised !== false) {
    throw new Error('uncertain market outcomes must not promise achievement');
  }
}

export function effectKindOf(effect: EconomicEffect): EffectKind {
  return effect.kind;
}
