import { err, ok, type Result } from '../../../domain/src/result.ts';
import { sha256Hex } from '../../../security/src/hash.ts';
import {
  NORMALIZATION_CONSTITUTION_VERSION,
  TOKEN_INFERENCE_QUALIFIER,
  type ContextRequirement,
  type ConversionRuleId,
  type ResourceClass,
  type SemanticQualifier,
} from './constitution.ts';
import { CANONICAL_UNIT_DEFINITIONS } from './catalog.ts';
import {
  canonicalizeQuantity,
  exactQuantity,
  quantityRational,
  reduceRational,
  scaleByRational,
} from './quantity.ts';
import type {
  CanonicalUnitDefinition,
  ExactConversion,
  ExactQuantity,
  NormalizationClock,
  NormalizationContext,
  NormalizationReceipt,
  NormalizationRefusal,
} from './types.ts';

const ITEM_COUNT_FACTS = new Set([
  'MANUFACTURING_OUTPUT',
  'MANUFACTURING_CAPACITY',
  'DELIVERY_COMPLETION',
  'SERVICE_DELIVERY',
]);
const ITEM_COUNT_CATEGORIES = new Set(['MANUFACTURING', 'GOODS', 'AUTOMATED_MACHINE_OUTPUT']);

const byId = new Map<string, CanonicalUnitDefinition>();
const byAlias = new Map<string, CanonicalUnitDefinition>();

for (const definition of CANONICAL_UNIT_DEFINITIONS) {
  byId.set(definition.unitId, definition);
  for (const alias of definition.aliases) {
    if (!byId.has(alias) && !byAlias.has(alias)) {
      byAlias.set(alias, definition);
    }
  }
  for (const alias of definition.deprecatedAliases) {
    if (!byId.has(alias) && !byAlias.has(alias)) {
      byAlias.set(alias, definition);
    }
  }
}

export function lookupUnit(unitId: string): CanonicalUnitDefinition | undefined {
  return byId.get(unitId) ?? byAlias.get(unitId);
}

export function knownUnitId(unitId: string): boolean {
  return lookupUnit(unitId) !== undefined;
}

function unknown(unitId: string): NormalizationRefusal {
  return { outcome: 'UNKNOWN_UNIT', detail: `unknown unit ${unitId}` };
}

function requireContext(detail: string, missing: readonly ContextRequirement[]): NormalizationRefusal {
  return { outcome: 'REQUIRE_CONTEXT', detail, missingContext: missing };
}

function incompatible(detail: string): NormalizationRefusal {
  return { outcome: 'INCOMPATIBLE_DIMENSION', detail };
}

export function sanitizeContext(context?: NormalizationContext): Result<NormalizationContext, NormalizationRefusal> {
  if (context === undefined) {
    return ok(Object.freeze({}));
  }
  const sanitized: NormalizationContext = Object.freeze({
    measurementStart: context.measurementStart,
    measurementEnd: context.measurementEnd,
    durationSeconds: context.durationSeconds,
    resourceClass: context.resourceClass,
    resourceCount: context.resourceCount,
    semanticQualifier: context.semanticQualifier,
    productiveCategory: context.productiveCategory,
    factType: context.factType,
  });
  if (sanitized.resourceClass !== undefined && sanitized.resourceClass !== 'CPU' && sanitized.resourceClass !== 'GPU') {
    return err(requireContext('resourceClass must be CPU or GPU', ['RESOURCE_CLASS']));
  }
  if (sanitized.resourceCount !== undefined && sanitized.resourceCount <= 0n) {
    return err(requireContext('resourceCount must be a positive integer', ['RESOURCE_COUNT']));
  }
  if (
    sanitized.semanticQualifier !== undefined &&
    sanitized.semanticQualifier !== 'INFERENCE_PROCESSED_TOKENS' &&
    sanitized.semanticQualifier !== 'INFERENCE_GENERATED_TOKENS' &&
    sanitized.semanticQualifier !== 'TRAINING_TOKENS' &&
    sanitized.semanticQualifier !== 'ITEM_OUTPUT' &&
    sanitized.semanticQualifier !== 'MACHINE_USAGE' &&
    sanitized.semanticQualifier !== 'UNQUALIFIED'
  ) {
    return err(requireContext('semanticQualifier is not in the closed qualifier set', ['SEMANTIC_QUALIFIER']));
  }
  return ok(sanitized);
}

