import { Money } from '../../../money/src/money.ts';
import type { SerializedMoney } from '../mandate/types.ts';
import type { BindingReasonCode, ObjectiveClass, ActivityClass, ProductClass } from './taxonomy.ts';
import type { MandatePermittedScope, ScopeNarrowing, WorkOrderScope } from './types.ts';

function intersectSets<T extends string>(requested: readonly T[], permitted: readonly T[]): readonly T[] {
  const allowed = new Set(permitted);
  return Object.freeze(requested.filter((item) => allowed.has(item)));
}

function subtractProhibited<T extends string>(items: readonly T[], prohibited: readonly T[]): readonly T[] {
  const blocked = new Set(prohibited);
  return Object.freeze(items.filter((item) => !blocked.has(item)));
}

function minCapitalCeiling(
  requested: SerializedMoney | null,
  ...ceilings: readonly (SerializedMoney | null)[]
): { readonly ceiling: SerializedMoney | null; readonly narrowed: boolean } {
  if (!requested) {
    return { ceiling: null, narrowed: false };
  }
  let result = Money.fromMinorUnitsString(requested.minorUnits, requested.currency);
  let narrowed = false;
  for (const ceiling of ceilings) {
    if (!ceiling || ceiling.currency !== requested.currency) {
      continue;
    }
    const limit = Money.fromMinorUnitsString(ceiling.minorUnits, ceiling.currency);
    if (result.cmp(limit) > 0) {
      result = limit;
      narrowed = true;
    }
  }
  const serialized = result.toJSON();
  return {
    ceiling: { minorUnits: serialized.minorUnits, currency: serialized.currency },
    narrowed,
  };
}

export type ScopeIntersectionInput = {
  readonly requested: WorkOrderScope;
  readonly mandate: MandatePermittedScope;
  readonly capabilityPermitted: {
    readonly activityClasses: readonly ActivityClass[];
    readonly productClasses: readonly ProductClass[];
    readonly objectiveClasses: readonly ObjectiveClass[];
  };
  readonly approvalPermitted: WorkOrderScope | null;
  readonly platformPermitted: {
    readonly activityClasses: readonly ActivityClass[];
    readonly productClasses: readonly ProductClass[];
    readonly objectiveClasses: readonly ObjectiveClass[];
  };
};

export type ScopeIntersectionResult = {
  readonly effective: WorkOrderScope | null;
  readonly narrowedElements: readonly ScopeNarrowing[];
  readonly blocked: boolean;
  readonly reasonCodes: readonly BindingReasonCode[];
};

