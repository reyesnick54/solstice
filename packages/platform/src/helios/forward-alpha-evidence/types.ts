import type { UtcInstant } from '@solstice/domain';

import type {
  AlphaEvidenceSourceKind,
  AlphaWorkPackageId,
  ForwardAlphaRealityStatus,
  ForwardEvidenceProvenance,
} from './taxonomy.ts';

export type AlphaWorkPackageRow = {
  readonly workPackage: AlphaWorkPackageId;
  readonly title: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly moduleRef: string;
};

export type ForwardAlphaDecisionRecord = {
  readonly decisionId: string;
  readonly recordedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly action: 'ENTER' | 'HOLD' | 'EXIT';
  readonly notionalMinor: bigint;
  readonly benchmarkId: string;
  readonly sourceKind: AlphaEvidenceSourceKind;
};

export type PreRegisteredStatisticalPolicy = {
  readonly policyId: string;
  readonly frozenAt: UtcInstant;
  readonly contentHash: string;
  readonly primaryEndpoint: 'EXCESS_RETURN_MINOR' | 'RISK_ADJUSTED_EXCESS_MINOR';
  readonly alphaSpendLimit: number;
  readonly sequentialMethod: 'PREDICTIVE_PROBABILITY' | 'CONFIDENCE_SEQUENCE';
};

export type ForwardAlphaRealityGateResult = {
  readonly status: ForwardAlphaRealityStatus;
  readonly provenance: ForwardEvidenceProvenance;
  readonly notes: readonly string[];
  readonly engineeringQualificationOnly: boolean;
  readonly investmentPerformanceClaimed: boolean;
};

export type AlphaRealityGateInput = {
  readonly architectureComplete: boolean;
  readonly forwardCampaignInfrastructureReady: boolean;
  readonly sourceKind: AlphaEvidenceSourceKind;
  readonly chronologicalForwardDecisionCount: number;
  readonly preliminaryPositiveForward: boolean;
  readonly statisticalPolicySatisfied: boolean;
  readonly robustnessRegimesSatisfied: number;
  readonly robustnessRegimesRequired: number;
  readonly paperExecutionAfterRealisticCosts: boolean;
  readonly liveRegulatedCapitalEvidence: boolean;
  readonly liveTradingEnabled: boolean;
  readonly liveInvestmentExecution: boolean;
};