export function resolveDurationSeconds(
  context: NormalizationContext,
): Result<bigint, NormalizationRefusal> {
  const derived =
    context.measurementStart !== undefined && context.measurementEnd !== undefined
      ? context.measurementEnd - context.measurementStart
      : undefined;
  if (context.durationSeconds !== undefined && derived !== undefined && derived !== context.durationSeconds) {
    return err(requireContext('durationSeconds conflicts with measurementStart/measurementEnd', ['DURATION']));
  }
  const duration = context.durationSeconds ?? derived;
  if (duration === undefined) {
    return err(requireContext('measurement duration is required', ['DURATION']));
  }
  if (duration <= 0n) {
    return err(requireContext('measurement duration must be a positive integer number of seconds', ['DURATION']));
  }
  return ok(duration);
}

function contextRefs(context: NormalizationContext, used: readonly (keyof NormalizationContext)[]): readonly string[] {
  const refs: string[] = [];
  for (const key of used) {
    const value = context[key];
    if (value !== undefined) {
      refs.push(`${key}=${String(value)}`);
    }
  }
  return Object.freeze(refs);
}

function checkBinding(
  definition: CanonicalUnitDefinition,
  context: NormalizationContext,
): Result<true, NormalizationRefusal> {
  if (context.factType === 'REFERENCE_PRICE') {
    return err(incompatible('REFERENCE_PRICE is not a physical unit and cannot be normalized as one'));
  }
  if (context.factType !== undefined && definition.allowedFactTypes.length > 0) {
    if (!definition.allowedFactTypes.includes(context.factType)) {
      return err(incompatible(`${definition.unitId} is not allowed for fact type ${context.factType}`));
    }
  }
  if (context.productiveCategory !== undefined && definition.allowedProductiveCategories.length > 0) {
    if (!definition.allowedProductiveCategories.includes(context.productiveCategory)) {
      return err(
        incompatible(`${definition.unitId} is not allowed for productive category ${context.productiveCategory}`),
      );
    }
  }
  return ok(true);
}

function checkTokenSemantics(
  source: CanonicalUnitDefinition,
  target: CanonicalUnitDefinition,
  context: NormalizationContext,
): Result<true, NormalizationRefusal> {
  const qualifier = context.semanticQualifier ?? source.semanticQualifier;
  if (qualifier === 'TRAINING_TOKENS' || qualifier === 'INFERENCE_GENERATED_TOKENS') {
    return err(
      incompatible(
        `${qualifier} is not equivalent to ${TOKEN_INFERENCE_QUALIFIER}; token counters stay distinct`,
      ),
    );
  }
  if (source.semanticQualifier !== target.semanticQualifier) {
    return err(incompatible('token units do not share a semantic qualifier'));
  }
  if (qualifier !== TOKEN_INFERENCE_QUALIFIER && qualifier !== 'UNQUALIFIED') {
    return err(incompatible(`token alias requires ${TOKEN_INFERENCE_QUALIFIER}`));
  }
  return ok(true);
}

function checkItemCountAlias(
  source: CanonicalUnitDefinition,
  target: CanonicalUnitDefinition,
  context: NormalizationContext,
): Result<true, NormalizationRefusal> {
  if (context.semanticQualifier !== undefined && context.semanticQualifier !== 'ITEM_OUTPUT') {
    return err(incompatible('units_produced/UNIT alias requires ITEM_OUTPUT semantics'));
  }
  if (context.factType !== undefined && !ITEM_COUNT_FACTS.has(context.factType)) {
    return err(incompatible(`${context.factType} is not an item-count/output fact`));
  }
  if (context.productiveCategory !== undefined && !ITEM_COUNT_CATEGORIES.has(context.productiveCategory)) {
    return err(incompatible(`${context.productiveCategory} is not an item-count productive category`));
  }
  if (source.semanticQualifier !== 'ITEM_OUTPUT' || target.semanticQualifier !== 'ITEM_OUTPUT') {
    return err(incompatible('item-count alias requires ITEM_OUTPUT qualification'));
  }
  return ok(true);
}

