// @ts-nocheck
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { asAccessQuoteId } from '../ids.ts';
import type { ScarcityBand } from '../taxonomy.ts';
import { validateCapacityState } from '../capacity.ts';
import { SCARCITY_MODEL_V1, resolveScarcityModel } from './model.ts';
import type {
  AccessQuote,
  AllocationBasis,
  ForbiddenInputProbe,
  ScarcityComponentResult,
  ScarcityEvaluationInput,
  ScarcityRefusal,
  ScarcityState,
  TaggedInput,
} from './types.ts';

const BPS_SCALE = 10_000n;

function clampBps(value: bigint, ceiling: number): number {
  const max = BigInt(ceiling);
  if (value < 0n) return 0;
  if (value > max) return ceiling;
  return Number(value);
}

function weightedContribution(rawBps: number, weightBps: number, ceilingBps: number): number {
  const weighted = Math.floor((rawBps * weightBps) / 10_000);
  return Math.min(weighted, ceilingBps);
}

function normalizeCostToBps(costMinor: bigint, referenceMinor = 1_000_000n): number {
  if (costMinor <= 0n) return 0;
  const scaled = (costMinor * BPS_SCALE) / referenceMinor;
  return clampBps(scaled, 10_000);
}

function demandPressureBps(available: bigint, demand: bigint): number {
  if (available <= 0n) return 10_000;
  if (demand <= available) {
    const ratio = (demand * BPS_SCALE) / available;
    return clampBps(ratio, 10_000);
  }
  const over = ((demand - available) * BPS_SCALE) / available;
  return clampBps(over + BPS_SCALE, 10_000);
}

function bandForPressure(modelVersion: string, pressureBps: number): ScarcityBand {
  const model = resolveScarcityModel(modelVersion) ?? SCARCITY_MODEL_V1;
  if (pressureBps >= model.criticalThresholdBps) return 'CRITICAL';
  if (pressureBps >= model.constrainedThresholdBps) return 'CONSTRAINED';
  if (pressureBps >= model.balancedThresholdBps) return 'BALANCED';
  if (pressureBps >= model.abundantThresholdBps) return 'ABUNDANT';
  return 'ABUNDANT';
}

export function detectForbiddenInputs(probe: ForbiddenInputProbe): string[] {
  const found: string[] = [];
  if (probe.humanWorth !== undefined && probe.humanWorth !== null) found.push('HUMAN_WORTH');
  if (probe.wealth !== undefined && probe.wealth !== null) found.push('WEALTH');
  if (probe.socialStatus !== undefined && probe.socialStatus !== null) found.push('SOCIAL_STATUS');
  if (probe.politicalBelief !== undefined && probe.politicalBelief !== null) found.push('POLITICAL_BELIEF');
  if (probe.psychologicalProfile !== undefined && probe.psychologicalProfile !== null) found.push('PSYCHOLOGICAL_PROFILE');
  if (probe.personalDesirability !== undefined && probe.personalDesirability !== null) found.push('PERSONAL_DESIRABILITY');
  return found;
}

