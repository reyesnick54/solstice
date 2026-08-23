import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ExecutionAuthority } from '../../../permissions/src/execution-authority.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import {
  DEMAND_DEPOSIT_TO_SIMULATED_FUNDING,
  simulationFeeCollectorId,
  type LedgerAccount,
} from '../../../ledger/src/types.ts';
import { Money } from '../../../money/src/money.ts';
import { ACTION_TYPES } from '../../../permissions/src/action-types.ts';
import type { CoinPort, FiatPort } from '../ports.ts';
import type { NativeAssetSettlementPort } from '../native-settlement.ts';
import { AssetQuantity } from '../../../money/src/asset-quantity.ts';
import { openClearing, transitionClearing } from './clearing.ts';
import type {
  ClearingRecord,
  FillObligation,
  SettlementAttempt,
  SettlementFailureCode,
  SettlementRail,
} from './types.ts';

export type LedgerRail = {
  readonly kind: 'LEDGER_FIAT';
  readonly ledger: Ledger;
  readonly registerAccount: (account: LedgerAccount) => void;
};

export type CustodyRail = {
  readonly kind: 'CUSTODY_ASSET';
  reserve(input: {
    readonly vaultId: string;
    readonly assetId: string;
    readonly quantity: bigint;
  }): { readonly ok: true; readonly reservationId: string } | { readonly ok: false; readonly code: SettlementFailureCode };
  debit(input: {
    readonly reservationId: string;
    readonly assetId: string;
    readonly quantity: bigint;
  }):
    | { readonly ok: true; readonly providerTxRef: string }
    | { readonly ok: false; readonly code: SettlementFailureCode };
  queryFinality(providerTxRef: string): 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE';
};

export type NativeRail = {
  readonly kind: 'NATIVE_CHAIN';
  readonly port: NativeAssetSettlementPort;
  queryFinality(txId: string): 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'UNAVAILABLE';
  recordTx?(txId: string): void;
};

export type ApplicationRail = {
  readonly kind: 'APPLICATION_PORT';
  readonly coin: CoinPort;
  readonly fiat: FiatPort;
};

export type SettlementRails = {
  readonly ledger?: LedgerRail;
  readonly custody?: CustodyRail;
  readonly native?: NativeRail;
  readonly application?: ApplicationRail;
};

export function createFillObligation(input: {
  readonly tradeId: string;
  readonly marketId: string;
  readonly buyerAccountId: string;
  readonly sellerAccountId: string;
  readonly buyerParticipantId: string;
  readonly sellerParticipantId: string;
  readonly buyerCashAccountId: string;
  readonly sellerCashAccountId: string;
  readonly buyerCustodyRef?: string | null;
  readonly sellerCustodyRef?: string | null;
  readonly baseAssetId: string;
  readonly quoteAssetId: string;
  readonly quoteKind: 'FIAT_MONEY' | 'ASSET';
  readonly quantity: bigint;
  readonly priceUnits: bigint;
  readonly quoteMinorUnits: bigint;
  readonly makerFeeMinorUnits: bigint;
  readonly takerFeeMinorUnits: bigint;
  readonly currency: string;
  readonly makerOrderId: string;
  readonly takerOrderId: string;
  readonly makerHoldId?: string | null;
  readonly takerHoldId?: string | null;
  readonly quoteRail: SettlementRail;
  readonly baseRail: SettlementRail;
  readonly at: UtcInstant;
  readonly atomicSettledNow?: boolean;
}): FillObligation {
  return Object.freeze({
    obligationId: `xobl_${randomUUID().replace(/-/g, '')}`,
    tradeId: input.tradeId,
    marketId: input.marketId,
    buyerAccountId: input.buyerAccountId,
    sellerAccountId: input.sellerAccountId,
    buyerParticipantId: input.buyerParticipantId,
    sellerParticipantId: input.sellerParticipantId,
    buyerCashAccountId: input.buyerCashAccountId,
    sellerCashAccountId: input.sellerCashAccountId,
    buyerCustodyRef: input.buyerCustodyRef ?? null,
    sellerCustodyRef: input.sellerCustodyRef ?? null,
    baseAssetId: input.baseAssetId,
    quoteAssetId: input.quoteAssetId,
    quoteKind: input.quoteKind,
    quantity: input.quantity,
    priceUnits: input.priceUnits,
    quoteMinorUnits: input.quoteMinorUnits,
    makerFeeMinorUnits: input.makerFeeMinorUnits,
    takerFeeMinorUnits: input.takerFeeMinorUnits,
    currency: input.currency,
    makerOrderId: input.makerOrderId,
    takerOrderId: input.takerOrderId,
    makerHoldId: input.makerHoldId ?? null,
    takerHoldId: input.takerHoldId ?? null,
    quoteRail: input.quoteRail,
    baseRail: input.baseRail,
    createdAt: input.at,
    fillIsFinalSettlement: input.atomicSettledNow === true,
  });
}

