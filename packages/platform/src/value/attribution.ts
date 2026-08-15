import { err, ok, type Result } from '../../../domain/src/result.ts';
import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import {
  asAttributionEntryId,
  asAttributionGroupId,
  attributionEntryIdFor,
  attributionGroupIdFor,
  type AttributionEntryId,
  type AttributionGroupId,
  type AttributionPeriodId,
  type CounterfactualBaselineId,
  type ValuationFormulaVersion,
} from './ids.ts';
import {
  PRINCIPAL_MOVEMENT_REASONS,
  RELATED_ATTRIBUTION_TYPES,
  type AttributionSourceSystem,
  type AttributionType,
  type PrincipalMovementReason,
  type ValueRealizationState,
} from './taxonomy.ts';
import type { AttributionContribution, AttributionEntry, CounterfactualBaseline } from './types.ts';
import type { FactConfidence } from '../../../personal-economic-graph/src/provenance.ts';

export type AttributionFailure = {
  readonly code:
    | 'PRINCIPAL_IS_NOT_GROWTH'
    | 'DOUBLE_COUNT'
    | 'PROJECTED_MIXED_INTO_REALIZED'
    | 'CURRENCY_REQUIRED'
    | 'INVALID_CONTRIBUTION'
    | 'IMMUTABLE_ENTRY';
  readonly message: string;
};

export type RecordAttributionInput = {
  readonly subjectId: string;
  readonly sourceEventId: string;
  readonly sourceKey?: string;
  readonly groupId?: AttributionGroupId;
  readonly periodId?: AttributionPeriodId;
  readonly growthPlanId?: string;
  readonly growthActionId?: string;
  readonly baselineId?: CounterfactualBaselineId;
  readonly observedResult: string;
  readonly amount: SerializedMoney;
  readonly attributionType: AttributionType;
  readonly realization: ValueRealizationState;
  readonly calculationMethod: string;
  readonly confidence: FactConfidence;
  readonly formulaVersion: ValuationFormulaVersion;
  readonly recordedAt: UtcInstant;
  readonly contributions?: readonly AttributionContribution[];
  readonly treatAsDimensionOfGroup?: boolean;
};

function moneyOf(amount: SerializedMoney): Money {
  return Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
}

function relatedTo(type: AttributionType, other: AttributionType): boolean {
  return type === other || RELATED_ATTRIBUTION_TYPES[type].includes(other);
}

function validateContributions(
  contributions: readonly AttributionContribution[],
): Result<void, AttributionFailure> {
  if (contributions.length === 0) {
    return ok(undefined);
  }
  const denominator = contributions[0]?.shareDenominator;
  if (!denominator || denominator <= 0) {
    return err({ code: 'INVALID_CONTRIBUTION', message: 'contribution shares require a positive denominator' });
  }
  let numerator = 0;
  const systems = new Set<AttributionSourceSystem>();
  for (const item of contributions) {
    if (item.shareDenominator !== denominator || item.shareNumerator < 0) {
      return err({ code: 'INVALID_CONTRIBUTION', message: 'contribution shares must use one denominator' });
    }
    if (systems.has(item.system)) {
      return err({ code: 'INVALID_CONTRIBUTION', message: 'duplicate source system in contribution split' });
    }
    systems.add(item.system);
    numerator += item.shareNumerator;
  }
  if (numerator !== denominator) {
    return err({
      code: 'INVALID_CONTRIBUTION',
      message: 'contribution numerators must sum to the shared denominator; do not invent false causal certainty',
    });
  }
  return ok(undefined);
}

/**
 * Append-only economic-benefit attribution ledger owned by PEVE.
 *
 * This is not the financial ledger. It cannot move principal or post journals.
 * The banking `packages/ledger` GrowthAttributionLedger remains the
 * principal-movement guard used by accounts.
 */
export class GrowthAttributionLedger {
  private readonly entries: AttributionEntry[] = [];
  private readonly groups = new Map<string, AttributionGroupId>();

  skipPrincipalMovement(reason: PrincipalMovementReason): void {
    if (!(PRINCIPAL_MOVEMENT_REASONS as readonly string[]).includes(reason)) {
      throw new Error('growth skip requires an explicit principal-movement reason');
    }
  }

  record(input: RecordAttributionInput): Result<AttributionEntry, AttributionFailure> {
    if (input.amount.currency.length !== 3) {
      return err({ code: 'CURRENCY_REQUIRED', message: 'attribution requires a currency-separated money amount' });
    }
    moneyOf(input.amount);
    const sourceKey = input.sourceKey ?? input.sourceEventId;
    const groupId = input.groupId ?? this.groups.get(sourceKey) ?? attributionGroupIdFor(sourceKey);
    const existing = this.entries.filter((item) => item.subjectId === input.subjectId);
    const sameSource = existing.filter((item) => item.sourceKey === sourceKey || item.sourceEventId === input.sourceEventId);
    const sameGroup = existing.filter((item) => item.groupId === groupId);
    const realizedLike = input.realization === 'REALIZED' || input.realization === 'OBSERVED';

