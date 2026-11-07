import type { UtcInstant } from '@solstice/domain';

import { mayAafCertifyMarketDataFeature, type MarketDataAafFeatureEnvelope } from '../market-data/aaf-integration.ts';
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
  push('settlement_obligation', authorized, 'T+1 obligation fixture');
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
