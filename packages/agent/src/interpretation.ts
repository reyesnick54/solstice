import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { deterministicInterpretationId } from './ids.ts';
import type { AgentInterpretationId } from './ids.ts';

export const INTERPRETED_GOAL_KINDS = [
  'BUILD_EMERGENCY_RESERVE',
  'REDUCE_DEBT',
  'SAVE_FOR_HOME',
  'INCREASE_MONTHLY_SURPLUS',
  'REDUCE_UNNECESSARY_FEES',
  'IMPROVE_REWARD_CAPTURE',
  'INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER',
  'MAINTAIN_TARGET_LIQUIDITY',
  'AGGRESSIVE_SHORT_HORIZON_GROWTH',
  'OTHER',
] as const;

export type InterpretedGoalKind = (typeof INTERPRETED_GOAL_KINDS)[number];

export const INTERPRETED_CONSTRAINT_KINDS = [
  'MINIMUM_CASH_RESERVE',
  'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR',
  'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT',
  'REQUIRED_CONFIRMATION_THRESHOLD',
  'PROHIBITED_ASSET_CATEGORIES',
  'RISK_PREFERENCE_METADATA',
  'INVEST_ALL_AVAILABLE_IMMEDIATELY',
  'KEEP_ALL_LIQUID',
] as const;

export type InterpretedConstraintKind = (typeof INTERPRETED_CONSTRAINT_KINDS)[number];

export const INTERPRETED_PREFERENCE_KINDS = [
  'PREFER_LIQUIDITY',
  'PREFER_DEBT_REDUCTION',
  'PREFER_LOWER_FEES',
  'PREFER_SIMPLER_PLAN',
  'PREFER_FASTER_GOAL_ACHIEVEMENT',
  'PREFER_LOWER_VOLATILITY_LATER',
] as const;

export type InterpretedPreferenceKind = (typeof INTERPRETED_PREFERENCE_KINDS)[number];

export type InterpretedMoney = {
  readonly minorUnits: string;
  readonly currency: string;
};

export type InterpretedGoal = {
  readonly kind: InterpretedGoalKind;
  readonly label: string;
  readonly priority: number;
  readonly target?: InterpretedMoney;
  readonly baseline?: InterpretedMoney;
  readonly timeHorizonDays?: number;
  readonly currency: string;
};

export type InterpretedConstraint = {
  readonly kind: InterpretedConstraintKind;
  readonly amount?: InterpretedMoney;
  readonly categories?: readonly string[];
  readonly metadata?: string;
};

export type InterpretedPreference = {
  readonly kind: InterpretedPreferenceKind;
};

export type AgentMandateInterpretation = {
  readonly interpretationId: AgentInterpretationId;
  readonly subjectId: string;
  readonly sourceText: string;
  readonly currency: string;
  readonly goals: readonly InterpretedGoal[];
  readonly hardConstraints: readonly InterpretedConstraint[];
  readonly softPreferences: readonly InterpretedPreference[];
  readonly executable: false;
  readonly modelTextIsPolicy: false;
  readonly createdAt: UtcInstant;
};

export type InterpretationFailure = {
  readonly code: 'EMPTY_LANGUAGE' | 'UNPARSEABLE_AMOUNT';
  readonly message: string;
};

function dollarsToMinor(raw: string): Result<bigint, InterpretationFailure> {
  const digits = raw.replace(/,/g, '');
  if (!/^\d+$/.test(digits)) {
    return err({ code: 'UNPARSEABLE_AMOUNT', message: `cannot parse amount ${raw}` });
  }
  return ok(BigInt(digits) * 100n);
}

function money(minor: bigint, currency: string): InterpretedMoney {
  return { minorUnits: minor.toString(), currency };
}

function addUniquePreference(soft: InterpretedPreference[], kind: InterpretedPreferenceKind): void {
  if (!soft.some((item) => item.kind === kind)) {
    soft.push({ kind });
  }
}