    for (const prior of sameSource) {
      if (prior.realization === input.realization && prior.attributionType === input.attributionType) {
        return err({
          code: 'DOUBLE_COUNT',
          message: `source ${sourceKey} already has a ${input.realization} ${input.attributionType} entry`,
        });
      }
      if (
        realizedLike &&
        (prior.realization === 'REALIZED' || prior.realization === 'OBSERVED') &&
        relatedTo(prior.attributionType, input.attributionType) &&
        !input.treatAsDimensionOfGroup
      ) {
        return err({
          code: 'DOUBLE_COUNT',
          message:
            `source ${sourceKey} already realized ${prior.attributionType}; ` +
            `${input.attributionType} is the same benefit unless recorded as a dimension of group ${prior.groupId}`,
        });
      }
    }

    if (input.treatAsDimensionOfGroup && sameGroup.length === 0 && sameSource.length === 0) {
      return err({
        code: 'DOUBLE_COUNT',
        message: 'dimension-of-group recording requires an existing attribution group',
      });
    }

    const contributions = input.contributions ?? Object.freeze([]);
    const contributionCheck = validateContributions(contributions);
    if (!contributionCheck.ok) {
      return contributionCheck;
    }

    const isPrimaryForGroup = !input.treatAsDimensionOfGroup;
    const entryId = attributionEntryIdFor(
      `${sourceKey}_${input.attributionType}_${input.realization}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      input.realization,
    );
    const entry: AttributionEntry = Object.freeze({
      entryId: asAttributionEntryId(entryId),
      subjectId: input.subjectId,
      groupId: asAttributionGroupId(groupId),
      ...(input.periodId ? { periodId: input.periodId } : {}),
      sourceEventId: input.sourceEventId,
      sourceKey,
      ...(input.growthPlanId ? { growthPlanId: input.growthPlanId } : {}),
      ...(input.growthActionId ? { growthActionId: input.growthActionId } : {}),
      ...(input.baselineId ? { baselineId: input.baselineId } : {}),
      observedResult: input.observedResult,
      amount: input.amount,
      attributionType: input.attributionType,
      realization: input.realization,
      calculationMethod: input.calculationMethod,
      confidence: input.confidence,
      formulaVersion: input.formulaVersion,
      recordedAt: input.recordedAt,
      contributions: Object.freeze([...contributions]),
      isPrimaryForGroup,
      principalMovement: false,
      postsJournal: false,
    });
    this.entries.push(entry);
    this.groups.set(sourceKey, entry.groupId);
    return ok(entry);
  }

  list(subjectId?: string): readonly AttributionEntry[] {
    const rows = subjectId ? this.entries.filter((item) => item.subjectId === subjectId) : this.entries;
    return Object.freeze([...rows]);
  }

  realizedTotal(subjectId: string, currency: string): SerializedMoney {
    return this.total(subjectId, currency, ['REALIZED', 'OBSERVED']);
  }

  projectedTotal(subjectId: string, currency: string): SerializedMoney {
    return this.total(subjectId, currency, ['PROJECTED', 'ESTIMATED', 'COUNTERFACTUAL']);
  }

  private total(
    subjectId: string,
    currency: string,
    realizations: readonly ValueRealizationState[],
  ): SerializedMoney {
    const sum = this.entries
      .filter(
        (item) =>
          item.subjectId === subjectId &&
          item.amount.currency === currency &&
          item.isPrimaryForGroup &&
          realizations.includes(item.realization),
      )
      .reduce((acc, item) => acc.plus(moneyOf(item.amount)), Money.zero(currency));
    return sum.toJSON();
  }

  count(): number {
    return this.entries.length;
  }

  load(entries: readonly AttributionEntry[]): void {
    this.entries.length = 0;
    this.groups.clear();
    for (const entry of entries) {
      this.entries.push(entry);
      this.groups.set(entry.sourceKey, entry.groupId);
    }
  }
}

export function freezeBaseline(baseline: CounterfactualBaseline): CounterfactualBaseline {
  if (baseline.guaranteed !== false) {
    throw new Error('counterfactual savings must never be presented as guaranteed');
  }
  return Object.freeze({
    ...baseline,
    assumptions: Object.freeze([...baseline.assumptions]),
    sourceFacts: Object.freeze([...baseline.sourceFacts]),
    guaranteed: false,
    survivesRebuild: true,
  });
}