function toBaseRational(
  quantity: ExactQuantity,
  definition: CanonicalUnitDefinition,
): { numerator: bigint; denominator: bigint } {
  const value = quantityRational(quantity);
  return reduceRational(value.numerator * definition.scaleNumerator, value.denominator * definition.scaleDenominator);
}

function fromBaseRational(
  base: { numerator: bigint; denominator: bigint },
  definition: CanonicalUnitDefinition,
  unitId: string,
): Result<ExactQuantity, NormalizationRefusal> {
  const scaled = reduceRational(
    base.numerator * definition.scaleDenominator,
    base.denominator * definition.scaleNumerator,
  );
  return exactQuantity({
    mantissa: scaled.numerator,
    scale: 0,
    numerator: 1n,
    denominator: scaled.denominator,
    unitId,
  });
}

function sameDimensionFactor(
  source: CanonicalUnitDefinition,
  target: CanonicalUnitDefinition,
): { numerator: bigint; denominator: bigint } {
  return reduceRational(
    source.scaleNumerator * target.scaleDenominator,
    source.scaleDenominator * target.scaleNumerator,
  );
}

function receiptIdOf(input: {
  readonly source: ExactQuantity;
  readonly targetUnit: string;
  readonly ruleId: ConversionRuleId;
  readonly contextRefs: readonly string[];
}): string {
  const source = canonicalizeQuantity(input.source);
  const canonical = [
    'sunrey.normalization.receipt.v1',
    NORMALIZATION_CONSTITUTION_VERSION,
    input.ruleId,
    source.mantissa.toString(),
    String(source.scale),
    source.numerator.toString(),
    source.denominator.toString(),
    source.unitId,
    input.targetUnit,
    [...input.contextRefs].sort().join(','),
  ].join('|');
  return `nrc_${sha256Hex(canonical)}`;
}

function succeed(input: {
  readonly source: ExactQuantity;
  readonly target: ExactQuantity;
  readonly dimension: CanonicalUnitDefinition['dimension'];
  readonly ruleId: ConversionRuleId;
  readonly conversion: ExactConversion;
  readonly contextRefs: readonly string[];
  readonly clock: NormalizationClock;
}): NormalizationReceipt {
  const source = canonicalizeQuantity(input.source);
  const target = canonicalizeQuantity(input.target);
  return Object.freeze({
    receiptId: receiptIdOf({
      source,
      targetUnit: target.unitId,
      ruleId: input.ruleId,
      contextRefs: input.contextRefs,
    }),
    sourceQuantity: source,
    sourceUnit: source.unitId,
    targetQuantity: target,
    targetUnit: target.unitId,
    dimension: input.dimension,
    conversionRuleId: input.ruleId,
    conversionVersion: NORMALIZATION_CONSTITUTION_VERSION,
    contextRefs: input.contextRefs,
    exact: true,
    roundingApplied: false,
    lossy: false,
    createdAt: input.clock.nowIso(),
    conversion: input.conversion,
  });
}

function defaultClock(): NormalizationClock {
  return { nowIso: () => new Date().toISOString() };
}

export function convertExact(input: {
  readonly source: ExactQuantity;
  readonly targetUnitId: string;
  readonly context?: NormalizationContext;
  readonly clock?: NormalizationClock;
}): Result<NormalizationReceipt, NormalizationRefusal> {
  const clock = input.clock ?? defaultClock();
  const contextResult = sanitizeContext(input.context);
  if (!contextResult.ok) {
    return contextResult;
  }
  const context = contextResult.value;
  const sourceDef = lookupUnit(input.source.unitId);
  const targetDef = lookupUnit(input.targetUnitId);
  if (!sourceDef) {
    return err(unknown(input.source.unitId));
  }
  if (!targetDef) {
    return err(unknown(input.targetUnitId));
  }
  const sourceBound = checkBinding(sourceDef, context);
  if (!sourceBound.ok) {
    return sourceBound;
  }
  const targetBound = checkBinding(targetDef, context);
  if (!targetBound.ok) {
    return targetBound;
  }

  const source = canonicalizeQuantity({ ...input.source, unitId: sourceDef.unitId });

  if (sourceDef.dimension === targetDef.dimension) {
    return convertSameDimension({ source, sourceDef, targetDef, context, clock });
  }
  return convertAcrossDimension({ source, sourceDef, targetDef, context, clock });
}

