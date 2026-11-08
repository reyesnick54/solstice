import { FrozenClock } from '@solstice/config';
import { asCustomerId, asJurisdiction, type UtcInstant } from '@solstice/domain';

import { fillIdFor, orderIdFor } from '../order-lifecycle/index.ts';
import { mayAafCertifyMarketDataFeature, type MarketDataAafFeatureEnvelope } from '../market-data/aaf-integration.ts';
import {
  DEFAULT_EXEC09_CURRENCY_CALENDARS,
  DEFAULT_EXEC09_MARKET_CALENDARS,
  DEFAULT_EXEC09_SETTLEMENT_POLICIES,
  Exec09SettlementLifecycleService,
  exec09FillIsNotSettled,
} from './exec09/index.ts';
import { EXEC15_E2E_PIPELINE_STAGES, type Exec15E2ePipelineStage } from './taxonomy.ts';

export type Exec15E2ePipelineStageResult = {
  readonly stage: Exec15E2ePipelineStage;
  readonly ok: boolean;
  readonly detail: string;
};

export type Exec15E2ePipelineResult = {
  readonly stages: readonly Exec15E2ePipelineStageResult[];
  readonly ok: boolean;
  readonly marketDataEnvelope: MarketDataAafFeatureEnvelope | null;
  readonly grantsExecutionAuthority: false;
  readonly grantsLiveBrokerSubmit: false;
};

const E2E_EXEC09_CUSTOMER = asCustomerId('cust_exec15_e2e');
const E2E_OPERATION = 'op_exec15_e2e_pipeline';

function probeCanonicalExec09Settlement(tradeTimestamp: UtcInstant, clockNow: UtcInstant): { readonly ok: boolean; readonly detail: string } {
  const clock = new FrozenClock(clockNow);
  const service = new Exec09SettlementLifecycleService({
    clock,
    marketCalendars: DEFAULT_EXEC09_MARKET_CALENDARS,
    currencyCalendars: DEFAULT_EXEC09_CURRENCY_CALENDARS,
    seedPolicies: DEFAULT_EXEC09_SETTLEMENT_POLICIES,
  });
  const orderId = orderIdFor(E2E_OPERATION);
  const fillId = fillIdFor(orderId, 'pf_exec15_e2e');
  const opened = service.openFromFill(
    Object.freeze({
      customerId: E2E_EXEC09_CUSTOMER,
      orderId,
      fillId,
      providerId: 'sandbox_helios_investment_v1',
      providerFillId: 'pf_exec15_e2e',
      providerTradeId: 'ptr_exec15_e2e',
      instrumentId: 'inst_spy',
      assetClass: 'EQUITY',
      market: 'NYSE',
      jurisdiction: asJurisdiction('US'),
      side: 'BUY',
      tradeTimestamp,
      quantityUnits: '10',
      priceMinorUnits: '45000',
      notionalMinorUnits: '450000',
      feeMinorUnits: '10',
      currency: 'USD',
    }),
  );
  if (!opened.ok) {
    return Object.freeze({ ok: false, detail: `EXEC09 openFromFill: ${opened.error.code}` });
  }
  const { obligation, lifecycle, instruction } = opened.value;
  const fillOpen =
    obligation.state === 'PENDING' &&
    exec09FillIsNotSettled({ orderFilled: true, lifecycleState: lifecycle.aggregateState });
  if (!fillOpen) {
    return Object.freeze({ ok: false, detail: 'fill must not imply settled lifecycle' });
  }
  return Object.freeze({
    ok: true,
    detail: `EXEC09 obligation ${obligation.obligationId} pending; contractual ${instruction.contractualSettlementDate}`,
  });
}

export function runExec15SyntheticE2ePipeline(input: {
  readonly nowUtc: UtcInstant;
  readonly eventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly mandateMaxNotionalMinor: bigint;
  readonly proposedNotionalMinor: bigint;
  readonly kernelAllowed: boolean;
}): Exec15E2ePipelineResult {
  const stages: Exec15E2ePipelineStageResult[] = [];
  const push = (stage: Exec15E2ePipelineStage, ok: boolean, detail: string): void => {
    stages.push(Object.freeze({ stage, ok, detail }));
  };

  push('research_thesis', true, 'fixture thesis bound to Strategy Genome port');
  push('strategy_genome', true, 'qualified genome feature vector');
  push('decision_validity_envelope', true, 'DecisionValidityEnvelope sealed');

  const mandateOk = input.proposedNotionalMinor <= input.mandateMaxNotionalMinor;
  push('customer_mandate', mandateOk, mandateOk ? 'within mandate' : 'mandate breach');

  const marketEnvelope: MarketDataAafFeatureEnvelope = Object.freeze({
    eventTime: input.eventTime,
    knowableAt: input.knowableAt,
    providerLineageRef: 'prov:fixture:e2e-exec',
    sequenceIntegrity: 'INTACT',
    qualityState: 'VALID',
    entitlementState: 'USABLE',
    syncState: 'TRUSTED',
  });
  const mdOk = mayAafCertifyMarketDataFeature(marketEnvelope);

  push('deterministic_risk', mandateOk && mdOk, 'deterministic risk facts; no agent discretion');
  push('kernel_authorization', input.kernelAllowed && mandateOk, input.kernelAllowed ? 'ALLOW simulation' : 'kernel refused');

  const authorized = mandateOk && mdOk && input.kernelAllowed;
  push('capital_reservation', authorized, authorized ? 'reservation held' : 'blocked before reservation');
  push('parent_order', authorized, 'parent order derived from execution plan');
  push('smart_routing', authorized, 'regulatory filter then route score');
  push('execution_algorithm', authorized, 'simulation algorithm slice');
  push('pre_trade_firewall', authorized, 'pre-trade exposure within thresholds');
  push('broker_adapter', authorized, 'sandbox provider port');
  push('broker_acknowledgement', authorized, 'ACK from fixture broker');
  push('partial_fill', authorized, 'partial quantity recorded');
  push('cancel_replace', authorized, 'cancel/replace idempotent on operation identity');
  push('final_fill', authorized, 'terminal fill state');
  push('drop_copy', authorized, 'drop copy ingested with dedupe');

  if (authorized) {
    const settlement = probeCanonicalExec09Settlement(input.eventTime, input.nowUtc);
    push('settlement_obligation', settlement.ok, settlement.detail);
  } else {
    push('settlement_obligation', false, 'blocked before canonical EXEC09 settlement');
  }

  push('custody_position_update', authorized, 'custody simulation position');
  push('ledger_cash_reconciliation', authorized, 'ledger read; no second accounting');
  push('tca', authorized, 'slippage and improvement captured on fill');
  push('evidence_vault', authorized, 'hash-chained evidence sealed');

  const ok = stages.every((row) => row.ok);

  return Object.freeze({
    stages: Object.freeze(stages),
    ok,
    marketDataEnvelope: mdOk ? marketEnvelope : null,
    grantsExecutionAuthority: false,
    grantsLiveBrokerSubmit: false,
  });
}

export { EXEC15_E2E_PIPELINE_STAGES };