export function evaluateScarcity(
  input: ScarcityEvaluationInput,
  options: {
    readonly modelVersion?: string;
    readonly capacityMaxAgeMs: number;
    readonly forbiddenProbe?: ForbiddenInputProbe;
  },
): Result<ScarcityState, ScarcityRefusal> {
  const modelVersion = options.modelVersion ?? SCARCITY_MODEL_V1.version;
  const model = resolveScarcityModel(modelVersion);
  if (!model) {
    return err({
      code: 'MODEL_VERSION_UNKNOWN',
      message: `unknown scarcity model version: ${modelVersion}`,
      resourceId: input.resourceId,
    });
  }

  const forbidden = detectForbiddenInputs(options.forbiddenProbe ?? {});
  if (forbidden.length > 0) {
    return err({
      code: 'FORBIDDEN_INPUT_PRESENT',
      message: `forbidden scarcity inputs present: ${forbidden.join(', ')}`,
      resourceId: input.resourceId,
    });
  }

  const capacityCheck = validateCapacityState(input.capacity, {
    now: input.now,
    maxAgeMs: options.capacityMaxAgeMs,
  });
  if (!capacityCheck.ok) {
    if (capacityCheck.error.code === 'CAPACITY_ZERO') {
      return ok(
        Object.freeze({
          band: 'UNAVAILABLE' as ScarcityBand,
          pressureBps: 10_000,
          availableUnits: 0n,
          demandUnits: input.forecastDemandUnits ?? 0n,
          components: Object.freeze([]),
          methodologyVersion: modelVersion,
          computedAt: input.now,
        }),
      );
    }
    return err({
      code: 'RESOURCE_UNAVAILABLE',
      message: capacityCheck.error.message,
      resourceId: input.resourceId,
    });
  }

  const capacity = capacityCheck.value;
  const demand = input.forecastDemandUnits ?? 0n;
  const components: ScarcityComponentResult[] = [];

  const capacityPressure = clampBps(BigInt(capacity.utilizationBps), 10_000);
  components.push({
    componentId: 'capacity_pressure',
    inputClass: 'VERIFIED_EVIDENCE',
    rawValue: BigInt(capacityPressure),
    boundedContribution: BigInt(
      weightedContribution(capacityPressure, model.components.find((c) => c.id === 'capacity_pressure')!.weightBps, 10_000),
    ),
    evidenceRefs: capacity.evidenceRefs,
    note: 'verified utilization and availability',
  });

  const demandBps = demandPressureBps(capacity.availableUnits, demand);
  components.push({
    componentId: 'demand_forecast',
    inputClass: 'MARKET',
    rawValue: BigInt(demandBps),
    boundedContribution: BigInt(
      weightedContribution(demandBps, model.components.find((c) => c.id === 'demand_forecast')!.weightBps, 10_000),
    ),
    evidenceRefs: [],
    note: 'forecast demand relative to verified availability',
  });

  const pushMarket = (id: string, rawBps: number, note: string) => {
    const def = model.components.find((c) => c.id === id);
    if (!def) return;
    components.push({
      componentId: id,
      inputClass: 'MARKET',
      rawValue: BigInt(rawBps),
      boundedContribution: BigInt(weightedContribution(rawBps, def.weightBps, def.ceilingBps)),
      evidenceRefs: [],
      note,
    });
  };

  pushMarket('time_scarcity', input.timeScarcityBps ?? 0, 'time-window scarcity');
  pushMarket('geographic_scarcity', input.geographicScarcityBps ?? 0, 'geographic scarcity');
  pushMarket('productive_resource_cost', normalizeCostToBps(input.productiveResourceCostMinor ?? 0n), 'productive resource cost signal');
  pushMarket('energy_requirement', normalizeCostToBps(input.energyRequirementMinor ?? 0n), 'energy requirement signal');
  pushMarket('logistics_cost', normalizeCostToBps(input.logisticsCostMinor ?? 0n), 'logistics cost signal');
  pushMarket('maintenance_cost', normalizeCostToBps(input.maintenanceCostMinor ?? 0n), 'maintenance/service cost signal');
  pushMarket('quality_tier', input.qualityTierPremiumBps ?? 0, 'quality tier premium');

  const subsidyBps = input.policySubsidyBps ?? 0;
  const subsidyDef = model.components.find((c) => c.id === 'policy_subsidy')!;
  components.push({
    componentId: 'policy_subsidy',
    inputClass: 'POLICY',
    rawValue: BigInt(subsidyBps),
    boundedContribution: BigInt(-weightedContribution(subsidyBps, subsidyDef.weightBps, subsidyDef.ceilingBps)),
    evidenceRefs: [],
    note: 'externally supplied policy subsidy',
  });

  const benefitUnits = input.policyBenefitUnits ?? 0n;
  const benefitDef = model.components.find((c) => c.id === 'policy_benefit')!;
  const benefitBps = capacity.availableUnits > 0n ? clampBps((benefitUnits * BPS_SCALE) / capacity.availableUnits, 10_000) : 0;
  components.push({
    componentId: 'policy_benefit',
    inputClass: 'POLICY',
    rawValue: benefitUnits,
    boundedContribution: BigInt(-weightedContribution(benefitBps, benefitDef.weightBps, benefitDef.ceilingBps)),
    evidenceRefs: [],
    note: 'externally supplied policy benefit units',
  });

  const externalityBps = normalizeCostToBps(input.externalityCostMinor ?? 0n);
  const externalityDef = model.components.find((c) => c.id === 'externality')!;
  components.push({
    componentId: 'externality',
    inputClass: 'VERIFIED_EVIDENCE',
    rawValue: BigInt(externalityBps),
    boundedContribution: BigInt(weightedContribution(externalityBps, externalityDef.weightBps, externalityDef.ceilingBps)),
    evidenceRefs: input.externalityEvidenceRefs ?? [],
    note: 'verified externality input',
  });

  const pressureBps = Math.max(
    0,
    Math.min(
      10_000,
      components.reduce((sum, component) => sum + Number(component.boundedContribution), 0),
    ),
  );

  return ok(
    Object.freeze({
      band: bandForPressure(modelVersion, pressureBps),
      pressureBps,
      availableUnits: capacity.availableUnits,
      demandUnits: demand,
      components: Object.freeze(components),
      methodologyVersion: modelVersion,
      computedAt: input.now,
    }),
  );
}

