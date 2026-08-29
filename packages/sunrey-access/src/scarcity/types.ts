import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AccessResourceId, AccessQuoteId } from '../ids.ts';
import type {
  AllocationMechanism,
  AllocationOutcomeKind,
  InputClass,
  ScarcityBand,
  ScarcityRefusalCode,
} from '../taxonomy.ts';
import type { VerifiedCapacityState } from '../capacity.ts';

export type TaggedInput = {
  readonly key: string;
  readonly value: bigint;
  readonly inputClass: InputClass;
  readonly sourceRef: string;
  readonly note?: string;
};

export type ScarcityComponentResult = {
  readonly componentId: string;
  readonly inputClass: InputClass;
  readonly rawValue: bigint;
  readonly boundedContribution: bigint;
  readonly evidenceRefs: readonly string[];
  readonly note: string;
};

export type ScarcityState = {
  readonly band: ScarcityBand;
  readonly pressureBps: number;
  readonly availableUnits: bigint;
  readonly demandUnits: bigint;
  readonly components: readonly ScarcityComponentResult[];
  readonly methodologyVersion: string;
  readonly computedAt: UtcInstant;
};

export type AllocationBasis = {
  readonly mechanism: AllocationMechanism;
  readonly regimeHint: string;
  readonly scarcityBand: ScarcityBand;
  readonly policyVersion: string;
  readonly rationale: readonly string[];
};

export type AccessQuote = {
  readonly quoteId: AccessQuoteId;
  readonly resourceId: AccessResourceId;
  readonly scarcity: ScarcityState;
  readonly allocationBasis: AllocationBasis;
  readonly marketInputs: readonly TaggedInput[];
  readonly policyInputs: readonly TaggedInput[];
  readonly methodologyVersion: string;
  readonly computedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly evidenceRefs: readonly string[];
};

export type ScarcityEvaluationInput = {
  readonly resourceId: AccessResourceId;
  readonly capacity: VerifiedCapacityState;
  readonly forecastDemandUnits?: bigint;
  readonly timeScarcityBps?: number;
  readonly geographicScarcityBps?: number;
  readonly productiveResourceCostMinor?: bigint;
  readonly energyRequirementMinor?: bigint;
  readonly logisticsCostMinor?: bigint;
  readonly maintenanceCostMinor?: bigint;
  readonly qualityTierPremiumBps?: number;
  readonly policySubsidyBps?: number;
  readonly policyBenefitUnits?: bigint;
  readonly externalityCostMinor?: bigint;
  readonly externalityEvidenceRefs?: readonly string[];
  readonly now: UtcInstant;
};

export type ScarcityRefusal = {
  readonly code: ScarcityRefusalCode;
  readonly message: string;
  readonly resourceId: AccessResourceId;
};

export type AllocationRequest = {
  readonly requestId: string;
  readonly subjectRef: string;
  readonly resourceId: AccessResourceId;
  readonly requestedUnits: bigint;
  readonly jurisdiction: string;
  readonly productCode: string;
  readonly entitlementUnits?: bigint;
  readonly queueJoinOrder?: bigint;
  readonly priorityPolicyScore?: bigint;
  readonly optionalMarketPurchase?: boolean;
  readonly offeredPriceMinor?: bigint;
  readonly lotterySeed?: string;
  readonly now: UtcInstant;
};

export type AllocationDecision = {
  readonly decisionId: string;
  readonly mechanism: AllocationMechanism;
  readonly policyVersion: string;
  readonly inputs: Readonly<Record<string, string | number | boolean | null>>;
  readonly outcome: AllocationOutcomeKind;
  readonly grantedUnits: bigint;
  readonly reasons: readonly string[];
  readonly expiration: UtcInstant;
  readonly evidenceReferences: readonly string[];
  readonly quote?: AccessQuote;
};

export type MechanismSelectionPolicy = {
  readonly policyVersion: string;
  readonly regimeHint: string;
  readonly abundantMechanism: AllocationMechanism;
  readonly essentialMechanism: AllocationMechanism;
  readonly scarceMechanisms: readonly AllocationMechanism[];
  readonly denyWhenUnavailable: boolean;
  readonly quoteTtlMs: number;
  readonly capacityMaxAgeMs: number;
  readonly lotterySeedNamespace?: string;
  readonly fixedAccessRatePerHour?: bigint;
  readonly queueFairOrdering: boolean;
  readonly allowFinancialPurchase: boolean;
};

export type ScarcityModelComponent = {
  readonly id: string;
  readonly inputClass: InputClass;
  readonly description: string;
  readonly weightBps: number;
  readonly ceilingBps: number;
};

export type ScarcityModelVersion = {
  readonly version: string;
  readonly description: string;
  readonly components: readonly ScarcityModelComponent[];
  readonly abundantThresholdBps: number;
  readonly balancedThresholdBps: number;
  readonly constrainedThresholdBps: number;
  readonly criticalThresholdBps: number;
};

export type ForbiddenInputProbe = {
  readonly humanWorth?: unknown;
  readonly wealth?: unknown;
  readonly socialStatus?: unknown;
  readonly politicalBelief?: unknown;
  readonly psychologicalProfile?: unknown;
  readonly personalDesirability?: unknown;
};
