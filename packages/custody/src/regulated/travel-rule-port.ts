import type { EncryptedEnvelope } from '../../../security/src/envelope.ts';
import type { TravelRuleDecision } from '../types.ts';

export const TRAVEL_RULE_MESSAGE_STATES = [
  'NOT_REQUIRED',
  'REQUIRED',
  'PENDING',
  'DELIVERED',
  'FAILED',
] as const;
export type TravelRuleMessageState = (typeof TRAVEL_RULE_MESSAGE_STATES)[number];

export type TravelRuleCounterparty = {
  readonly discovered: boolean;
  readonly counterpartyRef: string | null;
  readonly jurisdiction: string | null;
  readonly publicChainPii: false;
};

export type TravelRuleExchangeRecord = {
  readonly messageId: string;
  readonly withdrawalId: string;
  readonly state: TravelRuleMessageState;
  readonly providerTransactionRef: string | null;
  readonly requiredOriginatorPresent: boolean;
  readonly requiredBeneficiaryPresent: boolean;
  readonly envelope: EncryptedEnvelope | null;
  readonly evidenceRefs: readonly string[];
  readonly publicChainContainsRawPii: false;
};

export type TravelRuleProviderPort = {
  discoverCounterparty(address: string): TravelRuleCounterparty;
  exchangeRequiredData(input: {
    readonly withdrawalId: string;
    readonly destination: string;
    readonly originatorRef: string;
    readonly beneficiaryRef: string;
  }): TravelRuleExchangeRecord;
  status(messageId: string): TravelRuleMessageState;
};

export function travelRuleBlocksWithdrawal(input: {
  readonly decision: TravelRuleDecision | null;
  readonly record: TravelRuleExchangeRecord | null;
}): boolean {
  if (input.decision?.applicability === 'REQUIRED_BY_PACK') {
    if (!input.record || input.record.state === 'PENDING' || input.record.state === 'FAILED') {
      return true;
    }
    if (input.record.state !== 'DELIVERED') {
      return true;
    }
  }
  return false;
}
