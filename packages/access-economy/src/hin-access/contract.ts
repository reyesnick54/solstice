/**
 * ACCESS-18 port contracts. Dependency direction: orchestrators implement these ports;
 * access-economy consumes them without importing HIN, coin, or consent owners.
 */

import type { Result } from '../../../domain/src/result.ts';
import type { SubjectRef } from '../ids.ts';
import type { HinAccessFailure } from './types.ts';

export type HinOpportunityAcceptancePort = {
  readonly acceptOpportunity: (input: {
    readonly subjectId: string;
    readonly marketOpportunityId: string;
    readonly consentId: string;
  }) => Result<{ readonly accepted: true }, HinAccessFailure>;
  readonly declineOpportunity: (input: {
    readonly subjectId: string;
    readonly marketOpportunityId: string;
  }) => Result<{ readonly declined: true }, HinAccessFailure>;
};

export type HinCompensationSettlementPort = {
  readonly transferExistingSunRey: (input: {
    readonly subjectId: string;
    readonly customerId: string;
    readonly amountMinor: bigint;
    readonly contributionId: string;
  }) => Result<{ readonly settlementRef: string }, HinAccessFailure>;
  readonly creditFiat: (input: {
    readonly subjectId: string;
    readonly customerId: string;
    readonly accountId: string;
    readonly amountMinor: bigint;
    readonly contributionId: string;
  }) => Result<{ readonly settlementRef: string }, HinAccessFailure>;
};

export const HIN_ACCESS_BRIDGE_BOUNDARY = Object.freeze({
  chunk: 'ACCESS-18',
  accessEconomyOwns: 'participation snapshot and bridge orchestration',
  informationMarketOwns: 'HIN opportunity, consent, and settlement adapters',
  personalDataCrossesBoundary: false,
  consentEqualsMint: false,
  onlySettledSrAffectsTwab: true,
});
