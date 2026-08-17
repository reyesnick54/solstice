export const DEPOSIT_STATES = [
  'NOTICE_RECEIVED',
  'NORMALIZED',
  'ADDRESS_MAPPED',
  'SCREENED',
  'AWAITING_FINALITY',
  'FINAL',
  'POLICY_CHECKED',
  'AUTHORIZED',
  'CREDITED',
  'BLOCKED',
] as const;
export type DepositState = (typeof DEPOSIT_STATES)[number];

export const WITHDRAWAL_STATES = [
  'REQUESTED',
  'ELIGIBLE',
  'DESTINATION_SCREENED',
  'TRAVEL_RULE_PENDING',
  'TRAVEL_RULE_ACKNOWLEDGED',
  'RISK_CHECKED',
  'POLICY_CHECKED',
  'AUTHORIZED',
  'HELD',
  'SUBMITTED',
  'SUBMISSION_UNKNOWN',
  'FINALIZED',
  'SETTLED',
  'MATCHED',
  'BLOCKED',
] as const;
export type WithdrawalState = (typeof WITHDRAWAL_STATES)[number];

export const DESTINATION_SCREENING_OUTCOMES = ['CLEAR', 'REVIEW', 'BLOCK'] as const;
export type DestinationScreeningOutcome = (typeof DESTINATION_SCREENING_OUTCOMES)[number];

export const TRAVEL_RULE_APPLICABILITY = [
  'NOT_APPLICABLE',
  'REQUIRED_BY_PACK',
  'RESEARCH_REQUIRED',
] as const;
export type TravelRuleApplicability = (typeof TRAVEL_RULE_APPLICABILITY)[number];

export const TRAVEL_RULE_LEGAL_STATUS = 'RESEARCH_REQUIRED' as const;

export const CUSTODY_RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'DEPOSIT_CREDIT_MISMATCH',
  'WITHDRAWAL_CHAIN_MISMATCH',
  'PROVIDER_LEDGER_MISMATCH',
  'INVESTIGATION_REQUIRED',
] as const;
export type CustodyReconciliationOutcome = (typeof CUSTODY_RECONCILIATION_OUTCOMES)[number];

export const EVIDENCE_KIND_CUSTODY = 'sunrey-custody';

export const CUSTODY_PROVIDER_MODE = 'SIMULATION_ONLY' as const;

export const NATIVE_CHAIN_FINALITY = ['PENDING_PROPOSAL', 'MEMPOOL', 'BFT_FINALIZED'] as const;
export type NativeChainFinality = (typeof NATIVE_CHAIN_FINALITY)[number];
