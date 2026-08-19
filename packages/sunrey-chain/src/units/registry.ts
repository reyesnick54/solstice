/**
 * Canonical economic UnitRegistry.
 *
 * Chunk 43 owns the protocol unit contract. This class is the single
 * Chunk 118 normalization authority inside packages/sunrey-chain.
 * packages/sunrey-chain/src/productive/units.ts remains a category-scoped
 * compatibility facade and does not claim this authority.
 */

import { err, type Result } from '../../../domain/src/result.ts';
import { CANONICAL_UNIT_REGISTRY_ID, NORMALIZATION_CONSTITUTION_VERSION } from './constitution.ts';
import { CANONICAL_UNIT_DEFINITIONS } from './catalog.ts';
import { convertExact, lookupUnit, reproduceReceipt } from './convert.ts';
import { exactQuantity, integerQuantity } from './quantity.ts';
import type {
  CanonicalUnitDefinition,
  ExactQuantity,
  NormalizationClock,
  NormalizationContext,
  NormalizationReceipt,
  NormalizationRefusal,
} from './types.ts';

export class CanonicalUnitRegistry {
  readonly registryId = CANONICAL_UNIT_REGISTRY_ID;
  readonly constitutionVersion = NORMALIZATION_CONSTITUTION_VERSION;

  definitionOf(unitId: string): CanonicalUnitDefinition | undefined {
    return lookupUnit(unitId);
  }

  isKnown(unitId: string): boolean {
    return lookupUnit(unitId) !== undefined;
  }

  all(): readonly CanonicalUnitDefinition[] {
    return CANONICAL_UNIT_DEFINITIONS;
  }

  quantity(
    unitId: string,
    mantissa: bigint,
    options?: { readonly scale?: number; readonly numerator?: bigint; readonly denominator?: bigint },
  ): Result<ExactQuantity, NormalizationRefusal> {
    if (!this.isKnown(unitId)) {
      return err({ outcome: 'UNKNOWN_UNIT', detail: `unknown unit ${unitId}` });
    }
    return exactQuantity({
      mantissa,
      unitId,
      scale: options?.scale,
      numerator: options?.numerator,
      denominator: options?.denominator,
    });
  }

  integer(unitId: string, mantissa: bigint): Result<ExactQuantity, NormalizationRefusal> {
    if (!this.isKnown(unitId)) {
      return err({ outcome: 'UNKNOWN_UNIT', detail: `unknown unit ${unitId}` });
    }
    return integerQuantity(unitId, mantissa);
  }

  convert(
    source: ExactQuantity,
    targetUnitId: string,
    context?: NormalizationContext,
    clock?: NormalizationClock,
  ): Result<NormalizationReceipt, NormalizationRefusal> {
    return convertExact({ source, targetUnitId, context, clock });
  }

  reproduce(receipt: NormalizationReceipt, clock?: NormalizationClock): Result<NormalizationReceipt, NormalizationRefusal> {
    return reproduceReceipt(receipt, clock);
  }
}

export const defaultCanonicalUnitRegistry = new CanonicalUnitRegistry();

export function normalizeUnit(
  source: ExactQuantity,
  targetUnitId: string,
  context?: NormalizationContext,
  clock?: NormalizationClock,
): Result<NormalizationReceipt, NormalizationRefusal> {
  return defaultCanonicalUnitRegistry.convert(source, targetUnitId, context, clock);
}