export function buildAccessQuote(input: {
  readonly quoteId: string;
  readonly resourceId: ScarcityEvaluationInput['resourceId'];
  readonly scarcity: ScarcityState;
  readonly allocationBasis: AllocationBasis;
  readonly marketInputs: readonly TaggedInput[];
  readonly policyInputs: readonly TaggedInput[];
  readonly expiresAt: string;
  readonly evidenceRefs?: readonly string[];
}): AccessQuote {
  return Object.freeze({
    quoteId: asAccessQuoteId(input.quoteId),
    resourceId: input.resourceId,
    scarcity: input.scarcity,
    allocationBasis: input.allocationBasis,
    marketInputs: Object.freeze([...input.marketInputs]),
    policyInputs: Object.freeze([...input.policyInputs]),
    methodologyVersion: input.scarcity.methodologyVersion,
    computedAt: input.scarcity.computedAt,
    expiresAt: input.expiresAt,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
  });
}

export function collectTaggedInputs(input: ScarcityEvaluationInput): {
  readonly marketInputs: readonly TaggedInput[];
  readonly policyInputs: readonly TaggedInput[];
} {
  const marketInputs: TaggedInput[] = [];
  const policyInputs: TaggedInput[] = [];

  const add = (key: string, value: bigint | undefined, inputClass: 'MARKET' | 'POLICY', sourceRef: string) => {
    if (value === undefined) return;
    const tagged = Object.freeze({ key, value, inputClass, sourceRef });
    if (inputClass === 'MARKET') marketInputs.push(tagged);
    else policyInputs.push(tagged);
  };

  add('forecastDemandUnits', input.forecastDemandUnits, 'MARKET', 'forecast');
  add('timeScarcityBps', input.timeScarcityBps !== undefined ? BigInt(input.timeScarcityBps) : undefined, 'MARKET', 'time-window');
  add('geographicScarcityBps', input.geographicScarcityBps !== undefined ? BigInt(input.geographicScarcityBps) : undefined, 'MARKET', 'geography');
  add('productiveResourceCostMinor', input.productiveResourceCostMinor, 'MARKET', 'productive-cost');
  add('energyRequirementMinor', input.energyRequirementMinor, 'MARKET', 'energy');
  add('logisticsCostMinor', input.logisticsCostMinor, 'MARKET', 'logistics');
  add('maintenanceCostMinor', input.maintenanceCostMinor, 'MARKET', 'maintenance');
  add('qualityTierPremiumBps', input.qualityTierPremiumBps !== undefined ? BigInt(input.qualityTierPremiumBps) : undefined, 'MARKET', 'quality-tier');
  add('policySubsidyBps', input.policySubsidyBps !== undefined ? BigInt(input.policySubsidyBps) : undefined, 'POLICY', 'subsidy');
  add('policyBenefitUnits', input.policyBenefitUnits, 'POLICY', 'benefit');
  add('externalityCostMinor', input.externalityCostMinor, 'POLICY', 'externality');

  return {
    marketInputs: Object.freeze(marketInputs),
    policyInputs: Object.freeze(policyInputs),
  };
}