function convertSameDimension(input: {
  readonly source: ExactQuantity;
  readonly sourceDef: CanonicalUnitDefinition;
  readonly targetDef: CanonicalUnitDefinition;
  readonly context: NormalizationContext;
  readonly clock: NormalizationClock;
}): Result<NormalizationReceipt, NormalizationRefusal> {
  const { source, sourceDef, targetDef, context, clock } = input;
  if (sourceDef.dimension === 'AI_TOKEN_COUNT') {
    const tokens = checkTokenSemantics(sourceDef, targetDef, context);
    if (!tokens.ok) {
      return tokens;
    }
  }
  if (sourceDef.dimension === 'ITEM_COUNT' && sourceDef.unitId !== targetDef.unitId) {
    const items = checkItemCountAlias(sourceDef, targetDef, context);
    if (!items.ok) {
      return items;
    }
  }
  if (
    sourceDef.semanticQualifier !== targetDef.semanticQualifier &&
    sourceDef.semanticQualifier !== 'UNQUALIFIED' &&
    targetDef.semanticQualifier !== 'UNQUALIFIED'
  ) {
    return err(incompatible(`semantic qualifier ${sourceDef.semanticQualifier} cannot become ${targetDef.semanticQualifier}`));
  }

  const factor = sameDimensionFactor(sourceDef, targetDef);
  const converted = scaleByRational(source, factor.numerator, factor.denominator, targetDef.unitId);
  if (!converted.ok) {
    return converted;
  }
  const alias =
    sourceDef.unitId !== targetDef.unitId &&
    factor.numerator === 1n &&
    factor.denominator === 1n;
  const ruleId: ConversionRuleId =
    sourceDef.unitId === targetDef.unitId
      ? 'identity.v1'
      : sourceDef.dimension === 'ITEM_COUNT'
        ? 'item-count.alias.v1'
        : sourceDef.dimension === 'AI_TOKEN_COUNT'
          ? 'token.inference.alias.v1'
          : alias
            ? 'alias.equivalent.v1'
            : 'scale.same-dimension.v1';
  const refs = contextRefs(context, ['semanticQualifier', 'factType', 'productiveCategory']);
  return ok(
    succeed({
      source,
      target: converted.value,
      dimension: targetDef.dimension,
      ruleId,
      conversion: Object.freeze({
        numerator: factor.numerator,
        denominator: factor.denominator,
        sourceUnitId: sourceDef.unitId,
        targetUnitId: targetDef.unitId,
        ruleId,
      }),
      contextRefs: refs,
      clock,
    }),
  );
}

