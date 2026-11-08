import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA,
  type ForwardEntitlementState,
  type ForwardEvidenceContributionLane,
  type ForwardEvidenceSourceClass,
  type ForwardMarketDataQualityState,
  type ForwardOutagePeriodClassification,
  type ForwardSequenceIntegrityState,
} from './taxonomy.ts';

/** Policy gate for economically suitable delayed-live forward evidence. */
export type DelayedLiveAdmissionPolicy = {
  readonly approved: boolean;
  readonly economicallySuitable: boolean;
};

/** Declared ingress path for one observation stream or provider feed. */
export type ForwardEvidenceSource = {
  readonly sourceId: string;
  readonly sourceClass: ForwardEvidenceSourceClass;
  readonly providerIdentity: string;
  readonly providerQualification: string;
  readonly campaignId: string;
  readonly campaignStartedAt: UtcInstant;
  readonly delayedLivePolicy: DelayedLiveAdmissionPolicy | null;
};

/** Required metadata envelope for a single forward observation. */
export type ForwardObservationReceipt = {
  readonly receiptId: string;
  readonly source: ForwardEvidenceSource;
  readonly providerIdentity: string;
  readonly providerQualification: string;
  readonly sunreyArrivalTime: UtcInstant;
  readonly eventTimestamp: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly campaignStartedAt: UtcInstant;
  readonly marketDataQuality: ForwardMarketDataQualityState;
  readonly sequenceIntegrity: ForwardSequenceIntegrityState;
  readonly entitlementState: ForwardEntitlementState;
  readonly rawEvidenceReference: string;
};

export type ForwardEvidenceClassification = {
  readonly schema: typeof HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA;
  readonly receiptId: string;
  readonly sourceClass: ForwardEvidenceSourceClass;
  readonly contributionLane: ForwardEvidenceContributionLane;
  readonly contributesToGenuineForwardEvidence: boolean;
  readonly arrivalOnOrAfterCampaignStart: boolean;
  readonly blockers: readonly string[];
};

export type ForwardOutagePeriod = {
  readonly outageId: string;
  readonly campaignId: string;
  readonly gapStartedAt: UtcInstant;
  readonly gapEndedAt: UtcInstant;
  readonly classification: ForwardOutagePeriodClassification;
};

export type ForwardDataAdmission = {
  readonly schema: typeof HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_SCHEMA;
  readonly campaignId: string;
  readonly campaignStartedAt: UtcInstant;
  readonly classifications: readonly ForwardEvidenceClassification[];
  readonly outagePeriods: readonly ForwardOutagePeriod[];
  readonly genuineForwardReceiptIds: readonly string[];
  readonly infrastructureOnlyReceiptIds: readonly string[];
  readonly rejectedReceiptIds: readonly string[];
  readonly uninterruptedForwardEvidence: boolean;
  readonly outageBackfillDetected: boolean;
  readonly blockers: readonly string[];
};

export type ForwardDataAdmissionInput = {
  readonly campaignId: string;
  readonly campaignStartedAt: UtcInstant;
  readonly receipts: readonly ForwardObservationReceipt[];
  readonly outagePeriods?: readonly ForwardOutagePeriod[];
  readonly backfillAttempts?: readonly {
    readonly outageId: string;
    readonly fillerReceipt: ForwardObservationReceipt;
  }[];
};

export type Alpha18QualificationResult = {
  readonly qualified: boolean;
  readonly marker:
    | 'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_QUALIFIED'
    | 'HELIOS_ALPHA18_FORWARD_DATA_ADMISSION_BLOCKED';
  readonly grantsFinancialAuthority: false;
};
