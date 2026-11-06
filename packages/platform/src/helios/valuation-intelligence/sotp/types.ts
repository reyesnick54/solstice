/**
 * HELIOS VAL09 — sum-of-the-parts domain types.
 */

import type { UtcInstant } from '@solstice/domain';
import type { SegmentObservation } from '@solstice/external-data';
import type { DriverTreeNode } from '../driver-forecast/types.ts';
import type {
  CorporateAdjustmentKind,
  IntersegmentFlowKind,
  SegmentLifecycleEventKind,
  SegmentValuationMethod,
  VAL09_SOTP_SCHEMA,
} from './taxonomy.ts';

export type SegmentIdentityBinding = {
  readonly stableSegmentKey: string;
  readonly reportedSegmentId: string;
  readonly reportedLabel: string;
  readonly fiscalPeriod: string;
  readonly knowableAt: UtcInstant;
  readonly filingId: string;
  readonly eventKind: SegmentLifecycleEventKind;
  readonly priorStableSegmentKey: string | null;
  readonly evidenceRef: string;
};

export type BusinessSegment = {
  readonly stableSegmentKey: string;
  readonly displayLabel: string;
  readonly activeAsOf: UtcInstant;
  readonly retiredAt: UtcInstant | null;
  readonly identityHistory: readonly SegmentIdentityBinding[];
  readonly grantsExecutionAuthority: false;
};

export type SegmentEconomicProfile = {
  readonly stableSegmentKey: string;
  readonly fiscalPeriod: string;
  readonly revenueMinor: bigint | null;
  readonly operatingIncomeMinor: bigint | null;
  readonly assetsMinor: bigint | null;
  readonly capexMinor: bigint | null;
  readonly currency: string;
  readonly knowableAt: UtcInstant;
  readonly sourceObservationRefs: readonly string[];
};

export type SegmentScenarioWeight = {
  readonly scenarioId: string;
  readonly label: string;
  readonly weight: number;
};

export type SegmentForecast = {
  readonly stableSegmentKey: string;
  readonly horizonYears: number;
  readonly driverTree: DriverTreeNode | null;
  readonly explicitFcffMinor: readonly bigint[];
  readonly explicitFcfeMinor: readonly bigint[];
  readonly discountRateBps: number;
  readonly terminalGrowthBps: number;
  readonly scenarioWeights: readonly SegmentScenarioWeight[];
  readonly evidenceDriverIds: readonly string[];
};

export type SegmentValueDistribution = {
  readonly stableSegmentKey: string;
  readonly method: SegmentValuationMethod;
  readonly currency: string;
  readonly p05Minor: bigint;
  readonly p25Minor: bigint;
  readonly medianMinor: bigint;
  readonly p75Minor: bigint;
  readonly p95Minor: bigint;
  readonly scenarioBreakdown: readonly {
    readonly scenarioId: string;
    readonly valueMinor: bigint;
    readonly weight: number;
  }[];
  readonly notAFact: true;
  readonly researchOnly: true;
};

export type SegmentValuation = {
  readonly stableSegmentKey: string;
  readonly method: SegmentValuationMethod;
  readonly enterpriseValueMinor: bigint;
  readonly equityValueMinor: bigint | null;
  readonly distribution: SegmentValueDistribution;
  readonly methodRationale: readonly string[];
  readonly intersegmentAdjustmentMinor: bigint;
};

export type IntersegmentFlow = {
  readonly flowId: string;
  readonly kind: IntersegmentFlowKind;
  readonly fromStableSegmentKey: string;
  readonly toStableSegmentKey: string;
  readonly amountMinor: bigint;
  readonly fiscalPeriod: string;
  readonly eliminationApplied: boolean;
  readonly note: string | null;
};

export type CorporateAdjustment = {
  readonly adjustmentId: string;
  readonly kind: CorporateAdjustmentKind;
  readonly label: string;
  readonly amountMinor: bigint;
  readonly sign: 'ADD' | 'SUBTRACT';
  readonly knowableAt: UtcInstant | null;
  readonly evidenceRef: string | null;
};