function convertAcrossDimension(input: {
  readonly source: ExactQuantity;
  readonly sourceDef: CanonicalUnitDefinition;
  readonly targetDef: CanonicalUnitDefinition;
  readonly context: NormalizationContext;
  readonly clock: NormalizationClock;
}): Result<NormalizationReceipt, NormalizationRefusal> {
  const { source, sourceDef, targetDef, context, clock } = input;

  if (sourceDef.dimension === 'AREA' && targetDef.dimension === 'AREA_TIME') {
    return convertRateOrExtent({
      source,
      sourceDef,
      targetDef,
      context,
      clock,
      ruleId: 'context.area-duration.v1',
      integratedBaseId: 'm2_s',
    });
  }
  if (sourceDef.dimension === 'VOLUME' && targetDef.dimension === 'VOLUME_TIME') {
    return convertRateOrExtent({
      source,
      sourceDef,
      targetDef,
      context,
      clock,
      ruleId: 'context.volume-duration.v1',
      integratedBaseId: 'L_s',
    });
  }
  if (sourceDef.dimension === 'DATA_RATE' && targetDef.dimension === 'DATA_VOLUME') {
    return convertRateOrExtent({
      source,
      sourceDef,
      targetDef,
      context,
      clock,
      ruleId: 'context.rate-duration.v1',
      integratedBaseId: 'B',
    });
  }
  if (sourceDef.dimension === 'GENERIC_COMPUTE_TIME') {
    return classifyCompute({ source, sourceDef, targetDef, context, clock });
  }

  if (sourceDef.dimension === 'MACHINE_TIME' && targetDef.dimension === 'ITEM_COUNT') {
    return err(
      incompatible('machine_h is usage/capacity time and is not convertible to UNIT without an independent output observation'),
    );
  }
  if (sourceDef.dimension === 'ITEM_COUNT' && targetDef.dimension === 'MACHINE_TIME') {
    return err(incompatible('item counts are not machine time'));
  }
  if (
    (sourceDef.dimension === 'SERVICE_TIME' && targetDef.dimension === 'FACILITY_TIME') ||
    (sourceDef.dimension === 'FACILITY_TIME' && targetDef.dimension === 'SERVICE_TIME') ||
    (sourceDef.dimension === 'VOLUME_TIME' &&
      (targetDef.dimension === 'SERVICE_TIME' || targetDef.dimension === 'FACILITY_TIME')) ||
    (targetDef.dimension === 'VOLUME_TIME' &&
      (sourceDef.dimension === 'SERVICE_TIME' || sourceDef.dimension === 'FACILITY_TIME'))
  ) {
    return err(
      incompatible(`${sourceDef.unitId} and ${targetDef.unitId} are different economic time measurements`),
    );
  }
  if (sourceDef.dimension === 'MASS' && targetDef.dimension === 'MASS_DISTANCE') {
    return err(incompatible('mass cannot become tonne-km without an explicit distance factor'));
  }
  if (sourceDef.dimension === 'GENERIC_COMPUTE_TIME') {
    return err(requireContext('generic compute_s requires a resource class before GPU or CPU time', ['RESOURCE_CLASS']));
  }

  return err(
    incompatible(`${sourceDef.dimension} cannot convert to ${targetDef.dimension}`),
  );
}

function convertRateOrExtent(input: {
  readonly source: ExactQuantity;
  readonly sourceDef: CanonicalUnitDefinition;
  readonly targetDef: CanonicalUnitDefinition;
  readonly context: NormalizationContext;
  readonly clock: NormalizationClock;
  readonly ruleId: ConversionRuleId;
  readonly integratedBaseId: string;
}): Result<NormalizationReceipt, NormalizationRefusal> {
  const duration = resolveDurationSeconds(input.context);
  if (!duration.ok) {
    return duration;
  }
  const integratedBase = lookupUnit(input.integratedBaseId);
  if (!integratedBase) {
    return err(unknown(input.integratedBaseId));
  }
  const sourceBase = toBaseRational(input.source, input.sourceDef);
  const integrated = reduceRational(sourceBase.numerator * duration.value, sourceBase.denominator);
  const target = fromBaseRational(integrated, input.targetDef, input.targetDef.unitId);
  if (!target.ok) {
    return target;
  }
  const refs = contextRefs(input.context, ['durationSeconds', 'measurementStart', 'measurementEnd']);
  const conversionFactor = quantityRational(target.value);
  const sourceValue = quantityRational(input.source);
  const factor = reduceRational(
    conversionFactor.numerator * sourceValue.denominator,
    conversionFactor.denominator * sourceValue.numerator,
  );
  return ok(
    succeed({
      source: input.source,
      target: target.value,
      dimension: input.targetDef.dimension,
      ruleId: input.ruleId,
      conversion: Object.freeze({
        numerator: sourceValue.numerator === 0n ? 0n : factor.numerator,
        denominator: sourceValue.numerator === 0n ? 1n : factor.denominator,
        sourceUnitId: input.sourceDef.unitId,
        targetUnitId: input.targetDef.unitId,
        ruleId: input.ruleId,
      }),
      contextRefs: refs,
      clock: input.clock,
    }),
  );
}

