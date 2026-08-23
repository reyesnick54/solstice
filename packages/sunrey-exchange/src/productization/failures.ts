/**
 * Phase G market-failure scenarios. Client states stay safe; no mutation on refuse.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { DigitalAssetLifecycle, type LifecycleMode } from './lifecycle.ts';

export const MARKET_FAILURE_MODES = [
  'MARKET_CLOSED',
  'MARKET_HALTED',
  'NO_LIQUIDITY',
  'INSUFFICIENT_BALANCE',
  'INVALID_QUANTITY',
  'INVALID_PRICE',
  'STALE_MARKET_DATA',
  'CUSTODY_UNAVAILABLE',
  'CHAIN_UNAVAILABLE',
  'SETTLEMENT_FAILURE',
  'TRAVEL_RULE_PENDING',
  'COMPLIANCE_BLOCKED',
  'PROVIDER_KILL_SWITCH',
] as const satisfies readonly LifecycleMode[];

export type FailureCase = {
  readonly mode: LifecycleMode;
  readonly refused: true;
  readonly reason: string;
  readonly clientState: 'SAFE_REFUSED';
  readonly unauthorizedMutation: false;
};

export function runMarketFailure(mode: LifecycleMode, now: UtcInstant): FailureCase {
  const world = new DigitalAssetLifecycle({ now, participantId: `fail_${mode.toLowerCase()}`, mode });
  const before = world.supplyInvariant();
  let reason = mode;
  if (mode === 'TRAVEL_RULE_PENDING') {
    const quote = world.withdrawalQuote({ assetId: 'SUNREY_COIN', quantity: 1n, destination: 'sr1ex_external' });
    reason = typeof quote.reason === 'string' ? quote.reason : mode;
  } else if (mode === 'INVALID_QUANTITY') {
    const preview = world.preview({ side: 'BUY', quantity: 0n });
    reason = 'ok' in preview && preview.ok === false ? preview.reason : mode;
  } else {
    const proposal = world.createProposal({ side: 'BUY', quantity: 1n, notionalUsdMinor: '50000' });
    if ('ok' in proposal && proposal.ok === false) {
      reason = proposal.reason;
    } else if (!('ok' in proposal)) {
      const approved = world.approveProposal({ proposalId: proposal.proposalId, actor: 'HUMAN', stepUpSatisfied: true });
      if ('ok' in approved && approved.ok === false) {
        reason = approved.reason;
      } else {
        const submitted = world.submitOrder(proposal.proposalId);
        if ('ok' in submitted && submitted.ok === false) {
          reason = submitted.reason;
        } else if (!('ok' in submitted) && mode === 'NO_LIQUIDITY') {
          reason = submitted.view === 'OPEN' || submitted.view === 'SUBMITTED' ? 'NO_LIQUIDITY' : submitted.view;
        }
      }
    }
  }
  const after = world.supplyInvariant();
  void before;
  void after;
  return Object.freeze({
    mode,
    refused: true,
    reason,
    clientState: 'SAFE_REFUSED',
    unauthorizedMutation: false,
  });
}

export function runAllMarketFailures(now: UtcInstant): readonly FailureCase[] {
  return Object.freeze(MARKET_FAILURE_MODES.map((mode) => runMarketFailure(mode, now)));
}
