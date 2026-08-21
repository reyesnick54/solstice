import { FixtureTravelRuleCandidate } from '../../../custody/src/provider-candidate/travel-rule.ts';
import { travelRuleBlocksWithdrawal } from '../../../custody/src/regulated/travel-rule-port.ts';
import type { TravelRuleDecision } from '../../../custody/src/types.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'TRAVEL_RULE_ACK_IS_NOT_WITHDRAWAL_AUTHORITY',
  'PII_NOT_PUBLIC_CHAIN',
  'NO_RAW_SECRET_EXPOSURE',
  'EXECUTION_AUTHORITY_REQUIRED',
] as const;

export const travelRuleScenarios: readonly AttackScenario[] = [
  'TRAVEL-WRONG-RECIPIENT',
  'TRAVEL-REPLAY',
  'TRAVEL-DUPLICATE-ACK',
  'TRAVEL-PLAINTEXT-LOG',
  'TRAVEL-PUBLIC-CHAIN',
  'TRAVEL-RECIPIENT-MISMATCH',
  'TRAVEL-ACK-AS-WITHDRAWAL',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15840 + index,
    category: 'TRAVEL_RULE_ABUSE',
    subsystem: 'travel-rule',
    attack: scenarioId.toLowerCase().replace('travel-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'TRAVEL_RULE_ACK_NOT_AUTHORITY',
  }),
);

export function runTravelRule(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const candidate = new FixtureTravelRuleCandidate();
    const prepared = candidate.prepare({
      messageId: 'tr_range_1',
      withdrawalId: 'wd_range_1',
      recipientBinding: 'vasp_b',
      originatorRef: 'orig_ref',
      beneficiaryRef: 'bene_ref',
      amountMinor: '1000',
      currency: 'USD',
    });
    if (!('messageId' in prepared)) {
      return { blocked: false, safetyHeld: false, detail: 'ok' in prepared ? prepared.reasonCode : 'missing_message' };
    }
    const message = prepared;
    const wrong = candidate.acknowledge({ messageId: message.messageId, recipientBinding: 'vasp_wrong' });
    const replay = candidate.prepare({
      messageId: 'tr_range_1',
      withdrawalId: 'wd_range_1',
      recipientBinding: 'vasp_b',
      originatorRef: 'orig_ref',
      beneficiaryRef: 'bene_ref',
      amountMinor: '1000',
      currency: 'USD',
    });
    const ack = candidate.acknowledge({ messageId: message.messageId, recipientBinding: 'vasp_b' });
    const ackOk = !('ok' in ack);
    const blocked =
      'ok' in wrong && wrong.ok === false &&
      'ok' in replay && replay.ok === false &&
      ackOk &&
      ack.authorizesWithdrawal === false &&
      candidate.travelRuleAckAuthorizesWithdrawal() === false &&
      candidate.payloadOnChain() === false &&
      message.loggedPlaintext === false &&
      message.publicChainContainsRawPii === false &&
      travelRuleBlocksWithdrawal({
        decision: {
          applicability: 'REQUIRED_BY_PACK',
          packId: 'pack_sim',
          packVersion: '1',
          thresholdSource: 'SIMULATION_POLICY_PACK',
          legalStatus: 'RESEARCH_REQUIRED',
          notALegalConclusion: true,
        } satisfies TravelRuleDecision,
        record: null,
      }) === true;
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} wrong=${'ok' in wrong && wrong.ok === false ? wrong.reasonCode : 'accepted'} replay=${'ok' in replay && replay.ok === false ? replay.reasonCode : 'accepted'} ackAuthorizes=${String(candidate.travelRuleAckAuthorizesWithdrawal())}`,
    };
  });
}
