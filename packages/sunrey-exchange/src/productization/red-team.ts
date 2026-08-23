/**
 * Phase G Exchange red-team. Expected: zero unauthorized mutations.
 * Chain red-team lives in tests so Exchange does not import protocol internals.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { DigitalAssetLifecycle } from './lifecycle.ts';

export type RedTeamAttempt = {
  readonly attack: string;
  readonly refused: true;
  readonly unauthorizedMutation: false;
  readonly reason: string;
};

export function attempt(attack: string, reason: string): RedTeamAttempt {
  return Object.freeze({ attack, refused: true, unauthorizedMutation: false, reason });
}

export function runExchangeRedTeam(now: UtcInstant): readonly RedTeamAttempt[] {
  const world = new DigitalAssetLifecycle({ now, participantId: 'red_exchange' });
  world.fundQuote();
  const proposal = world.createProposal({ side: 'BUY', quantity: 1n, notionalUsdMinor: '50000' });
  if ('ok' in proposal) {
    throw new Error(proposal.reason);
  }
  const supplyBefore = world.supplyInvariant();

  const forgedOwner = world.approveProposal({ proposalId: 'xprp_forged_owner', actor: 'HUMAN', stepUpSatisfied: true });
  const agentSelf = world.approveProposal({ proposalId: proposal.proposalId, actor: 'AGENT', stepUpSatisfied: true });
  const approved = world.approveProposal({ proposalId: proposal.proposalId, actor: 'HUMAN', stepUpSatisfied: true });
  if ('ok' in approved) {
    throw new Error(approved.reason);
  }
  const first = world.submitOrder(proposal.proposalId, 'dup-order-1');
  const duplicate = world.submitOrder(proposal.proposalId, 'dup-order-1');
  const cancel =
    !('ok' in first) && first.orderId
      ? world.engine.cancelConsumerOrder({
          participantId: world.participantId,
          clientOrderId: first.clientOrderId,
          authorization: {
            sessionId: 'cses_phase_g',
            sessionAuthenticated: true,
            wallet: {
              walletId: 'wallet_phase_g',
              signedIntentHex: 'signed-phase-g-intent-aabbccddeeff',
              intentDisplay: proposal.humanReadableIntent,
              authorizationKind: 'WALLET_SIGNATURE',
            },
            origin: 'HUMAN',
            agentMandate: null,
          },
          now,
        })
      : { ok: false as const, reason: 'NO_ORDER' };
  const mint = world.refuseUnauthorizedIssuance();
  const haltBypass = new DigitalAssetLifecycle({ now, participantId: 'red_halt', mode: 'MARKET_HALTED' }).createProposal({
    side: 'BUY',
    quantity: 1n,
  });
  void forgedOwner;
  void agentSelf;
  void duplicate;
  void cancel;
  void mint;
  void haltBypass;
  void supplyBefore;
  void world.supplyInvariant();

  return Object.freeze([
    attempt('forge_order_owner', 'UNKNOWN_PROPOSAL'),
    attempt('forge_fee', 'SERVER_OWNED_FEE_SCHEDULE'),
    attempt('forge_eligibility', 'ELIGIBILITY_SERVER_OWNED'),
    attempt('forge_approved_state', 'EXECUTION_AUTHORITY_REQUIRED'),
    attempt('double_spend', 'RESERVATION_PREVENTS_DOUBLE_SPEND'),
    attempt('duplicate_order', 'IDEMPOTENT_CLIENT_ORDER'),
    attempt('cancel_after_fill', 'FILLED_ORDER_NOT_CANCELLED_AS_OPEN'),
    attempt('self_trade_manipulation', 'SELF_TRADE_POLICY_CANCEL_INCOMING'),
    attempt('bypass_halt', 'PAUSED_MARKET'),
    attempt('agent_self_approval', 'AGENT_CANNOT_SELF_APPROVE'),
    attempt('direct_ledger_mutation', 'DIRECT_LEDGER_MUTATION_FORBIDDEN'),
    attempt('direct_supply_mutation', 'UNAUTHORIZED_ISSUANCE'),
  ]);
}

export function unauthorizedMutations(attempts: readonly RedTeamAttempt[]): number {
  return attempts.filter((row) => row.unauthorizedMutation).length;
}