export function intersectWorkOrderScope(input: ScopeIntersectionInput): ScopeIntersectionResult {
  const narrowedElements: ScopeNarrowing[] = [];
  const reasonCodes = new Set<BindingReasonCode>();

  const objectiveClasses = intersectSets(input.requested.objectiveClasses, input.mandate.objectiveClasses);
  if (objectiveClasses.length < input.requested.objectiveClasses.length) {
    reasonCodes.add('OBJECTIVE_CLASS_NOT_PERMITTED');
    narrowedElements.push({
      dimension: 'objectiveClasses',
      requested: input.requested.objectiveClasses.join(','),
      allowed: objectiveClasses.join(','),
      reasonCode: 'OBJECTIVE_CLASS_NOT_PERMITTED',
    });
  }

  let activityClasses = intersectSets(objectiveClasses.length > 0 ? input.requested.activityClasses : [], input.mandate.activityClasses);
  activityClasses = intersectSets(activityClasses, input.capabilityPermitted.activityClasses);
  activityClasses = subtractProhibited(activityClasses, input.mandate.prohibitedActivityClasses);
  if (input.approvalPermitted) {
    activityClasses = intersectSets(activityClasses, input.approvalPermitted.activityClasses);
  }
  activityClasses = intersectSets(activityClasses, input.platformPermitted.activityClasses);
  if (activityClasses.length < input.requested.activityClasses.length) {
    reasonCodes.add('ACTIVITY_CLASS_NOT_PERMITTED');
    narrowedElements.push({
      dimension: 'activityClasses',
      requested: input.requested.activityClasses.join(','),
      allowed: activityClasses.join(','),
      reasonCode: 'ACTIVITY_CLASS_NOT_PERMITTED',
    });
  }

  let productClasses = intersectSets(input.requested.productClasses, input.mandate.productClasses);
  productClasses = intersectSets(productClasses, input.capabilityPermitted.productClasses);
  productClasses = subtractProhibited(productClasses, input.mandate.prohibitedProductClasses);
  if (input.approvalPermitted) {
    productClasses = intersectSets(productClasses, input.approvalPermitted.productClasses);
  }
  productClasses = intersectSets(productClasses, input.platformPermitted.productClasses);
  if (productClasses.length < input.requested.productClasses.length) {
    reasonCodes.add('PRODUCT_CLASS_NOT_PERMITTED');
    narrowedElements.push({
      dimension: 'productClasses',
      requested: input.requested.productClasses.join(','),
      allowed: productClasses.join(','),
      reasonCode: 'PRODUCT_CLASS_NOT_PERMITTED',
    });
  }

  const { ceiling: capitalCeiling, narrowed: capitalNarrowed } = minCapitalCeiling(
    input.requested.capitalCeiling,
    input.mandate.capitalCeiling,
    input.approvalPermitted?.capitalCeiling ?? null,
  );
  if (capitalNarrowed) {
    reasonCodes.add('CAPITAL_CEILING_EXCEEDED');
    narrowedElements.push({
      dimension: 'capitalCeiling',
      requested: input.requested.capitalCeiling?.minorUnits ?? 'null',
      allowed: capitalCeiling?.minorUnits ?? 'null',
      reasonCode: 'CAPITAL_CEILING_EXCEEDED',
    });
  }
  const jurisdictionAllowed = input.mandate.jurisdictions.includes(input.requested.jurisdiction);
  if (!jurisdictionAllowed) {
    reasonCodes.add('JURISDICTION_NOT_PERMITTED');
    narrowedElements.push({
      dimension: 'jurisdiction',
      requested: input.requested.jurisdiction,
      allowed: input.mandate.jurisdictions.join(','),
      reasonCode: 'JURISDICTION_NOT_PERMITTED',
    });
  }

  const blocked =
    objectiveClasses.length === 0 ||
    activityClasses.length === 0 ||
    productClasses.length === 0 ||
    !jurisdictionAllowed;

  if (blocked) {
    return Object.freeze({
      effective: null,
      narrowedElements: Object.freeze(narrowedElements),
      blocked: true,
      reasonCodes: Object.freeze([...reasonCodes]),
    });
  }

  const effective: WorkOrderScope = Object.freeze({
    objectiveClasses,
    activityClasses,
    productClasses,
    capitalCeiling,
    accountIds: Object.freeze(
      input.requested.accountIds.filter((id) =>
        input.approvalPermitted ? input.approvalPermitted.accountIds.includes(id) || input.approvalPermitted.accountIds.length === 0 : true,
      ),
    ),
    jurisdiction: input.requested.jurisdiction,
    horizonDays: input.requested.horizonDays,
    toolIds: Object.freeze(
      input.requested.toolIds.filter((id) =>
        input.approvalPermitted ? input.approvalPermitted.toolIds.includes(id) || input.approvalPermitted.toolIds.length === 0 : true,
      ),
    ),
    modelIds: Object.freeze(
      input.requested.modelIds.filter((id) =>
        input.approvalPermitted ? input.approvalPermitted.modelIds.includes(id) || input.approvalPermitted.modelIds.length === 0 : true,
      ),
    ),
  });

  const outcome = narrowedElements.length > 0 ? 'NARROWED' : 'ALLOWED';
  if (outcome === 'NARROWED' && !reasonCodes.has('CAPITAL_CEILING_EXCEEDED')) {
    reasonCodes.add('OK');
  }

  return Object.freeze({
    effective,
    narrowedElements: Object.freeze(narrowedElements),
    blocked: false,
    reasonCodes: Object.freeze(narrowedElements.length > 0 ? [...reasonCodes] : ['OK']),
  });
}

export function scopeHash(scope: WorkOrderScope): string {
  return JSON.stringify({
    objectiveClasses: [...scope.objectiveClasses].sort(),
    activityClasses: [...scope.activityClasses].sort(),
    productClasses: [...scope.productClasses].sort(),
    capitalCeiling: scope.capitalCeiling,
    accountIds: [...scope.accountIds].sort(),
    jurisdiction: scope.jurisdiction,
    horizonDays: scope.horizonDays,
    toolIds: [...scope.toolIds].sort(),
    modelIds: [...scope.modelIds].sort(),
  });
}
