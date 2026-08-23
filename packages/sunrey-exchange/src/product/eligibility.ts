import { travelRuleBlocksWithdrawal } from '../../../custody/src/regulated/travel-rule-port.ts';
import type {
  CapabilityDecision,
  ExchangeCapability,
  ProductEligibilityDecision,
  TravelRuleHookInput,
} from './types.ts';

export type EligibilityFacts = {
  readonly ownerId: string;
  readonly marketId: string | null;
  readonly identityVerified: boolean;
  readonly kycState: 'VERIFIED' | 'IN_PROGRESS' | 'UNVERIFIED' | 'REJECTED';
  readonly jurisdiction: string;
  readonly permittedJurisdictions: readonly string[];
  readonly sanctionsHit: boolean;
  readonly riskRestricted: boolean;
  readonly accountStatus: 'ACTIVE_SIMULATION' | 'RESTRICTED' | 'SUSPENDED' | 'CLOSED' | 'PENDING';
  readonly listingStatus: 'SIMULATION_LISTED' | 'SUSPENDED' | 'DELISTED' | 'RESEARCH_REQUIRED' | 'UNKNOWN';
  readonly investorClass: 'RETAIL' | 'PROFESSIONAL' | 'INSTITUTION' | 'UNKNOWN';
  readonly productAllowedForClass: boolean;
  readonly custodyAvailable: boolean;
  readonly chainAvailable: boolean;
  readonly marketOpen: boolean;
  readonly travelRule: TravelRuleHookInput;
};

export function evaluateCapability(capability: ExchangeCapability, facts: EligibilityFacts): CapabilityDecision {
  const reasons: string[] = [];
  if (!facts.identityVerified || facts.kycState !== 'VERIFIED') {
    reasons.push('IDENTITY_INELIGIBLE');
  }
  if (!facts.permittedJurisdictions.includes(facts.jurisdiction)) {
    reasons.push('JURISDICTION_DENIED');
  }
  if (facts.sanctionsHit) {
    reasons.push('SANCTIONS_HIT');
  }
  if (facts.riskRestricted) {
    reasons.push('RISK_RESTRICTED');
  }
  if (facts.accountStatus !== 'ACTIVE_SIMULATION') {
    reasons.push('ACCOUNT_NOT_ELIGIBLE');
  }
  if (capability === 'CAN_TRADE') {
    if (facts.listingStatus !== 'SIMULATION_LISTED') {
      reasons.push('LISTING_UNAVAILABLE');
    }
    if (!facts.productAllowedForClass) {
      reasons.push('INVESTOR_CLASS_DENIED');
    }
    if (!facts.marketOpen) {
      reasons.push('MARKET_NOT_OPEN');
    }
    if (!facts.custodyAvailable && !facts.chainAvailable) {
      reasons.push('SETTLEMENT_RAIL_UNAVAILABLE');
    }
  }
  if (capability === 'CAN_DEPOSIT') {
    if (!facts.custodyAvailable && !facts.chainAvailable) {
      reasons.push('PROVIDER_UNAVAILABLE');
    }
  }
  if (capability === 'CAN_WITHDRAW') {
    if (!facts.custodyAvailable && !facts.chainAvailable) {
      reasons.push('PROVIDER_UNAVAILABLE');
    }
    if (travelRuleHook(facts.travelRule).blocksWithdrawal) {
      reasons.push('TRAVEL_RULE_PENDING');
    }
  }
  return Object.freeze({
    capability,
    allowed: reasons.length === 0,
    reasonCodes: Object.freeze(reasons),
  });
}

export function travelRuleHook(input: TravelRuleHookInput): {
  readonly applicable: boolean;
  readonly blocksWithdrawal: boolean;
  readonly state: TravelRuleHookInput['messageState'];
} {
  const applicable = input.requiredByPack;
  const blocksWithdrawal = travelRuleBlocksWithdrawal({
    decision: applicable
      ? {
          applicability: 'REQUIRED_BY_PACK',
          packId: 'simulation',
          packVersion: '1',
          thresholdSource: 'SIMULATION_POLICY_PACK',
          legalStatus: 'RESEARCH_REQUIRED',
          notALegalConclusion: true,
        }
      : {
          applicability: 'NOT_APPLICABLE',
          packId: 'simulation',
          packVersion: '1',
          thresholdSource: 'SIMULATION_POLICY_PACK',
          legalStatus: 'RESEARCH_REQUIRED',
          notALegalConclusion: true,
        },
    record: applicable
      ? {
          messageId: `trv_${input.ownerId}`,
          withdrawalId: `wd_${input.ownerId}`,
          state: input.messageState === 'NOT_REQUIRED' ? 'REQUIRED' : input.messageState,
          providerTransactionRef: null,
          requiredOriginatorPresent: input.messageState === 'DELIVERED',
          requiredBeneficiaryPresent: input.messageState === 'DELIVERED',
          envelope: null,
          evidenceRefs: [],
          publicChainContainsRawPii: false,
        }
      : null,
  });
  return Object.freeze({
    applicable,
    blocksWithdrawal,
    state: input.messageState,
  });
}

export function evaluateProductEligibility(facts: EligibilityFacts): ProductEligibilityDecision {
  const travel = travelRuleHook(facts.travelRule);
  return Object.freeze({
    ownerId: facts.ownerId,
    marketId: facts.marketId,
    canTrade: evaluateCapability('CAN_TRADE', facts),
    canDeposit: evaluateCapability('CAN_DEPOSIT', facts),
    canWithdraw: evaluateCapability('CAN_WITHDRAW', facts),
    travelRule: travel,
    productionTradingEnabled: false,
  });
}

export function defaultEligibilityFacts(ownerId: string, marketId: string | null = null): EligibilityFacts {
  return {
    ownerId,
    marketId,
    identityVerified: true,
    kycState: 'VERIFIED',
    jurisdiction: 'GB',
    permittedJurisdictions: ['GB'],
    sanctionsHit: false,
    riskRestricted: false,
    accountStatus: 'ACTIVE_SIMULATION',
    listingStatus: 'SIMULATION_LISTED',
    investorClass: 'RETAIL',
    productAllowedForClass: true,
    custodyAvailable: true,
    chainAvailable: true,
    marketOpen: true,
    travelRule: {
      ownerId,
      destination: null,
      amountMinorUnits: 0n,
      assetId: 'SUNREY_COIN',
      requiredByPack: false,
      messageState: 'NOT_REQUIRED',
    },
  };
}
