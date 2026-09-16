import { Money } from '../../../money/src/money.ts';
import type { BindingReasonCode } from './taxonomy.ts';
import type { WorkOrderScope } from './types.ts';

const OK_REASON: BindingReasonCode = 'OK';

export type MaterialChangeResult = {
  readonly material: boolean;
  readonly reasonCodes: readonly BindingReasonCode[];
  readonly dimensions: readonly string[];
};

function setsDiffer<T extends string>(left: readonly T[], right: readonly T[]): boolean {
  if (left.length !== right.length) {
    return true;
  }
  const rightSet = new Set(right);
  return left.some((item) => !rightSet.has(item));
}

export function detectMaterialScopeChange(
  prior: WorkOrderScope,
  next: WorkOrderScope,
): MaterialChangeResult {
  const dimensions: string[] = [];
  const reasonCodes = new Set<BindingReasonCode>();

  if (setsDiffer(prior.objectiveClasses, next.objectiveClasses)) {
    dimensions.push('objectiveClasses');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }
  if (setsDiffer(prior.activityClasses, next.activityClasses)) {
    dimensions.push('activityClasses');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }
  if (setsDiffer(prior.productClasses, next.productClasses)) {
    dimensions.push('productClasses');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }
  if (prior.jurisdiction !== next.jurisdiction) {
    dimensions.push('jurisdiction');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }
  if (setsDiffer(prior.accountIds, next.accountIds)) {
    dimensions.push('accountIds');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }
  if (setsDiffer(prior.toolIds, next.toolIds)) {
    dimensions.push('toolIds');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }

  const priorCeiling = prior.capitalCeiling;
  const nextCeiling = next.capitalCeiling;
  if (priorCeiling && nextCeiling && priorCeiling.currency === nextCeiling.currency) {
    const priorMoney = Money.fromMinorUnitsString(priorCeiling.minorUnits, priorCeiling.currency);
    const nextMoney = Money.fromMinorUnitsString(nextCeiling.minorUnits, nextCeiling.currency);
    if (nextMoney.cmp(priorMoney) > 0) {
      dimensions.push('capitalCeiling');
      reasonCodes.add('MATERIAL_SCOPE_CHANGE');
      reasonCodes.add('CAPITAL_CEILING_EXCEEDED');
    }
  } else if (!priorCeiling && nextCeiling) {
    dimensions.push('capitalCeiling');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }

  const priorHorizon = prior.horizonDays ?? 0;
  const nextHorizon = next.horizonDays ?? 0;
  if (nextHorizon > priorHorizon && nextHorizon - priorHorizon >= 30) {
    dimensions.push('horizonDays');
    reasonCodes.add('MATERIAL_SCOPE_CHANGE');
  }

  return Object.freeze({
    material: dimensions.length > 0,
    reasonCodes: Object.freeze(reasonCodes.size > 0 ? [...reasonCodes] : [OK_REASON]),
    dimensions: Object.freeze(dimensions),
  });
}

export function isHarmlessMetadataChange(
  prior: WorkOrderScope,
  next: WorkOrderScope,
): boolean {
  const material = detectMaterialScopeChange(prior, next);
  return !material.material;
}
