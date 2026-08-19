/**
 * Mass-distance derivation and multi-leg attribution.
 *
 * tonne-km requires mass and distance, or a directly attested tonne-km.
 * Whole-journey plus independently realized legs cannot both take full value.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { sha256Hex } from '../../../../../../security/src/hash.ts';
import {
  exactQuantity,
  integerQuantity,
  reduceRational,
} from '../../../../units/index.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import { parseIntegerMeasure } from './schemas.ts';
import {
  DISTANCE_UNITS,
  LOGISTICS_NORMALIZATION_VERSION,
  MASS_DISTANCE_RULE_ID,
  MASS_UNITS,
  type IntegerMeasure,
  type LogisticsRefusal,
  type LogisticsSourceObservation,
  type MassDistanceDerivationReceipt,
  type TransportLegInput,
} from './types.ts';

const KG_PER_TONNE = 1_000n;
const M_PER_KM = 1_000n;

function massToKgRational(mantissa: bigint, scale: number, unit: string): Result<{ numerator: bigint; denominator: bigint }, LogisticsRefusal> {
  if (!(MASS_UNITS as readonly string[]).includes(unit)) {
    return err({
      code: 'INCOMPATIBLE_UNITS',
      detail: `mass unit ${unit} is not kg or tonne`,
      reviewRequired: false,
    });
  }
  const scaleDen = 10n ** BigInt(scale);
  if (unit === 'kg') {
    return ok(reduceRational(mantissa, scaleDen));
  }
  return ok(reduceRational(mantissa * KG_PER_TONNE, scaleDen));
}

function distanceToMetersRational(
  mantissa: bigint,
  scale: number,
  unit: string,
): Result<{ numerator: bigint; denominator: bigint }, LogisticsRefusal> {
  if (!(DISTANCE_UNITS as readonly string[]).includes(unit)) {
    return err({
      code: 'INCOMPATIBLE_UNITS',
      detail: `distance unit ${unit} is not m or km`,
      reviewRequired: false,
    });
  }
  const scaleDen = 10n ** BigInt(scale);
  if (unit === 'm') {
    return ok(reduceRational(mantissa, scaleDen));
  }
  return ok(reduceRational(mantissa * M_PER_KM, scaleDen));
}

function toExact(unitId: string, numerator: bigint, denominator: bigint): Result<ExactQuantity, LogisticsRefusal> {
  const quantity = exactQuantity({
    mantissa: numerator,
    scale: 0,
    numerator: 1n,
    denominator,
    unitId,
  });
  if (!quantity.ok) {
    return err({
      code: 'INCOMPATIBLE_UNITS',
      detail: quantity.error.detail,
      reviewRequired: false,
    });
  }
  return ok(quantity.value);
}

export function deriveTonneKm(
  mass: IntegerMeasure | undefined,
  distance: IntegerMeasure | undefined,
  attested: IntegerMeasure | undefined,
): Result<MassDistanceDerivationReceipt, LogisticsRefusal> {
  if (attested) {
    if (attested.unit !== 'tonne_km' && attested.unit !== 't_km') {
      return err({
        code: 'INCOMPATIBLE_UNITS',
        detail: `attested freight output must be tonne_km, not ${attested.unit}`,
        reviewRequired: false,
      });
    }
    const parsed = parseIntegerMeasure(attested, 'attested tonne_km');
    if (!parsed.ok) {
      return parsed;
    }
    const quantity = exactQuantity({
      mantissa: parsed.value!.mantissa,
      scale: parsed.value!.scale,
      unitId: 'tonne_km',
    });
    if (!quantity.ok) {
      return err({ code: 'INCOMPATIBLE_UNITS', detail: quantity.error.detail, reviewRequired: false });
    }
    const placeholder = integerQuantity('tonne', 0n);
    return ok(
      Object.freeze({
        receiptId: sha256Hex(`attested:${quantity.value.mantissa}:${quantity.value.scale}`),
        ruleId: MASS_DISTANCE_RULE_ID,
        mass: placeholder.ok ? placeholder.value : quantity.value,
        distance: placeholder.ok ? placeholder.value : quantity.value,
        tonneKm: quantity.value,
        exact: true,
        roundingApplied: false,
        floatingPointUsed: false,
        conversionVersion: LOGISTICS_NORMALIZATION_VERSION,
      }),
    );
  }

  if (!mass && distance) {
    return err({
      code: 'DISTANCE_WITHOUT_MASS',
      detail: 'tonne-km cannot be derived from distance alone',
      reviewRequired: false,
    });
  }
  if (mass && !distance) {
    return err({
      code: 'MASS_WITHOUT_DISTANCE',
      detail: 'tonne-km cannot be derived from mass alone',
      reviewRequired: false,
    });
  }
  if (!mass || !distance) {
    return err({
      code: 'MASS_WITHOUT_DISTANCE',
      detail: 'freight output requires mass and distance, or attested tonne-km',
      reviewRequired: false,
    });
  }

  const parsedMass = parseIntegerMeasure(mass, 'mass');
  if (!parsedMass.ok) {
    return parsedMass;
  }
  const parsedDistance = parseIntegerMeasure(distance, 'distance');
  if (!parsedDistance.ok) {
    return parsedDistance;
  }
  const kg = massToKgRational(parsedMass.value!.mantissa, parsedMass.value!.scale, parsedMass.value!.unit);
  if (!kg.ok) {
    return kg;
  }
  const meters = distanceToMetersRational(
    parsedDistance.value!.mantissa,
    parsedDistance.value!.scale,
    parsedDistance.value!.unit,
  );
  if (!meters.ok) {
    return meters;
  }

  // tonne_km = (kg / 1000) * (m / 1000) = kg * m / 1_000_000
  const product = reduceRational(kg.value.numerator * meters.value.numerator, kg.value.denominator * meters.value.denominator * 1_000_000n);
  const tonneKm = toExact('tonne_km', product.numerator, product.denominator);
  if (!tonneKm.ok) {
    return tonneKm;
  }
  const massExact = toExact(parsedMass.value!.unit === 't' ? 'tonne' : parsedMass.value!.unit, parsedMass.value!.mantissa, 10n ** BigInt(parsedMass.value!.scale));
  const distanceExact = toExact(parsedDistance.value!.unit, parsedDistance.value!.mantissa, 10n ** BigInt(parsedDistance.value!.scale));
  if (!massExact.ok) {
    return massExact;
  }
  if (!distanceExact.ok) {
    return distanceExact;
  }
  return ok(
    Object.freeze({
      receiptId: sha256Hex(
        `${MASS_DISTANCE_RULE_ID}:${massExact.value.mantissa}/${massExact.value.denominator}:${distanceExact.value.mantissa}/${distanceExact.value.denominator}:${tonneKm.value.mantissa}/${tonneKm.value.denominator}`,
      ),
      ruleId: MASS_DISTANCE_RULE_ID,
      mass: massExact.value,
      distance: distanceExact.value,
      tonneKm: tonneKm.value,
      exact: true,
      roundingApplied: false,
      floatingPointUsed: false,
      conversionVersion: LOGISTICS_NORMALIZATION_VERSION,
    }),
  );
}

export type LegAttributionDecision = {
  readonly independentlyRealizedLegs: number;
  readonly wholeJourneyCounted: boolean;
  readonly overlapping: boolean;
  readonly doubleCountRefused: boolean;
};

function legsOverlap(left: TransportLegInput, right: TransportLegInput): boolean {
  return left.startUnix < right.endUnix && right.startUnix < left.endUnix;
}

export function evaluateMultiLeg(
  observation: LogisticsSourceObservation,
): Result<{ receipts: readonly MassDistanceDerivationReceipt[]; attribution: LegAttributionDecision }, LogisticsRefusal> {
  const legs = observation.legs ?? [];
  const realized = legs.filter((leg) => leg.independentlyRealized);
  for (let i = 0; i < realized.length; i += 1) {
    for (let j = i + 1; j < realized.length; j += 1) {
      if (legsOverlap(realized[i]!, realized[j]!)) {
        return err({
          code: 'OVERLAPPING_LEGS',
          detail: `legs ${realized[i]!.legRef} and ${realized[j]!.legRef} overlap and cannot both take full value`,
          reviewRequired: true,
        });
      }
    }
  }

  const whole = observation.countsWholeJourney === true;
  if (whole && realized.length > 0) {
    return err({
      code: 'WHOLE_TRIP_AND_LEGS_DOUBLE_COUNT',
      detail: 'whole journey and independently realized legs cannot be attributed at full value simultaneously',
      reviewRequired: true,
    });
  }

  const receipts: MassDistanceDerivationReceipt[] = [];
  if (legs.length === 0) {
    const single = deriveTonneKm(observation.mass, observation.distance, observation.unit === 'tonne_km' && observation.numericValue
      ? { mantissa: observation.numericValue, scale: 0, unit: 'tonne_km' }
      : undefined);
    if (!single.ok) {
      return single;
    }
    receipts.push(single.value);
  } else {
    for (const leg of realized) {
      const derived = deriveTonneKm(leg.mass, leg.distance, leg.attestedTonneKm);
      if (!derived.ok) {
        return derived;
      }
      receipts.push(derived.value);
    }
  }

  return ok(
    Object.freeze({
      receipts: Object.freeze(receipts),
      attribution: Object.freeze({
        independentlyRealizedLegs: realized.length,
        wholeJourneyCounted: whole && realized.length === 0,
        overlapping: false,
        doubleCountRefused: false,
      }),
    }),
  );
}
