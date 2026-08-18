import type { MarketState } from '../taxonomy.ts';
import type { ConsumerExchangePolicy } from './policy.ts';
import type { ConsumerEligibilityDecision, ConsumerTradingProfile } from './types.ts';

export function evaluateConsumerEligibility(input: {
  readonly profile: ConsumerTradingProfile;
  readonly policy: ConsumerExchangePolicy;
  readonly marketState: MarketState;
  readonly marketId: string;
}): ConsumerEligibilityDecision {
  const { profile, policy, marketState } = input;
  const reasonCodes: string[] = [];
  const identityEligible = profile.identityClass === 'RETAIL' || profile.identityClass === 'PROFESSIONAL';
  if (!identityEligible) {
    reasonCodes.push('IDENTITY_INELIGIBLE');
  }
  const jurisdictionEligible = policy.permittedJurisdictions.includes(profile.jurisdiction);
  if (!jurisdictionEligible) {
    reasonCodes.push('WRONG_JURISDICTION');
  }
  const accountEligible = profile.accountStatus === 'ACTIVE_SIMULATION';
  if (!accountEligible) {
    reasonCodes.push('ACCOUNT_NOT_ELIGIBLE');
  }
  const marketAvailable =
    input.marketId === policy.nativeMarket.marketId &&
    (marketState === 'OPEN' || marketState === 'PREOPEN' || marketState === 'AUCTION');
  if (input.marketId !== policy.nativeMarket.marketId) {
    reasonCodes.push('MARKET_UNAVAILABLE');
  }
  if (marketState === 'PAUSED' || marketState === 'HALTED' || marketState === 'RESTRICTED' || marketState === 'CLOSED') {
    reasonCodes.push('PAUSED_MARKET');
  }
  if (marketState === 'CLOSE_ONLY' || marketState === 'CANCEL_ONLY') {
    reasonCodes.push('PAUSED_MARKET');
  }
  if (!profile.custodyReady) {
    reasonCodes.push('CUSTODY_NOT_READY');
  }
  if (!profile.walletReady) {
    reasonCodes.push('WALLET_NOT_READY');
  }
  if (!profile.exchangeCapabilityActive) {
    reasonCodes.push('EXCHANGE_CAPABILITY_INACTIVE');
  }
  const complianceClear = profile.complianceState === 'CLEAR';
  if (!complianceClear) {
    reasonCodes.push('COMPLIANCE_RESTRICTED');
  }
  const allowed =
    identityEligible &&
    jurisdictionEligible &&
    accountEligible &&
    marketAvailable &&
    profile.custodyReady &&
    profile.walletReady &&
    profile.exchangeCapabilityActive &&
    complianceClear;
  return Object.freeze({
    profileId: profile.profileId,
    identityEligible,
    jurisdictionEligible,
    accountEligible,
    marketAvailable,
    custodyReady: profile.custodyReady,
    walletReady: profile.walletReady,
    exchangeCapabilityActive: profile.exchangeCapabilityActive,
    complianceClear,
    allowed,
    reasonCodes: Object.freeze(reasonCodes),
  });
}