export function interpretMandateLanguage(input: {
  readonly subjectId: string;
  readonly sourceText: string;
  readonly currency?: string;
  readonly now: UtcInstant;
  readonly version?: number;
}): Result<AgentMandateInterpretation, InterpretationFailure> {
  const text = input.sourceText.trim();
  if (text.length === 0) {
    return err({ code: 'EMPTY_LANGUAGE', message: 'mandate language is empty' });
  }
  const currency = input.currency ?? 'USD';
  const lower = text.toLowerCase();
  const goals: InterpretedGoal[] = [];
  const hard: InterpretedConstraint[] = [];
  const soft: InterpretedPreference[] = [];

  const aggressive = /\$([0-9][0-9,]*)\s+to become\s+\$([0-9][0-9,]*)/i.exec(text);
  if (aggressive) {
    const from = dollarsToMinor(aggressive[1]!);
    const to = dollarsToMinor(aggressive[2]!);
    if (!from.ok) {
      return from;
    }
    if (!to.ok) {
      return to;
    }
    const horizon = /next week|in one week|in 1 week|within a week/i.test(text) ? 7 : undefined;
    goals.push({
      kind: 'AGGRESSIVE_SHORT_HORIZON_GROWTH',
      label: `Grow $${aggressive[1]} to $${aggressive[2]}`,
      priority: 1,
      target: money(to.value, currency),
      baseline: money(from.value, currency),
      ...(horizon !== undefined ? { timeHorizonDays: horizon } : {}),
      currency,
    });
    addUniquePreference(soft, 'PREFER_FASTER_GOAL_ACHIEVEMENT');
  }

  const keepAtLeast = /keep (?:at least )?\$([0-9][0-9,]*) (?:liquid|cash available|cash)/i.exec(text);
  if (keepAtLeast) {
    const amount = dollarsToMinor(keepAtLeast[1]!);
    if (!amount.ok) {
      return amount;
    }
    hard.push({ kind: 'MINIMUM_CASH_RESERVE', amount: money(amount.value, currency) });
    hard.push({ kind: 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR', amount: money(amount.value, currency) });
    goals.push({
      kind: 'MAINTAIN_TARGET_LIQUIDITY',
      label: `Keep at least $${keepAtLeast[1]} liquid`,
      priority: 1,
      target: money(amount.value, currency),
      currency,
    });
    addUniquePreference(soft, 'PREFER_LIQUIDITY');
  }

  const keepAll = /keep all \$([0-9][0-9,]*) liquid/i.exec(text);
  if (keepAll) {
    const amount = dollarsToMinor(keepAll[1]!);
    if (!amount.ok) {
      return amount;
    }
    hard.push({ kind: 'KEEP_ALL_LIQUID', amount: money(amount.value, currency) });
    hard.push({ kind: 'MINIMUM_CASH_RESERVE', amount: money(amount.value, currency) });
    hard.push({ kind: 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR', amount: money(amount.value, currency) });
    addUniquePreference(soft, 'PREFER_LIQUIDITY');
  }

  const investAll = /invest all \$([0-9][0-9,]*) immediately/i.exec(text);
  if (investAll) {
    const amount = dollarsToMinor(investAll[1]!);
    if (!amount.ok) {
      return amount;
    }
    hard.push({ kind: 'INVEST_ALL_AVAILABLE_IMMEDIATELY', amount: money(amount.value, currency) });
  }

  const emergency = /emergency fund(?:s)?(?: to)? \$([0-9][0-9,]*)/i.exec(text);
  if (emergency) {
    const amount = dollarsToMinor(emergency[1]!);
    if (!amount.ok) {
      return amount;
    }
    goals.push({
      kind: 'BUILD_EMERGENCY_RESERVE',
      label: `Build emergency fund to $${emergency[1]}`,
      priority: 2,
      target: money(amount.value, currency),
      currency,
    });
    addUniquePreference(soft, 'PREFER_LIQUIDITY');
  } else if (/emergency fund/i.test(text)) {
    goals.push({
      kind: 'BUILD_EMERGENCY_RESERVE',
      label: 'Build emergency fund',
      priority: 2,
      currency,
    });
  }

  if (/reduce (?:expensive )?debt|pay down .{0,40}debt/i.test(text)) {
    goals.push({
      kind: 'REDUCE_DEBT',
      label: 'Reduce expensive debt',
      priority: 3,
      currency,
    });
    addUniquePreference(soft, 'PREFER_DEBT_REDUCTION');
  }

  if (/save for (?:a )?home|home purchase/i.test(text)) {
    goals.push({
      kind: 'SAVE_FOR_HOME',
      label: 'Save for home',
      priority: 4,
      currency,
    });
  }

  if (/increase monthly surplus/i.test(text)) {
    goals.push({
      kind: 'INCREASE_MONTHLY_SURPLUS',
      label: 'Increase monthly surplus',
      priority: 5,
      currency,
    });
  }

  if (/reduce (?:unnecessary )?fees|lower fees/i.test(text)) {
    goals.push({
      kind: 'REDUCE_UNNECESSARY_FEES',
      label: 'Reduce unnecessary fees',
      priority: 6,
      currency,
    });
    addUniquePreference(soft, 'PREFER_LOWER_FEES');
  }

  if (/reward capture|improve rewards/i.test(text)) {
    goals.push({
      kind: 'IMPROVE_REWARD_CAPTURE',
      label: 'Improve reward capture',
      priority: 7,
      currency,
    });
  }

  if (/grow the rest|invest eligible|long-term surplus/i.test(text)) {
    goals.push({
      kind: 'INVEST_ELIGIBLE_LONG_TERM_SURPLUS_LATER',
      label: 'Invest eligible long-term surplus later',
      priority: 8,
      currency,
    });
  }

  if (/high-risk|extreme risk|do not make high-risk/i.test(lower)) {
    hard.push({
      kind: 'PROHIBITED_ASSET_CATEGORIES',
      categories: Object.freeze(['HIGH_RISK', 'EXTREME_RISK']),
    });
    hard.push({
      kind: 'RISK_PREFERENCE_METADATA',
      metadata: 'NO_HIGH_RISK_INVESTMENTS',
    });
    addUniquePreference(soft, 'PREFER_LOWER_VOLATILITY_LATER');
  }

  const confirm = /(?:ask me|confirm) before any (?:movement|action) over \$([0-9][0-9,]*)/i.exec(text);
  if (confirm) {
    const amount = dollarsToMinor(confirm[1]!);
    if (!amount.ok) {
      return amount;
    }
    hard.push({
      kind: 'REQUIRED_CONFIRMATION_THRESHOLD',
      amount: money(amount.value, currency),
    });
  }

  const neverMore = /never (?:propose|move|spend) more than \$([0-9][0-9,]*)/i.exec(text);
  if (neverMore) {
    const amount = dollarsToMinor(neverMore[1]!);
    if (!amount.ok) {
      return amount;
    }
    hard.push({
      kind: 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT',
      amount: money(amount.value, currency),
    });
  }

  if (/simpler plan|keep it simple/i.test(text)) {
    addUniquePreference(soft, 'PREFER_SIMPLER_PLAN');
  }

  return ok(
    Object.freeze({
      interpretationId: deterministicInterpretationId(input.subjectId, input.version ?? 1),
      subjectId: input.subjectId,
      sourceText: text,
      currency,
      goals: Object.freeze(goals),
      hardConstraints: Object.freeze(hard),
      softPreferences: Object.freeze(soft),
      executable: false,
      modelTextIsPolicy: false,
      createdAt: input.now,
    }),
  );
}
