import type { CurrencyCode } from '../../../domain/src/currency.ts';
import { Money } from '../../../money/src/money.ts';
import type { RailClass, RailDirection, SettlementClass } from '../rail-types.ts';
import { freezeCandidate } from './provider-profile.ts';
import type {
  CredentialDescriptorRef,
  ExpectedFinalityClass,
  ProviderAcceptanceRef,
  ProviderCandidateState,
  WebhookProfileRef,
} from './types.ts';

export type PaymentRailProviderCandidateProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly railClass: RailClass;
  readonly direction: RailDirection;
  readonly currencies: readonly CurrencyCode[];
  readonly sourceJurisdictions: readonly string[];
  readonly destinationJurisdictions: readonly string[];
  readonly minimumAmount: Money;
  readonly maximumAmount: Money;
  readonly settlementClass: SettlementClass;
  readonly expectedFinalityClass: ExpectedFinalityClass;
  readonly supportsCancellation: boolean;
  readonly supportsReturns: boolean;
  readonly supportsInbound: boolean;
  readonly idempotencyRequired: true;
  readonly queryAfterUnknownRequired: true;
  readonly statusMappingVersion: string;
  readonly credentialDescriptorRef: CredentialDescriptorRef;
  readonly webhookProfileRef: WebhookProfileRef;
  readonly providerAcceptanceRef: ProviderAcceptanceRef;
  readonly state: ProviderCandidateState;
  readonly productionAuthorized: false;
  readonly namedNetworkMembershipClaimed: false;
};

export function freezePaymentRailProviderCandidateProfile(
  input: PaymentRailProviderCandidateProfile,
): PaymentRailProviderCandidateProfile {
  if (input.providerAcceptanceRef.domain !== 'PAYMENT_RAIL') {
    throw new TypeError('rail profile must bind PAYMENT_RAIL');
  }
  if (input.idempotencyRequired !== true) {
    throw new TypeError('rail profile must require provider idempotency');
  }
  if (input.queryAfterUnknownRequired !== true) {
    throw new TypeError('rail profile must require query after SUBMISSION_UNKNOWN');
  }
  if (input.namedNetworkMembershipClaimed !== false) {
    throw new TypeError('engineering rail class must not claim named network membership');
  }
  if (input.productionAuthorized !== false) {
    throw new TypeError('rail productionAuthorized must remain false');
  }
  if (input.minimumAmount.currency !== input.maximumAmount.currency) {
    throw new TypeError('rail amount limits must share a currency');
  }
  if (input.minimumAmount.cmp(input.maximumAmount) > 0) {
    throw new TypeError('rail minimumAmount must not exceed maximumAmount');
  }
  return freezeCandidate({
    ...input,
    currencies: Object.freeze([...input.currencies]),
    sourceJurisdictions: Object.freeze([...input.sourceJurisdictions]),
    destinationJurisdictions: Object.freeze([...input.destinationJurisdictions]),
    credentialDescriptorRef: Object.freeze({ ...input.credentialDescriptorRef, plaintextCredential: false }),
    idempotencyRequired: true,
    queryAfterUnknownRequired: true,
    productionAuthorized: false,
    namedNetworkMembershipClaimed: false,
  });
}

export function railClassIsNotNetworkMembership(profile: PaymentRailProviderCandidateProfile): true {
  void profile.railClass;
  return true;
}