export class ExchangeSettlementCoordinator {
  private readonly rails: SettlementRails;
  private readonly postedKeys = new Set<string>();
  private readonly attempts: SettlementAttempt[] = [];

  constructor(rails: SettlementRails) {
    this.rails = rails;
  }

  attemptsFor(obligationId: string): readonly SettlementAttempt[] {
    return this.attempts.filter((item) => item.obligationId === obligationId);
  }

  open(obligation: FillObligation, at: UtcInstant): ClearingRecord {
    return openClearing({ obligationId: obligation.obligationId, tradeId: obligation.tradeId, at });
  }

  settle(input: {
    readonly obligation: FillObligation;
    readonly clearing: ClearingRecord;
    readonly at: UtcInstant;
    readonly authority: ExecutionAuthority | null;
    readonly actorId: string;
    readonly kind?: 'SETTLE' | 'RETRY' | 'REPAIR';
  }): ClearingRecord {
    const kind = input.kind ?? 'SETTLE';
    if (input.clearing.state === 'SETTLED') {
      const blocked = transitionClearing(input.clearing, 'SETTLED', input.at, {
        duplicateTransferBlocked: true,
      });
      this.recordAttempt(input.obligation.obligationId, kind, 'SETTLED', null, false, input.at);
      return blocked;
    }

    let current = input.clearing.state === 'PENDING'
      ? transitionClearing(input.clearing, 'VALIDATED', input.at)
      : input.clearing;
    if (current.state === 'VALIDATED') {
      current = transitionClearing(current, 'READY_TO_SETTLE', input.at);
    }
    if (current.state === 'REQUIRES_REVIEW' || current.state === 'FAILED') {
      current = transitionClearing(current, 'READY_TO_SETTLE', input.at, {
        failureCode: null,
        reviewReason: null,
      });
    }
    if (current.state !== 'READY_TO_SETTLE' && current.state !== 'SETTLING') {
      return current;
    }
    current = transitionClearing(current, 'SETTLING', input.at, { incrementAttempt: true });

    const quote = this.executeQuoteLeg(input.obligation, input.authority, input.actorId);
    const base = this.executeBaseLeg(input.obligation);

    if (quote.ok && base.ok) {
      if (base.needsFinality && base.finality !== 'BFT_FINALIZED' && base.finality !== 'CONFIRMED') {
        const next = transitionClearing(current, 'REQUIRES_REVIEW', input.at, {
          refs: {
            ledger: { cashJournalId: quote.cashJournalId, feeJournalId: quote.feeJournalId, reservationJournalId: null },
            custody: {
              providerTxRef: base.providerTxRef,
              vaultId: input.obligation.sellerCustodyRef,
              reservationId: base.reservationId,
              confirmation: base.finality === 'PENDING' ? 'PENDING' : 'UNVERIFIED',
            },
            chain: {
              txId: base.txId,
              height: base.height,
              finality: 'PENDING_PROPOSAL',
            },
          },
          failureCode: base.finality === 'PENDING' ? 'PROVIDER_PENDING' : 'PROVIDER_UNKNOWN',
          reviewReason: 'finality_not_satisfied',
        });
        this.recordAttempt(input.obligation.obligationId, kind, next.state, next.failureCode, true, input.at);
        return next;
      }
      const settled = transitionClearing(current, 'SETTLED', input.at, {
        refs: {
          ledger: { cashJournalId: quote.cashJournalId, feeJournalId: quote.feeJournalId, reservationJournalId: null },
          custody: {
            providerTxRef: base.providerTxRef,
            vaultId: input.obligation.sellerCustodyRef,
            reservationId: base.reservationId,
            confirmation: base.providerTxRef ? 'CONFIRMED' : 'UNVERIFIED',
          },
          chain: {
            txId: base.txId,
            height: base.height,
            finality: base.finality === 'BFT_FINALIZED' ? 'BFT_FINALIZED' : 'NONE',
          },
        },
        failureCode: null,
        reviewReason: null,
      });
      this.recordAttempt(input.obligation.obligationId, kind, 'SETTLED', null, true, input.at);
      return settled;
    }

    const oneSided = quote.ok !== base.ok && (quote.transferred || base.transferred);
    const code = !quote.ok ? quote.code : base.code;
    const nextState = oneSided ? 'REQUIRES_REVIEW' : 'FAILED';
    const next = transitionClearing(current, nextState, input.at, {
      refs: {
        ledger: { cashJournalId: quote.cashJournalId, feeJournalId: quote.feeJournalId, reservationJournalId: null },
        custody: {
          providerTxRef: base.providerTxRef,
          vaultId: input.obligation.sellerCustodyRef,
          reservationId: base.reservationId,
          confirmation: 'UNVERIFIED',
        },
        chain: { txId: base.txId, height: base.height, finality: 'NONE' },
      },
      failureCode: oneSided ? 'DVP_PARTIAL' : code,
      reviewReason: oneSided ? 'one_sided_delivery' : code,
    });
    this.recordAttempt(input.obligation.obligationId, kind, next.state, next.failureCode, quote.transferred || base.transferred, input.at);
    return next;
  }

