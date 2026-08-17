import type { IdentityFacts } from '../../../identity/src/facts.ts';
import type { ScreeningEvidenceFact } from '../../../kernel/src/regulated/screening.ts';
import type { RequiredProviderOutageDecision } from '../../../kernel/src/regulated/outage.ts';
import type { TravelRuleDecision } from '../types.ts';
import { destinationMatchesApproval, type BoundDestination } from './destinations.ts';
import type { CustodyActivationRecord } from './hsm-activation.ts';
import { travelRuleBlocksWithdrawal, type TravelRuleExchangeRecord } from './travel-rule-port.ts';

export const WITHDRAWAL_GATE_DECISIONS = [
  'ELIGIBLE',
  'UNAVAILABLE',
  'REJECTED',
  'TRAVEL_RULE_PENDING',
  'DESTINATION_UNVERIFIED',
  'DUAL_CONTROL_REQUIRED',
  'SIGNING_NOT_READY',
] as const;
export type WithdrawalGateDecision = (typeof WITHDRAWAL_GATE_DECISIONS)[number];

export type WithdrawalGateInput = {
  readonly identity: IdentityFacts;
  readonly screening: readonly ScreeningEvidenceFact[];
  readonly travelRule: TravelRuleDecision | null;
  readonly travelRuleRecord: TravelRuleExchangeRecord | null;
  readonly destination: BoundDestination;
  readonly chainId: string;
  readonly networkId: string;
  readonly address: string;
  readonly velocityExceeded: boolean;
  readonly riskBlocked: boolean;
  readonly custodyApproved: boolean;
  readonly dualControlSatisfied: boolean;
  readonly requiredApprovals: number;
  readonly approvalCount: number;
  readonly signingReady: boolean;
  readonly securityHalt: boolean;
  readonly jurisdictionDenied: boolean;
  readonly providerOutage: RequiredProviderOutageDecision | null;
  readonly hsm: CustodyActivationRecord;
};

export type WithdrawalGateResult = {
  readonly decision: WithdrawalGateDecision;
  readonly reasonCodes: readonly string[];
  readonly postsJournal: false;
};

export function evaluateWithdrawalGate(input: WithdrawalGateInput): WithdrawalGateResult {
  const reasons: string[] = [];
  if (input.providerOutage?.actionUnavailable) {
    return freezeGate('UNAVAILABLE', [...input.providerOutage.reasonCodes, 'NO_SILENT_BYPASS']);
  }
  if (!input.identity.kycFresh || input.identity.kycState !== 'VERIFIED') {
    reasons.push('IDENTITY_NOT_READY');
  }
  if (input.screening.some((fact) => fact.outcome === 'BLOCK' || fact.outcome === 'HOLD')) {
    reasons.push('SCREENING_HIT');
  }
  if (input.screening.some((fact) => fact.outcome === 'UNAVAILABLE')) {
    return freezeGate('UNAVAILABLE', ['SCREENING_UNAVAILABLE', 'NO_SILENT_BYPASS']);
  }
  if (travelRuleBlocksWithdrawal({ decision: input.travelRule, record: input.travelRuleRecord })) {
    return freezeGate('TRAVEL_RULE_PENDING', ['TRAVEL_RULE_REQUIRED_STATE']);
  }
  if (!destinationMatchesApproval(input.destination, input.chainId, input.networkId, input.address)) {
    return freezeGate('DESTINATION_UNVERIFIED', ['DESTINATION_BINDING_MISMATCH']);
  }
  if (input.velocityExceeded) {
    reasons.push('VELOCITY_EXCEEDED');
  }
  if (input.riskBlocked) {
    reasons.push('RISK_BLOCKED');
  }
  if (input.jurisdictionDenied) {
    reasons.push('JURISDICTION_DENIED');
  }
  if (input.securityHalt) {
    reasons.push('SECURITY_HALT');
  }
  if (!input.hsm.healthy) {
    return freezeGate('SIGNING_NOT_READY', ['HSM_UNAVAILABLE']);
  }
  if (!input.signingReady) {
    return freezeGate('SIGNING_NOT_READY', ['SIGNING_NOT_READY']);
  }
  if (!input.custodyApproved || !input.dualControlSatisfied || input.approvalCount < input.requiredApprovals) {
    return freezeGate('DUAL_CONTROL_REQUIRED', ['DUAL_CONTROL_UNSATISFIED']);
  }
  if (reasons.length > 0) {
    return freezeGate('REJECTED', reasons);
  }
  return freezeGate('ELIGIBLE', ['ELIGIBLE']);
}

function freezeGate(decision: WithdrawalGateDecision, reasonCodes: readonly string[]): WithdrawalGateResult {
  return Object.freeze({
    decision,
    reasonCodes: Object.freeze([...reasonCodes]),
    postsJournal: false,
  });
}
