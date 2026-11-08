import { createHash } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import type { AccountId } from '@solstice/domain';
import type { CreatePaperOrderIntent } from '@solstice/permissions';
import { ACTION_TYPES } from '@solstice/permissions';
import { asIntentId, type PurposeCode } from '@solstice/permissions';
import type { RiskDecision } from '@solstice/risk';
import { asPaperStrategyRunId, type PaperStrategyRunId } from './ids.ts';
import type { KillSwitchReason, StrategyFailure, StrategyLifecycleState } from './types.ts';
import type { Evol11PaperRole } from './evol11-champion-challenger.ts';

/** ALPHA01 — paper runs accumulate FORWARD_PAPER lane evidence only (never merged with backtest). */
export const PAPER_FORWARD_ALPHA_EVIDENCE_LANE = 'FORWARD_PAPER' as const;

export type PaperStrategyRun = {
  readonly runId: PaperStrategyRunId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly investmentAccountId: string;
  readonly startedAt: UtcInstant;
  readonly haltedAt: UtcInstant | null;
  readonly haltReason: KillSwitchReason | null;
  readonly track: 'PAPER';
  /** HELIOS EVOL11 — challenger paper track vs incubation (simulation only). */
  readonly evol11Role: Evol11PaperRole;
  readonly mergedIntoBacktest: false;
  readonly mergedIntoShadow: false;
  readonly liveBroker: false;
  readonly forwardAlphaEvidenceLane: typeof PAPER_FORWARD_ALPHA_EVIDENCE_LANE;
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
  readonly evol11Role?: Evol11PaperRole;
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
      evol11Role: input.evol11Role ?? 'INCUBATION',
      mergedIntoBacktest: false,
      mergedIntoShadow: false,
      liveBroker: false,
      forwardAlphaEvidenceLane: PAPER_FORWARD_ALPHA_EVIDENCE_LANE,
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
