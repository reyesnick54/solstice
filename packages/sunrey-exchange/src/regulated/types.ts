import type { EvidenceCompleteness } from '../../../kernel/src/regulated/providers.ts';
import type { CanonicalMarketFamily } from '../taxonomy.ts';

export type MarketAccessInput = {
  readonly identityClass: 'RETAIL' | 'PROFESSIONAL' | 'INSTITUTIONAL';
  readonly jurisdiction: string;
  readonly marketFamily: CanonicalMarketFamily;
  readonly complianceState: 'CLEAR' | 'REVIEW' | 'BLOCK' | 'UNAVAILABLE';
  readonly professionalStatus: boolean;
  readonly institutionalStatus: boolean;
  readonly consentReady: boolean;
  readonly rightsReady: boolean;
  readonly listingAllowed: boolean;
  readonly riskRestricted: boolean;
  readonly deniedJurisdictions?: readonly string[];
};

export type MarketAccessDecision = {
  readonly allowed: boolean;
  readonly marketFamily: CanonicalMarketFamily;
  readonly inheritedFamilyStatus: false;
  readonly reasonCodes: readonly string[];
};

export type ReadinessDimensionStatus = {
  readonly complete: boolean;
  readonly completeness: EvidenceCompleteness;
  readonly notes: string;
};

export type RegulatedMarketReadinessReport = {
  readonly technical: ReadinessDimensionStatus;
  readonly security: ReadinessDimensionStatus;
  readonly operations: ReadinessDimensionStatus;
  readonly provider: ReadinessDimensionStatus;
  readonly legal: ReadinessDimensionStatus;
  readonly license: ReadinessDimensionStatus;
  readonly humanAuthorization: ReadinessDimensionStatus;
  readonly productionActivated: false;
  readonly liveFlagsRemainDisabled: true;
};
