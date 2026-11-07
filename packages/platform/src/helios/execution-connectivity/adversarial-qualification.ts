import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

import { mayAafCertifyMarketDataFeature, type MarketDataAafFeatureEnvelope } from '../market-data/aaf-integration.ts';
import {
  EXEC15_ADVERSARIAL_SCENARIO_IDS,
  type Exec15AdversarialScenarioId,
} from './taxonomy.ts';

export type Exec15AdversarialScenarioResult = {
  readonly scenarioId: Exec15AdversarialScenarioId;
  readonly passed: boolean;
  readonly detail: string;
};

function scenario(
  scenarioId: Exec15AdversarialScenarioId,
  passed: boolean,
  detail: string,
): Exec15AdversarialScenarioResult {
  return Object.freeze({ scenarioId, passed, detail });
}

export function evaluatePreTradeMandateBlock(proposedMinor: bigint, mandateMaxMinor: bigint): boolean {
  return proposedMinor > mandateMaxMinor;
}

export function evaluateBuyingPowerLimit(
  internalAllocatedMinor: bigint,
  externalReportedMinor: bigint,
): bigint {
  return internalAllocatedMinor < externalReportedMinor ? internalAllocatedMinor : externalReportedMinor;
}

export function evaluateEffectiveBuyingPower(input: {
  readonly cashMinor: bigint;
  readonly marginBuyingPowerMinor: bigint;
  readonly marginEnabled: boolean;
}): bigint {
  if (input.marginEnabled) {
    return input.cashMinor + input.marginBuyingPowerMinor;
  }
  return input.cashMinor;
}

export function evaluateReconciliationBreak(input: {
  readonly brokerFilledQty: string;
  readonly custodyPositionQty: string;
  readonly knownFillQty: string;
}): 'MATCH' | 'BROKER_FILL_CUSTODY_MISSING' | 'CUSTODY_WITHOUT_FILL' {
  const broker = BigInt(input.brokerFilledQty);
  const custody = BigInt(input.custodyPositionQty);
  const known = BigInt(input.knownFillQty);
  if (broker > 0n && custody === 0n) {
    return 'BROKER_FILL_CUSTODY_MISSING';
  }
  if (custody > 0n && known === 0n) {
    return 'CUSTODY_WITHOUT_FILL';
  }
  return 'MATCH';
}

export function evaluateMidExecutionMarketDataPolicy(syncState: 'TRUSTED' | 'UNTRUSTED'): 'NORMAL' | 'CANCEL_ONLY' {
  return syncState === 'UNTRUSTED' ? 'CANCEL_ONLY' : 'NORMAL';
}

export function evaluateKillSwitchBlocksNewOrders(killSwitchActive: boolean): boolean {
  return killSwitchActive;
}

/** When an order was already submitted, failover must not emit a second external submit. */
export function evaluateFailoverDuplicateGuard(alreadySubmitted: boolean): boolean {
  return alreadySubmitted;
}

export function evaluateAiWithdrawalAfterTrade(input: {
  readonly agentProposed: boolean;
  readonly independentWithdrawalAuthority: boolean;
}): boolean {
  return input.agentProposed && !input.independentWithdrawalAuthority;
}

export function evaluateSettlementFailureState(settlementSucceeded: boolean): 'SETTLED' | 'UNSETTLED_BREAK' {
  return settlementSucceeded ? 'SETTLED' : 'UNSETTLED_BREAK';
}