  applyVerifiedFinality(input: {
    readonly clearing: ClearingRecord;
    readonly at: UtcInstant;
    readonly custodyConfirmation?: 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE';
    readonly chainFinality?: 'PENDING_PROPOSAL' | 'BFT_FINALIZED' | 'UNAVAILABLE';
    readonly fromWebhookAlone?: boolean;
  }): ClearingRecord {
    if (input.fromWebhookAlone === true) {
      return transitionClearing(input.clearing, 'REQUIRES_REVIEW', input.at, {
        failureCode: 'WEBHOOK_UNVERIFIED',
        reviewReason: 'webhook_alone_cannot_credit',
      });
    }
    if (input.clearing.state !== 'SETTLING' && input.clearing.state !== 'REQUIRES_REVIEW') {
      return input.clearing;
    }
    const custodyOk = !input.custodyConfirmation || input.custodyConfirmation === 'CONFIRMED';
    const chainOk = !input.chainFinality || input.chainFinality === 'BFT_FINALIZED';
    if (custodyOk && chainOk) {
      return transitionClearing(input.clearing, 'SETTLED', input.at, {
        refs: {
          ...(input.custodyConfirmation
            ? { custody: { ...input.clearing.refs.custody, confirmation: input.custodyConfirmation } }
            : {}),
          ...(input.chainFinality
            ? { chain: { ...input.clearing.refs.chain, finality: input.chainFinality } }
            : {}),
        },
        failureCode: null,
        reviewReason: null,
      });
    }
    const code: SettlementFailureCode =
      input.custodyConfirmation === 'UNAVAILABLE' || input.chainFinality === 'UNAVAILABLE'
        ? input.chainFinality === 'UNAVAILABLE'
          ? 'CHAIN_UNAVAILABLE'
          : 'CUSTODY_UNAVAILABLE'
        : input.custodyConfirmation === 'UNKNOWN'
          ? 'PROVIDER_UNKNOWN'
          : 'PROVIDER_PENDING';
    return transitionClearing(input.clearing, 'REQUIRES_REVIEW', input.at, {
      failureCode: code,
      reviewReason: 'finality_not_satisfied',
    });
  }

