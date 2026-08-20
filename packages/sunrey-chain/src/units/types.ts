import type { FactType } from '../oracle/types.ts';
import type { ProductiveCategory } from '../productive/types.ts';
import type {
  ContextRequirement,
  ConversionOutcome,
  ConversionRuleId,
  MeasurementDimension,
  ResourceClass,
  SemanticQualifier,
} from './constitution.ts';
import { NORMALIZATION_CONSTITUTION_VERSION } from './constitution.ts';

export type CanonicalUnitDefinition = {
  readonly unitId: string;
  readonly symbol: string;
  readonly dimension: MeasurementDimension;
  readonly canonicalBaseUnit: string;
  readonly scaleNumerator: bigint;
  readonly scaleDenominator: bigint;
  readonly semanticQualifier: SemanticQualifier;
  readonly aliases: readonly string[];
  readonly deprecatedAliases: readonly string[];
  readonly requiresContext: boolean;
  readonly contextRequirements: readonly ContextRequirement[];
  readonly allowedFactTypes: readonly FactType[];
  readonly allowedProductiveCategories: readonly ProductiveCategory[];
};

export type ExactQuantity = {
  readonly mantissa: bigint;
  readonly scale: number;
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly unitId: string;
};

export type ExactConversion = {
  readonly numerator: bigint;
  readonly denominator: bigint;
  readonly sourceUnitId: string;
  readonly targetUnitId: string;
  readonly ruleId: ConversionRuleId;
};

export type NormalizationContext = {
  readonly measurementStart?: bigint | undefined;
  readonly measurementEnd?: bigint | undefined;
  readonly durationSeconds?: bigint | undefined;
  readonly resourceClass?: ResourceClass | undefined;
  readonly resourceCount?: bigint | undefined;
  readonly semanticQualifier?: SemanticQualifier | undefined;
  readonly productiveCategory?: ProductiveCategory | undefined;
  readonly factType?: FactType | undefined;
};

export type NormalizationReceipt = {
  readonly receiptId: string;
  readonly sourceQuantity: ExactQuantity;
  readonly sourceUnit: string;
  readonly targetQuantity: ExactQuantity;
  readonly targetUnit: string;
  readonly dimension: MeasurementDimension;
  readonly conversionRuleId: ConversionRuleId;
  readonly conversionVersion: typeof NORMALIZATION_CONSTITUTION_VERSION;
  readonly contextRefs: readonly string[];
  readonly exact: true;
  readonly roundingApplied: false;
  readonly lossy: false;
  readonly createdAt: string;
  readonly conversion: ExactConversion;
};

export type NormalizationRefusal = {
  readonly outcome: Exclude<ConversionOutcome, 'SUCCEED_EXACTLY'>;
  readonly detail: string;
  readonly missingContext?: readonly ContextRequirement[] | undefined;
};

export type NormalizationClock = {
  readonly nowIso: () => string;
};
