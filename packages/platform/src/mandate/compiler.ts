import type { AgentMandateInterpretation } from '../../../agent/src/interpretation.ts';
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import {
  asMandateVersion,
  constraintIdFor,
  draftIdForSubject,
  goalIdFor,
  mandateIdForSubject,
} from '../ids.ts';
import { detectMandateConflicts } from './conflicts.ts';
import type {
  CompiledEconomicMandate,
  CompilerIssue,
  HardConstraint,
  MandateCompileFailure,
  MandateDraft,
  MandateGoal,
  SoftPreference,
} from './types.ts';

const KNOWN_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'SAR', 'AED']);

export type ProductCapabilityFacts = {
  readonly supportedCurrencies: readonly string[];
  readonly investmentExecutionImplemented: false;
};

export type CompilerInput = {
  readonly draft: MandateDraft;
  readonly peg?: PersonalEconomicSnapshot;
  readonly productCapabilities?: ProductCapabilityFacts;
  readonly now: UtcInstant;
  readonly version?: number;
};

function parseAmount(amount: { readonly minorUnits: string; readonly currency: string }): Result<Money, CompilerIssue> {
  if (!KNOWN_CURRENCIES.has(amount.currency)) {
    return err({ code: 'INVALID_CURRENCY', message: `unsupported currency ${amount.currency}` });
  }
  try {
    const money = Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
    if (money.isNegative()) {
      return err({ code: 'IMPOSSIBLE_VALUE', message: 'money amount cannot be negative' });
    }
    return ok(money);
  } catch (error) {
    return err({
      code: 'INVALID_LIMIT',
      message: error instanceof Error ? error.message : 'invalid money',
    });
  }
}

export function mandateDraftFromInterpretation(
  interpretation: AgentMandateInterpretation,
  now: UtcInstant,
  version = 1,
): MandateDraft {
  const goals: MandateGoal[] = interpretation.goals.map((goal, index) => ({
    goalId: goalIdFor(goal.kind, `${interpretation.subjectId}_${String(index)}`),
    kind: goal.kind,
    label: goal.label,
    priority: goal.priority,
    ...(goal.target ? { target: goal.target } : {}),
    ...(goal.baseline ? { baseline: goal.baseline } : {}),
    ...(goal.timeHorizonDays !== undefined
      ? { timeHorizon: { kind: 'DURATION_DAYS', days: goal.timeHorizonDays } }
      : {}),
    currency: goal.currency,
    status: 'DRAFT',
    source: 'AGENT',
    userConfirmationState: 'UNCONFIRMED',
  }));
  const hardConstraints: HardConstraint[] = interpretation.hardConstraints.map((item, index) => ({
    constraintId: constraintIdFor(item.kind, `${interpretation.subjectId}_${String(index)}`),
    kind: item.kind,
    ...(item.amount ? { amount: item.amount } : {}),
    ...(item.categories ? { categories: item.categories } : {}),
    ...(item.metadata ? { metadata: item.metadata } : {}),
    overrideForbidden: true,
  }));
  const softPreferences: SoftPreference[] = interpretation.softPreferences.map((item) => ({
    kind: item.kind,
    weight: 1,
  }));
  return Object.freeze({
    draftId: draftIdForSubject(interpretation.subjectId, version),
    subjectId: interpretation.subjectId,
    sourceText: interpretation.sourceText,
    source: 'AGENT_INTERPRETATION',
    interpretationId: interpretation.interpretationId,
    currency: interpretation.currency,
    goals: Object.freeze(goals),
    hardConstraints: Object.freeze(hardConstraints),
    softPreferences: Object.freeze(softPreferences),
    createdAt: now,
    modelTextIsPolicy: false,
  });
}

export function compileEconomicMandate(
  input: CompilerInput,
): Result<CompiledEconomicMandate, MandateCompileFailure> {
  const issues: CompilerIssue[] = [];
  const draft = input.draft;
  if (!KNOWN_CURRENCIES.has(draft.currency)) {
    issues.push({ code: 'INVALID_CURRENCY', message: `unsupported mandate currency ${draft.currency}` });
  }
  if (draft.goals.length === 0) {
    issues.push({ code: 'MISSING_GOALS', message: 'a compiled mandate requires at least one goal' });
  }
  for (const goal of draft.goals) {
    if (goal.target) {
      const parsed = parseAmount(goal.target);
      if (!parsed.ok) {
        issues.push(parsed.error);
      } else if (goal.currency !== goal.target.currency) {
        issues.push({
          code: 'INVALID_CURRENCY',
          message: `goal ${goal.label} currency ${goal.currency} does not match target ${goal.target.currency}`,
        });
      }
    }
    if (goal.timeHorizon?.kind === 'DURATION_DAYS' && (goal.timeHorizon.days ?? 0) <= 0) {
      issues.push({ code: 'IMPOSSIBLE_VALUE', message: `goal ${goal.label} has a non-positive horizon` });
    }
  }
  for (const constraint of draft.hardConstraints) {
    if (constraint.amount) {
      const parsed = parseAmount(constraint.amount);
      if (!parsed.ok) {
        issues.push(parsed.error);
      }
    }
    if (constraint.kind === 'TIME_HORIZON' && (constraint.days ?? 0) <= 0) {
      issues.push({ code: 'IMPOSSIBLE_VALUE', message: 'time horizon must be a positive day count' });
    }
  }
  issues.push(...detectMandateConflicts(draft.hardConstraints));

  if (input.peg && input.peg.generatedAt < draft.createdAt && input.peg.income.length === 0) {
    issues.push({ code: 'EXPIRED_FACTS', message: 'PEG snapshot has no current income facts' });
  }
  const products = input.productCapabilities ?? {
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'SAR', 'AED'],
    investmentExecutionImplemented: false,
  };
  if (!products.supportedCurrencies.includes(draft.currency)) {
    issues.push({
      code: 'UNSUPPORTED_PRODUCT',
      message: `currency ${draft.currency} is not a supported product capability`,
    });
  }
  if (draft.source === 'AGENT_INTERPRETATION' && draft.modelTextIsPolicy !== false) {
    issues.push({
      code: 'AMBIGUOUS_PERMISSIONS',
      message: 'agent text cannot be treated as executable policy',
    });
  }

  const unique = new Map<string, CompilerIssue>();
  for (const issue of issues) {
    unique.set(`${issue.code}:${issue.message}`, issue);
  }
  const collected = [...unique.values()];
  if (collected.length > 0) {
    return err({ code: 'MANDATE_INVALID', issues: Object.freeze(collected) });
  }

  const version = asMandateVersion(input.version ?? 1);
  const compiled: CompiledEconomicMandate = Object.freeze({
    mandateId: mandateIdForSubject(draft.subjectId),
    version,
    subjectId: draft.subjectId,
    state: 'DRAFT',
    sourceText: draft.sourceText,
    currency: draft.currency,
    goals: Object.freeze(draft.goals.map((goal) => Object.freeze({ ...goal }))),
    hardConstraints: Object.freeze(draft.hardConstraints.map((item) => Object.freeze({ ...item }))),
    softPreferences: Object.freeze(draft.softPreferences.map((item) => Object.freeze({ ...item }))),
    compiledAt: input.now,
    planningEligible: false,
  });
  return ok(compiled);
}
