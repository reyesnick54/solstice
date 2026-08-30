/**
 * ACCESS-18 — Human Information to SunRey to Access bridge types.
 */

import type { SubjectRef } from '../ids.ts';
import type { AccessEpochId } from '../participation/types.ts';

export type DataOpportunityId = `dataopp_${string}`;
export type CompensationSettlementId = `compsett_${string}`;
export type ParticipationEventId = `partevt_${string}`;

export type CompensationPathKind =
  | 'EXISTING_SR_TRANSFER'
  | 'FIAT_PAYMENT'
  | 'GOVERNED_SUNREY_ISSUANCE';

export type DataOpportunityStatus =
  | 'FUNDED'
  | 'OPEN'
  | 'OPTED_IN'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REVOKED';

export type DataOpportunityView = Readonly<{
  readonly opportunityId: DataOpportunityId;
  readonly requesterLabel: string;
  readonly informationRequested: string;
  readonly purpose: string;
  readonly permittedPurposeRef: string;
  readonly compensationPath: CompensationPathKind;
  readonly compensationAmountMinor: bigint;
  readonly compensationAsset: 'SUNREY_COIN' | 'FIAT_MONEY';
  readonly fundedAmountMinor: bigint;
  readonly expiresAt: string;
  readonly revocationRules: string;
  readonly status: DataOpportunityStatus;
  readonly rawPdvExposed: false;
}>;

export type ParticipationHistoryEntry = Readonly<{
  readonly eventId: ParticipationEventId;
  readonly opportunityId: DataOpportunityId;
  readonly subjectRef: SubjectRef;
  readonly action: 'OPTED_IN' | 'DECLINED' | 'COMPLETED' | 'REVOKED';
  readonly occurredAt: string;
  readonly contributionId: string | null;
  readonly dataUsedForAccessWeighting: false;
}>;

export type CompensationHistoryEntry = Readonly<{
  readonly settlementId: CompensationSettlementId;
  readonly opportunityId: DataOpportunityId;
  readonly subjectRef: SubjectRef;
  readonly contributionId: string;
  readonly compensationPath: CompensationPathKind;
  readonly amountMinor: bigint;
  readonly asset: 'SUNREY_COIN' | 'FIAT_MONEY';
  readonly settledAt: string;
  readonly minted: false;
  readonly retroactiveClawback: false;
}>;

export type ConsentStatusView = Readonly<{
  readonly subjectRef: SubjectRef;
  readonly activeConsents: number;
  readonly revokedConsents: number;
  readonly participationEligible: boolean;
  readonly rawPdvExposed: false;
}>;

export type HinAccessFailureCode =
  | 'OPPORTUNITY_UNKNOWN'
  | 'OPPORTUNITY_EXPIRED'
  | 'OPPORTUNITY_NOT_FUNDED'
  | 'ALREADY_SETTLED'
  | 'DUPLICATE_CONTRIBUTION'
  | 'FAKE_CONTRIBUTION'
  | 'CONSENT_REVOKED_BEFORE_USE'
  | 'PURPOSE_MISMATCH'
  | 'RAW_DATA_EXPORT_DENIED'
  | 'AI_CANNOT_AUTHORIZE_COMPENSATION'
  | 'CONSENT_CANNOT_MINT'
  | 'DATA_CANNOT_MINT'
  | 'CLEAN_ROOM_CANNOT_MINT'
  | 'HUMAN_WORTH_SCORE_FORBIDDEN'
  | 'PROTECTED_TRAIT_MULTIPLIER_FORBIDDEN'
  | 'DIRECT_DATA_TO_ACCESS_FORBIDDEN'
  | 'DUPLICATE_SETTLEMENT'
  | 'USER_DECLINED'
  | 'COMPENSATION_REFUSED'
  | 'GOVERNED_ISSUANCE_NOT_AUTHORIZED'
  | 'COMPUTATION_FAILED'
  | 'CONTRIBUTION_NOT_VERIFIED';

export type HinAccessFailure = Readonly<{
  readonly code: HinAccessFailureCode;
  readonly message: string;
}>;

export type HinAccessEpochBinding = Readonly<{
  readonly epochId: AccessEpochId;
  readonly subjectRef: SubjectRef;
  readonly srTwabMinor: bigint;
  readonly dataBonusApplied: false;
}>;
