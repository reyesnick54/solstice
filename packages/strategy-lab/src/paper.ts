import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { AccountId } from '../../domain/src/account.ts';
import type { CreatePaperOrderIntent } from '../../permissions/src/action-types.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId, type PurposeCode } from '../../permissions/src/action-intent.ts';
import type { RiskDecision } from '../../risk/src/types.ts';
import { asPaperStrategyRunId, type PaperStrategyRunId } from './ids.ts';
import type { KillSwitchReason, StrategyFailure, StrategyLifecycleState } from './types.ts';

export type PaperStrategyRun = {
  readonly runId: PaperStrategyRunId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly investmentAccountId: string;
  readonly startedAt: UtcInstant;
  readonly haltedAt: UtcInstant | null;
  readonly haltReason: KillSwitchReason | null;
  readonly track: 'PAPER';
  readonly mergedIntoBacktest: false;
  readonly mergedIntoShadow: false;
  readonly liveBroker: false;
};

export type PaperActionProposal = {
  readonly intent: CreatePaperOrderIntent;
  readonly risk: RiskDecision;
  readonly routedThroughInvestments: true;
  readonly directBrokerCall: false;
};

export type PaperExecutionPort = {
  readonly createPaperOrder: (intent: CreatePaperOrderIntent) => {
    readonly outcome: 'OK' | 'KERNEL_REFUSED' | 'REJECTED';
    readonly value?: { readonly orderId: string; readonly fillId?: string | undefined };
    readonly code?: string | undefined;
    readonly message?: string | undefined;
  };
};

export function startPaperRun(input: {
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly investmentAccountId: string;
  readonly lifecycle: StrategyLifecycleState;
  readonly startedAt: UtcInstant;
}): Result<PaperStrategyRun, StrategyFailure> {
  if (input.lifecycle !== 'PAPER_APPROVED' && input.lifecycle !== 'PAPER_RUNNING') {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'paper execution requires PAPER_APPROVED',
    });
  }
  const material = `${input.strategyId}@${input.strategyVersion}:${input.investmentAccountId}:${input.startedAt}`;
  return ok(
    Object.freeze({
      runId: asPaperStrategyRunId(`psr_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`),
      strategyId: input.strategyId,
      strategyVersion: input.strategyVersion,
      investmentAccountId: input.investmentAccountId,
      startedAt: input.startedAt,
      haltedAt: null,
      haltReason: null,
      track: 'PAPER',
      mergedIntoBacktest: false,
      mergedIntoShadow: false,
      liveBroker: false,
    }),
  );
}

export function paperOrderIntent(input: {
  readonly intentId: string;
  readonly accountId: AccountId;
  readonly investmentAccountId: string;
  readonly orderId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly actorId: string;
  readonly idempotencyKey: string;
  readonly requestedAt: UtcInstant;
  readonly purpose?: PurposeCode;
}): CreatePaperOrderIntent {
  return Object.freeze({
    id: asIntentId(input.intentId),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    requestedAt: input.requestedAt,
    purpose: input.purpose ?? 'CUSTOMER_INVESTMENT',
    payload: Object.freeze({
      accountId: input.accountId,
      investmentAccountId: input.investmentAccountId,
      orderId: input.orderId,
      instrumentId: input.instrumentId,
      side: input.side,
      quantityUnits: input.quantityUnits,
      orderType: 'MARKET_SIMULATION',
    }),
  });
}

export function submitPaperAction(input: {
  readonly port: PaperExecutionPort;
  readonly intent: CreatePaperOrderIntent;
  readonly risk: RiskDecision;
  readonly halted: boolean;
}): Result<{ readonly orderId: string; readonly fillId?: string | undefined }, StrategyFailure> {
  if (input.halted) {
    return err({
      code: 'KILL_SWITCH_ACTIVE',
      message: 'kill switch blocks NEW strategy orders; completed history remains immutable',
    });
  }
  if (input.risk.outcome === 'BLOCK') {
    return err({
      code: 'KILL_SWITCH_ACTIVE',
      message: 'Risk BLOCK prevents the paper strategy order',
    });
  }
  const submitted = input.port.createPaperOrder(input.intent);
  if (submitted.outcome !== 'OK' || !submitted.value) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: submitted.message ?? submitted.code ?? 'paper order was not accepted',
    });
  }
  return ok(submitted.value);
}