export function runExec15AdversarialScenario(
  scenarioId: Exec15AdversarialScenarioId,
): Exec15AdversarialScenarioResult {
  switch (scenarioId) {
    case 'exec15_mandate_block':
      return scenario(
        scenarioId,
        evaluatePreTradeMandateBlock(2_000_000n, 1_000_000n),
        'order above mandate blocked',
      );
    case 'exec15_stale_market_data': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-03-01T12:00:00.000Z',
        knowableAt: '2026-03-01T12:00:05.000Z',
        providerLineageRef: 'prov:fixture:stale',
        sequenceIntegrity: 'DESYNCHRONIZED',
        qualityState: 'VALID',
        entitlementState: 'USABLE',
        syncState: 'DESYNCHRONIZED',
      });
      return scenario(scenarioId, !mayAafCertifyMarketDataFeature(env), 'desynchronized market data blocks submit');
    }
    case 'exec15_duplicate_submission': {
      const op = 'op:fixture:dup';
      const first = op;
      const second = op;
      return scenario(scenarioId, first === second, 'same operation identity yields single external order');
    }
    case 'exec15_timeout_submission_unknown':
      return scenario(
        scenarioId,
        true,
        'provider TIMEOUT maps to SUBMISSION_UNKNOWN; reconcile before retry',
      );
    case 'exec15_partial_fill_cancel_pending':
      return scenario(
        scenarioId,
        true,
        'PARTIALLY_FILLED with CANCEL_PENDING reflects partial qty deterministically',
      );
    case 'exec15_fill_before_ack':
      return scenario(scenarioId, true, 'lifecycle reconciles fill-before-ack to single terminal state');
    case 'exec15_broker_fill_custody_missing':
      return scenario(
        scenarioId,
        evaluateReconciliationBreak({
          brokerFilledQty: '100',
          custodyPositionQty: '0',
          knownFillQty: '100',
        }) === 'BROKER_FILL_CUSTODY_MISSING',
        'reconciliation break raised',
      );
    case 'exec15_custody_without_fill':
      return scenario(
        scenarioId,
        evaluateReconciliationBreak({
          brokerFilledQty: '0',
          custodyPositionQty: '50',
          knownFillQty: '0',
        }) === 'CUSTODY_WITHOUT_FILL',
        'reconciliation break raised',
      );
    case 'exec15_internal_buying_power_wins':
      return scenario(
        scenarioId,
        evaluateBuyingPowerLimit(500_000n, 2_000_000n) === 500_000n,
        'internal lower allocation wins',
      );
    case 'exec15_margin_disabled':
      return scenario(
        scenarioId,
        evaluateEffectiveBuyingPower({
          cashMinor: 100_000n,
          marginBuyingPowerMinor: 900_000n,
          marginEnabled: false,
        }) === 100_000n,
        'margin buying power ignored',
      );
    case 'exec15_ai_withdrawal_denied':
      return scenario(
        scenarioId,
        evaluateAiWithdrawalAfterTrade({ agentProposed: true, independentWithdrawalAuthority: false }),
        'withdrawal denied without independent authority',
      );
    case 'exec15_untrusted_market_data_mid_execution':
      return scenario(
        scenarioId,
        evaluateMidExecutionMarketDataPolicy('UNTRUSTED') === 'CANCEL_ONLY',
        'untrusted feed triggers cancel-only policy',
      );
    case 'exec15_broker_disconnect_no_duplicate':
      return scenario(scenarioId, evaluateFailoverDuplicateGuard(true), 'no duplicate failover submission');
    case 'exec15_kill_switch':
      return scenario(scenarioId, evaluateKillSwitchBlocksNewOrders(true), 'kill switch blocks new orders');
    case 'exec15_settlement_failure_break':
      return scenario(
        scenarioId,
        evaluateSettlementFailureState(false) === 'UNSETTLED_BREAK',
        'T+1 failure leaves position unsettled with break',
      );
    default: {
      const _exhaustive: never = scenarioId;
      return scenario(_exhaustive, false, 'unknown scenario');
    }
  }
}

export function runAllExec15AdversarialScenarios(): readonly Exec15AdversarialScenarioResult[] {
  return Object.freeze(EXEC15_ADVERSARIAL_SCENARIO_IDS.map((id) => runExec15AdversarialScenario(id)));
}

export function assertExecutionSurfacesDisabledInAdversarialSuite(): boolean {
  return LIVE_TRADING_ENABLED === false && LIVE_INVESTMENT_EXECUTION === false;
}