function classifyCompute(input: {
  readonly source: ExactQuantity;
  readonly sourceDef: CanonicalUnitDefinition;
  readonly targetDef: CanonicalUnitDefinition;
  readonly context: NormalizationContext;
  readonly clock: NormalizationClock;
}): Result<NormalizationReceipt, NormalizationRefusal> {
  const resourceClass: ResourceClass | undefined = input.context.resourceClass;
  if (resourceClass === undefined) {
    return err(
      requireContext('compute_s cannot become CPU_HOUR or GPU_HOUR without resourceClass', ['RESOURCE_CLASS']),
    );
  }
  const classifiedUnitId = resourceClass === 'GPU' ? 'gpu_s' : 'cpu_s';
  const classifiedDef = lookupUnit(classifiedUnitId);
  if (!classifiedDef) {
    return err(unknown(classifiedUnitId));
  }
  if (input.targetDef.dimension !== classifiedDef.dimension) {
    return err(
      incompatible(`resourceClass ${resourceClass} produces ${classifiedDef.dimension}, not ${input.targetDef.dimension}`),
    );
  }
  const count = input.context.resourceCount ?? 1n;
  if (count <= 0n) {
    return err(requireContext('resourceCount must be a positive integer', ['RESOURCE_COUNT']));
  }
  const counted = scaleByRational(input.source, count, 1n, classifiedDef.unitId);
  if (!counted.ok) {
    return counted;
  }
  const toTarget = convertSameDimension({
    source: counted.value,
    sourceDef: classifiedDef,
    targetDef: input.targetDef,
    context: input.context,
    clock: input.clock,
  });
  if (!toTarget.ok) {
    return toTarget;
  }
  const refs = contextRefs(input.context, ['resourceClass', 'resourceCount']);
  return ok(
    succeed({
      source: input.source,
      target: toTarget.value.targetQuantity,
      dimension: input.targetDef.dimension,
      ruleId: 'context.compute-classify.v1',
      conversion: Object.freeze({
        ...toTarget.value.conversion,
        sourceUnitId: input.sourceDef.unitId,
        ruleId: 'context.compute-classify.v1',
      }),
      contextRefs: refs,
      clock: input.clock,
    }),
  );
}

export function reproduceReceipt(
  receipt: NormalizationReceipt,
  clock?: NormalizationClock,
): Result<NormalizationReceipt, NormalizationRefusal> {
  if (receipt.conversionVersion !== NORMALIZATION_CONSTITUTION_VERSION) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: `historical receipt uses ${receipt.conversionVersion}; refusing silent reinterpretation under ${NORMALIZATION_CONSTITUTION_VERSION}`,
    });
  }
  const context = contextFromRefs(receipt.contextRefs);
  const replayed = convertExact({
    source: receipt.sourceQuantity,
    targetUnitId: receipt.targetUnit,
    context,
    clock: clock ?? { nowIso: () => receipt.createdAt },
  });
  if (!replayed.ok) {
    return replayed;
  }
  if (replayed.value.receiptId !== receipt.receiptId) {
    return err({
      outcome: 'LOSSY_CONVERSION_FORBIDDEN',
      detail: 'historical receipt is not reproducible under the retained constitution version',
    });
  }
  return replayed;
}

function contextFromRefs(refs: readonly string[]): NormalizationContext {
  const parsed: {
    measurementStart?: bigint;
    measurementEnd?: bigint;
    durationSeconds?: bigint;
    resourceClass?: ResourceClass;
    resourceCount?: bigint;
    semanticQualifier?: SemanticQualifier;
    productiveCategory?: NormalizationContext['productiveCategory'];
    factType?: NormalizationContext['factType'];
  } = {};
  for (const ref of refs) {
    const sep = ref.indexOf('=');
    if (sep <= 0) {
      continue;
    }
    const key = ref.slice(0, sep);
    const value = ref.slice(sep + 1);
    if (key === 'durationSeconds' || key === 'measurementStart' || key === 'measurementEnd' || key === 'resourceCount') {
      parsed[key] = BigInt(value);
    } else if (key === 'resourceClass' && (value === 'CPU' || value === 'GPU')) {
      parsed.resourceClass = value;
    } else if (key === 'semanticQualifier') {
      parsed.semanticQualifier = value as SemanticQualifier;
    } else if (key === 'productiveCategory') {
      parsed.productiveCategory = value as NormalizationContext['productiveCategory'];
    } else if (key === 'factType') {
      parsed.factType = value as NormalizationContext['factType'];
    }
  }
  return Object.freeze(parsed);
}
