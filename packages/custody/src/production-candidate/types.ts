/**
 * Phase D Prompt 3 — provider-independent Travel Rule adapter contract.
 *
 * Applicability is policy/jurisdiction driven. Travel Rule is not required
 * for every blockchain action. An acknowledgement does not authorize
 * withdrawal and does not issue Execution Authority.
 */

import type { TravelRuleApplicability } from '../taxonomy.ts';

export const TRAVEL_RULE_ADAPTER_VERSION = 'phase-d-03/1' as const;

export const TRAVEL_RULE_MESSAGE_STATUSES = [
  'NOT_CREATED',
  'PREPARED',
  'PENDING',
  'ACKNOWLEDGED',
  'COMPLETED',
  'REJECTED',
  'FAILED',
] as const;
export type TravelRuleMessageStatus = (typeof TRAVEL_RULE_MESSAGE_STATUSES)[number];

export const TRAVEL_RULE_COMPLIANCE_STATUSES = [
  'NOT_APPLICABLE',
  'APPLICABLE_PENDING',
  'COMPLETE',
  'REJECTED',
  'FAILED',
  'RESEARCH_REQUIRED',
] as const;
export type TravelRuleComplianceStatus = (typeof TRAVEL_RULE_COMPLIANCE_STATUSES)[number];

export type TravelRuleAdapterRecord = {
  readonly messageId: string;
  readonly transferRef: string;
  readonly counterpartyVasp: string | null;
  readonly originatorRef: string;
  readonly beneficiaryRef: string;
  readonly applicability: TravelRuleApplicability;
  readonly messageStatus: TravelRuleMessageStatus;
  readonly complianceStatus: TravelRuleComplianceStatus;
  readonly authorizesWithdrawal: false;
  readonly requiredForEveryBlockchainAction: false;
  readonly piiOnChain: false;
};

export const TRAVEL_RULE_ADAPTER_FLAGS = Object.freeze({
  productionAuthorized: false,
  liveNetworkConnected: false,
  acknowledgementAuthorizesWithdrawal: false,
  requiredIndiscriminately: false,
});