  private executeQuoteLeg(
    obligation: FillObligation,
    authority: ExecutionAuthority | null,
    actorId: string,
  ): {
    readonly ok: boolean;
    readonly transferred: boolean;
    readonly cashJournalId: string | null;
    readonly feeJournalId: string | null;
    readonly code: SettlementFailureCode;
  } {
    const key = `quote:${obligation.tradeId}`;
    if (this.postedKeys.has(key)) {
      return { ok: true, transferred: false, cashJournalId: `idem.${key}`, feeJournalId: null, code: 'DUPLICATE_TRANSFER_BLOCKED' };
    }
    if (obligation.quoteRail === 'LEDGER_FIAT') {
      const rail = this.rails.ledger;
      if (!rail) {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'LEDGER_FAILURE' };
      }
      if (!authority) {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'AUTHORITY_MISSING' };
      }
      try {
        rail.registerAccount({
          id: obligation.buyerCashAccountId,
          name: 'Exchange buyer cash',
          accountClass: 'DEMAND_DEPOSIT',
          currency: obligation.currency,
          ownerId: obligation.buyerAccountId,
        });
        rail.registerAccount({
          id: obligation.sellerCashAccountId,
          name: 'Exchange seller cash',
          accountClass: 'DEMAND_DEPOSIT',
          currency: obligation.currency,
          ownerId: obligation.sellerAccountId,
        });
        const amount = Money.fromMinorUnits(obligation.quoteMinorUnits, obligation.currency);
        const feeTotal = obligation.makerFeeMinorUnits + obligation.takerFeeMinorUnits;
        const postings =
          feeTotal > 0n
            ? [
                {
                  accountId: obligation.buyerCashAccountId,
                  direction: 'DEBIT' as const,
                  amount: Money.fromMinorUnits(obligation.quoteMinorUnits + feeTotal, obligation.currency),
                },
                { accountId: obligation.sellerCashAccountId, direction: 'CREDIT' as const, amount },
                {
                  accountId: simulationFeeCollectorId(obligation.currency),
                  direction: 'CREDIT' as const,
                  amount: Money.fromMinorUnits(feeTotal, obligation.currency),
                },
              ]
            : [
                { accountId: obligation.buyerCashAccountId, direction: 'DEBIT' as const, amount },
                { accountId: obligation.sellerCashAccountId, direction: 'CREDIT' as const, amount },
              ];
        const cash = rail.ledger.postJournal({
          idempotencyKey: authority.idempotencyKey,
          executionAuthority: authority,
          actionType: ACTION_TYPES.SETTLE_EXCHANGE_TRADE,
          sourceDomain: 'exchange',
          reference: obligation.obligationId,
          ...(feeTotal > 0n ? { classBridge: DEMAND_DEPOSIT_TO_SIMULATED_FUNDING } : {}),
          postings,
        });
        this.postedKeys.add(key);
        return {
          ok: true,
          transferred: true,
          cashJournalId: cash.id,
          feeJournalId: feeTotal > 0n ? cash.id : null,
          code: 'LEDGER_FAILURE',
        };
      } catch {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'LEDGER_FAILURE' };
      }
    }
    if (obligation.quoteRail === 'APPLICATION_PORT') {
      const rail = this.rails.application;
      if (!rail) {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'LEDGER_FAILURE' };
      }
      const cash = rail.fiat.transfer(
        actorId,
        obligation.buyerCashAccountId,
        obligation.sellerCashAccountId,
        Money.fromMinorUnits(obligation.quoteMinorUnits, obligation.currency),
        `exchange.settle.cash.${obligation.tradeId}`,
      );
      if (!cash.ok) {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'LEDGER_FAILURE' };
      }
      this.postedKeys.add(key);
      return { ok: true, transferred: true, cashJournalId: cash.value.journalId, feeJournalId: null, code: 'LEDGER_FAILURE' };
    }
    if (obligation.quoteRail === 'NATIVE_CHAIN') {
      const native = this.executeNativeContra(obligation);
      if (!native.ok) {
        return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: native.code };
      }
      this.postedKeys.add(key);
      return { ok: true, transferred: true, cashJournalId: native.txId, feeJournalId: null, code: 'CHAIN_UNAVAILABLE' };
    }
    return { ok: false, transferred: false, cashJournalId: null, feeJournalId: null, code: 'LEDGER_FAILURE' };
  }

  private executeBaseLeg(obligation: FillObligation): {
    readonly ok: boolean;
    readonly transferred: boolean;
    readonly needsFinality: boolean;
    readonly providerTxRef: string | null;
    readonly reservationId: string | null;
    readonly txId: string | null;
    readonly height: bigint | null;
    readonly finality: 'CONFIRMED' | 'PENDING' | 'UNKNOWN' | 'UNAVAILABLE' | 'BFT_FINALIZED' | 'PENDING_PROPOSAL' | 'NONE';
    readonly code: SettlementFailureCode;
  } {
    const key = `base:${obligation.tradeId}`;
    if (this.postedKeys.has(key)) {
      return {
        ok: true,
        transferred: false,
        needsFinality: false,
        providerTxRef: null,
        reservationId: null,
        txId: null,
        height: null,
        finality: 'NONE',
        code: 'DUPLICATE_TRANSFER_BLOCKED',
      };
    }
    if (obligation.baseRail === 'NATIVE_CHAIN') {
      const rail = this.rails.native;
      if (!rail) {
        return this.baseFail('CHAIN_UNAVAILABLE');
      }
      const result = rail.port.atomicDeliveryVersusPayment({
        assetSender: obligation.sellerAccountId,
        assetRecipient: obligation.buyerAccountId,
        assetAmount: AssetQuantity.fromScaledUnits(obligation.quantity, obligation.baseAssetId),
        contraSender: obligation.buyerAccountId,
        contraRecipient: obligation.sellerAccountId,
        contraAmount: AssetQuantity.fromScaledUnits(obligation.quoteMinorUnits, obligation.quoteAssetId),
      });
      if (!result.ok) {
        const code: SettlementFailureCode =
          result.error.code === 'INSUFFICIENT_ASSET' ? 'INSUFFICIENT_RESERVED_ASSET' : 'CHAIN_UNAVAILABLE';
        return this.baseFail(code);
      }
      const txId = `ndvp_${obligation.tradeId}`;
      rail.recordTx?.(txId);
      const finality = rail.queryFinality(txId);
      this.postedKeys.add(key);
      return {
        ok: true,
        transferred: true,
        needsFinality: true,
        providerTxRef: null,
        reservationId: null,
        txId,
        height: finality === 'BFT_FINALIZED' ? 1n : 0n,
        finality,
        code: 'CHAIN_UNAVAILABLE',
      };
    }
    if (obligation.baseRail === 'CUSTODY_ASSET') {
      const rail = this.rails.custody;
      if (!rail) {
        return this.baseFail('CUSTODY_UNAVAILABLE');
      }
      const vaultId = obligation.sellerCustodyRef ?? obligation.sellerAccountId;
      const reserved = rail.reserve({
        vaultId,
        assetId: obligation.baseAssetId,
        quantity: obligation.quantity,
      });
      if (!reserved.ok) {
        return this.baseFail(reserved.code);
      }
      const debited = rail.debit({
        reservationId: reserved.reservationId,
        assetId: obligation.baseAssetId,
        quantity: obligation.quantity,
      });
      if (!debited.ok) {
        return this.baseFail(debited.code);
      }
      const confirmation = rail.queryFinality(debited.providerTxRef);
      this.postedKeys.add(key);
      return {
        ok: confirmation === 'CONFIRMED',
        transferred: true,
        needsFinality: true,
        providerTxRef: debited.providerTxRef,
        reservationId: reserved.reservationId,
        txId: null,
        height: null,
        finality: confirmation,
        code: confirmation === 'PENDING' ? 'PROVIDER_PENDING' : confirmation === 'UNKNOWN' ? 'PROVIDER_UNKNOWN' : 'CUSTODY_UNAVAILABLE',
      };
    }
    if (obligation.baseRail === 'APPLICATION_PORT') {
      const rail = this.rails.application;
      if (!rail) {
        return this.baseFail('INSUFFICIENT_RESERVED_ASSET');
      }
      const moved = rail.coin.transfer(
        'exchange.settlement',
        obligation.sellerAccountId,
        obligation.sellerAccountId,
        obligation.buyerAccountId,
        AssetQuantity.fromScaledUnits(obligation.quantity, obligation.baseAssetId),
      );
      if (!moved.ok) {
        return this.baseFail('INSUFFICIENT_RESERVED_ASSET');
      }
      this.postedKeys.add(key);
      return {
        ok: true,
        transferred: true,
        needsFinality: false,
        providerTxRef: null,
        reservationId: null,
        txId: moved.value.journalId,
        height: null,
        finality: 'NONE',
        code: 'INSUFFICIENT_RESERVED_ASSET',
      };
    }
    return this.baseFail('INSUFFICIENT_RESERVED_ASSET');
  }

  private executeNativeContra(obligation: FillObligation): {
    readonly ok: boolean;
    readonly txId: string | null;
    readonly code: SettlementFailureCode;
  } {
    const rail = this.rails.native;
    if (!rail) {
      return { ok: false, txId: null, code: 'CHAIN_UNAVAILABLE' };
    }
    void obligation;
    return { ok: true, txId: `nquote_${obligation.tradeId}`, code: 'CHAIN_UNAVAILABLE' };
  }

  private baseFail(code: SettlementFailureCode) {
    return {
      ok: false,
      transferred: false,
      needsFinality: false,
      providerTxRef: null,
      reservationId: null,
      txId: null,
      height: null,
      finality: 'NONE' as const,
      code,
    };
  }

  private recordAttempt(
    obligationId: string,
    kind: SettlementAttempt['kind'],
    outcome: SettlementAttempt['outcome'],
    failureCode: SettlementFailureCode | null,
    transferred: boolean,
    at: UtcInstant,
  ): void {
    this.attempts.push(
      Object.freeze({
        attemptId: `xatt_${randomUUID().replace(/-/g, '')}`,
        obligationId,
        kind,
        outcome,
        failureCode,
        transferred,
        at,
      }),
    );
  }
}