export type ObservedConglomerateDiscountState = {
  readonly observed: boolean;
  readonly discountBps: number | null;
  readonly peerSetRef: string | null;
  readonly marketCapMinor: bigint | null;
  readonly sumOfPartsMinor: bigint | null;
  readonly asOfKnowableAt: UtcInstant | null;
  readonly notAppliedToIntrinsic: true;
  readonly researchOnly: true;
};

export type SotpIntrinsicValueDistribution = {
  readonly currency: string;
  readonly enterpriseValueMinor: bigint;
  readonly equityValueMinor: bigint;
  readonly valuePerShareMinor: bigint | null;
  readonly p05Minor: bigint;
  readonly p25Minor: bigint;
  readonly medianMinor: bigint;
  readonly p75Minor: bigint;
  readonly p95Minor: bigint;
  readonly segmentCount: number;
  readonly notAFact: true;
  readonly researchOnly: true;
  readonly grantsExecutionAuthority: false;
};

export type SegmentContributionMap = {
  readonly contributions: Readonly<
    Record<
      string,
      {
        readonly stableSegmentKey: string;
        readonly enterpriseValueMinor: bigint;
        readonly shareOfTotalBps: number;
        readonly method: SegmentValuationMethod;
      }
    >
  >;
  readonly totalEnterpriseValueMinor: bigint;
};

export type SegmentValueConcentration = {
  readonly hhiBps: number;
  readonly largestSegmentKey: string | null;
  readonly largestShareBps: number;
  readonly topTwoShareBps: number;
};

export type CorporateAdjustmentBridge = {
  readonly segmentEnterpriseTotalMinor: bigint;
  readonly adjustments: readonly CorporateAdjustment[];
  readonly netAdjustmentMinor: bigint;
  readonly bridgedEquityMinor: bigint;
  readonly bridgedEnterpriseMinor: bigint;
};

export type SotpBridge = {
  readonly segmentSubtotalEnterpriseMinor: bigint;
  readonly intersegmentEliminationsMinor: bigint;
  readonly corporateBridge: CorporateAdjustmentBridge;
  readonly fundamentalIntrinsicMinor: bigint;
  readonly observedConglomerateDiscount: ObservedConglomerateDiscountState;
};

export type SotpValuation = {
  readonly schema: typeof VAL09_SOTP_SCHEMA;
  readonly valuationId: string;
  readonly canonicalEntityId: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly segments: readonly BusinessSegment[];
  readonly segmentValuations: readonly SegmentValuation[];
  readonly intrinsicDistribution: SotpIntrinsicValueDistribution;
  readonly contributionMap: SegmentContributionMap;
  readonly concentration: SegmentValueConcentration;
  readonly bridge: SotpBridge;
  readonly intersegmentFlows: readonly IntersegmentFlow[];
  readonly qualificationMarker:
    | 'HELIOS_VAL09_SOTP_QUALIFIED'
    | 'HELIOS_VAL09_SOTP_BLOCKED';
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export type SecSegmentObservationSource = {
  readonly evaluationTimeUtc: UtcInstant;
  readonly observations: readonly SegmentObservation[];
};

export type SegmentValuationSpec = {
  readonly stableSegmentKey: string;
  readonly method: SegmentValuationMethod;
  readonly forecast: SegmentForecast | null;
  readonly profile: SegmentEconomicProfile | null;
  readonly comparableMultipleBps: number | null;
  readonly comparableMetricMinor: bigint | null;
  readonly assetBaseMinor: bigint | null;
  readonly dividendCapacityMinor: bigint | null;
};

export type RunSotpValuationInput = {
  readonly valuationId: string;
  readonly canonicalEntityId: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly currency: string;
  readonly segmentSource: SecSegmentObservationSource;
  readonly segmentSpecs: readonly SegmentValuationSpec[];
  readonly intersegmentFlows: readonly IntersegmentFlow[];
  readonly corporateAdjustments: readonly CorporateAdjustment[];
  readonly sharesOutstandingMinor: bigint | null;
  readonly observedConglomerateDiscount: ObservedConglomerateDiscountState | null;
};
