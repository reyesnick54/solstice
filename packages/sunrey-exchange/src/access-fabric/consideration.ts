import type {
  ConsiderationLeg,
  ConsiderationTerms,
  CapacityAccessTerms,
  CapacityMarketConfiguration,
} from './types.ts';
import type { AccessSettlementSemantics, ConsiderationKind } from './taxonomy.ts';

/**
 * Consideration composition.
 *
 * A reservation may carry several consideration legs. Legs are independent:
 * there is no numeraire, no cross-coin rate, and no conversion between SunRey
 * Coin and MoonRey Coin. A mixed-consideration reservation is a set of separate
 * obligations, each denominated in its own unit and settled on its own rail.
 * Entitlement and reward legs are consumed, never transferred or redeemed.
 */
export const NATIVE_COIN_ASSET_IDS = Object.freeze(['SUNREY_COIN', 'MOONREY_COIN'] as const);
export type NativeCoinAssetId = (typeof NATIVE_COIN_ASSET_IDS)[number];

export type ConsiderationValidation = {
  readonly valid: boolean;
  readonly notPermitted: readonly ConsiderationKind[];
  readonly problems: readonly string[];
};

export function considerationKindOf(leg: ConsiderationLeg): ConsiderationKind {
  return leg.kind;
}

export function considerationKinds(legs: readonly ConsiderationLeg[]): readonly ConsiderationKind[] {
  return Object.freeze([...new Set(legs.map(considerationKindOf))]);
}

/**
 * The distinct denominations a reservation owes. Reported side by side; the
 * fabric never reduces them to a single figure, because doing so would require
 * a rate that does not exist.
 */
export function considerationDenominations(
  legs: readonly ConsiderationLeg[],
): readonly { readonly kind: ConsiderationKind; readonly denomination: string; readonly units: bigint }[] {
  return Object.freeze(
    legs.map((leg) => {
      if (leg.kind === 'FIAT') {
        return Object.freeze({
          kind: leg.kind,
          denomination: leg.amount.currency,
          units: leg.amount.minorUnits,
        });
      }
      if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
        return Object.freeze({
          kind: leg.kind,
          denomination: leg.amount.assetId,
          units: leg.amount.scaledUnits,
        });
      }
      if (leg.kind === 'ACCESS_ENTITLEMENT') {
        return Object.freeze({ kind: leg.kind, denomination: leg.unit, units: leg.units });
      }
      return Object.freeze({ kind: leg.kind, denomination: leg.permittedUse, units: leg.units });
    }),
  );
}

/**
 * Compose consideration terms. Refuses a leg whose declared asset is not the
 * canonical native asset id for its kind, which is how a third currency or a
 * renamed coin would otherwise enter.
 */
export function considerationTerms(input: {
  readonly legs: readonly ConsiderationLeg[];
  readonly semantics: AccessSettlementSemantics;
}): ConsiderationTerms {
  if (input.legs.length === 0) {
    throw new TypeError('consideration requires at least one leg');
  }
  for (const leg of input.legs) {
    assertLegShape(leg);
  }
  return Object.freeze({
    legs: Object.freeze([...input.legs]),
    semantics: input.semantics,
    impliedCoinConversion: false,
    commonNumeraire: null,
  });
}

function assertLegShape(leg: ConsiderationLeg): void {
  if (leg.kind === 'FIAT') {
    if (!leg.amount.isPositive()) {
      throw new TypeError('fiat consideration must be positive minor units');
    }
    return;
  }
  if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
    if (leg.amount.assetId !== leg.kind) {
      throw new TypeError(
        `native consideration leg ${leg.kind} must be denominated in ${leg.kind}, not ${leg.amount.assetId}`,
      );
    }
    if (!leg.amount.isPositive()) {
      throw new TypeError('native consideration must be positive scaled units');
    }
    return;
  }
  if (leg.units <= 0n) {
    throw new TypeError('entitlement or reward consideration must consume positive units');
  }
  if (leg.transferable !== false || leg.redeemableForMoney !== false) {
    throw new TypeError('entitlement and reward credit are neither transferable nor redeemable');
  }
}

/**
 * Product configuration decides which consideration kinds a market accepts, and
 * the term sheet narrows that further. Neither can widen the other.
 */
export function permittedConsiderationFor(
  configuration: CapacityMarketConfiguration,
  terms: CapacityAccessTerms,
): readonly ConsiderationKind[] {
  return Object.freeze(
    configuration.permittedConsideration.filter((kind) => terms.permittedConsideration.includes(kind)),
  );
}

export function validateConsideration(input: {
  readonly configuration: CapacityMarketConfiguration;
  readonly terms: CapacityAccessTerms;
  readonly consideration: ConsiderationTerms;
}): ConsiderationValidation {
  const permitted = permittedConsiderationFor(input.configuration, input.terms);
  const notPermitted: ConsiderationKind[] = [];
  const problems: string[] = [];

  for (const kind of considerationKinds(input.consideration.legs)) {
    if (!permitted.includes(kind)) {
      notPermitted.push(kind);
    }
  }
  if (input.consideration.legs.length === 0) {
    problems.push('consideration has no legs');
  }
  if (input.consideration.commonNumeraire !== null) {
    problems.push('consideration must not declare a common numeraire');
  }
  if (input.consideration.impliedCoinConversion !== false) {
    problems.push('consideration must not imply a coin conversion');
  }

  for (const leg of input.consideration.legs) {
    if (leg.kind === 'SUNREY_COIN' || leg.kind === 'MOONREY_COIN') {
      if (leg.amount.assetId !== leg.kind) {
        problems.push(`native leg ${leg.kind} is denominated in ${leg.amount.assetId}`);
      }
      continue;
    }
    if (leg.kind === 'FIAT') {
      continue;
    }
    if (leg.transferable !== false || leg.redeemableForMoney !== false) {
      problems.push(`${leg.kind} must remain non-transferable and non-redeemable`);
    }
  }

  return Object.freeze({
    valid: notPermitted.length === 0 && problems.length === 0,
    notPermitted: Object.freeze([...new Set(notPermitted)]),
    problems: Object.freeze(problems),
  });
}

/**
 * Scale a consideration set to a delivered fraction of the reserved quantity.
 * Integer arithmetic only: the captured part is floored and the remainder is
 * refunded, so captured plus refunded is exactly the reserved amount.
 */
export function prorateConsiderationUnits(input: {
  readonly reservedUnits: bigint;
  readonly reservedQuantity: bigint;
  readonly deliveredQuantity: bigint;
}): { readonly capturedUnits: bigint; readonly remainderUnits: bigint } {
  if (input.reservedQuantity <= 0n) {
    throw new TypeError('reserved quantity must be positive');
  }
  if (input.deliveredQuantity < 0n || input.deliveredQuantity > input.reservedQuantity) {
    throw new TypeError('delivered quantity must be between zero and the reserved quantity');
  }
  const captured = (input.reservedUnits * input.deliveredQuantity) / input.reservedQuantity;
  return { capturedUnits: captured, remainderUnits: input.reservedUnits - captured };
}
