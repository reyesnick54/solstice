/**
 * Canonical Grow / HELIOS attribution source snapshot.
 * Extracts read-only facts from InvestmentsService state — no parallel P&L truth.
 */

import type { UtcInstant } from '@solstice/domain';
import type { Ledger } from '@solstice/ledger';
import { Money, ledgerScaledUnits } from '@solstice/money';
import type { InvestmentAccountId } from './ids.ts';
import type { InvestmentsService } from './service.ts';
import type { ReconciliationResult } from './types.ts';
import type { SimulatedMarketDataProvider } from './market-data.ts';

export type AttributionMarkSnapshot = {
  readonly source: string;
  readonly asOf: UtcInstant;
  readonly staleAfter: UtcInstant | null;
  readonly freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  readonly methodology: string;
};

export type AttributionPositionSnapshot = {
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly settledQuantityUnits: string;
  readonly unsettledQuantityUnits: string;
  readonly remainingCostMinorUnits: string;
  readonly acquisitionCostMinorUnits: string;
  readonly marketValueMinorUnits: string | null;
  readonly unrealizedMinorUnits: string | null;
  readonly currency: string;
  readonly positionStatus: 'OPEN' | 'CLOSED' | 'PENDING';
  readonly mark: AttributionMarkSnapshot | null;
};

export type AttributionRealizedSnapshot = {
  readonly instrumentId: string;
  readonly quantityUnits: string;
  readonly proceedsMinorUnits: string;
  readonly costBasisMinorUnits: string;
  readonly feesMinorUnits: string;
  readonly realizedMinorUnits: string;
  readonly currency: string;
  readonly lotsConsumed: readonly string[];
};

export type AttributionFeeSnapshot = {
  readonly feeId: string;
  readonly feeType: 'COMMISSION' | 'VENUE' | 'SPREAD' | 'SLIPPAGE' | 'CUSTODY' | 'WITHDRAWAL' | 'OTHER';
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly certainty: 'ACTUAL' | 'ESTIMATED' | 'UNKNOWN';
  readonly sourceRef: string;
};

export type AttributionIncomeSnapshot = {
  readonly incomeId: string;
  readonly incomeType: 'DIVIDEND' | 'INTEREST' | 'DISTRIBUTION' | 'OTHER';
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly receivedAt: UtcInstant;
  readonly sourceRef: string;
};

export type AttributionFillSnapshot = {
  readonly fillId: string;
  readonly providerFillRef: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly grossMinorUnits: string;
  readonly feeMinorUnits: string;
  readonly currency: string;
  readonly filledAt: UtcInstant;
};

export type AttributionSettlementSnapshot = {
  readonly settlementId: string;
  readonly fillId: string;
  readonly state: 'TRADE_DATE' | 'PENDING_SETTLEMENT' | 'SETTLED';
  readonly feeMinorUnits: string;
  readonly currency: string;
};

export type AttributionFxSnapshot = {
  readonly sourceCurrency: string;
  readonly reportingCurrency: string;
  readonly rateNumerator: string;
  readonly rateDenominator: string;
  readonly asOf: UtcInstant;
  readonly methodology: string;
  readonly reference: string;
} | null;

export type CanonicalGrowAttributionSource = {
  readonly customerId: string;
  readonly investmentAccountId: string;
  readonly reportingCurrency: string;
  readonly costBasisMethod: 'FIFO_SIMULATION_ACCOUNTING_METHOD';
  readonly taxAdvice: false;
  readonly positions: readonly AttributionPositionSnapshot[];
  readonly realized: readonly AttributionRealizedSnapshot[];
  readonly fills: readonly AttributionFillSnapshot[];
  readonly settlements: readonly AttributionSettlementSnapshot[];
  readonly fees: readonly AttributionFeeSnapshot[];
  readonly income: readonly AttributionIncomeSnapshot[];
  readonly principalDepositsMinorUnits: string;
  readonly netContributionsMinorUnits: string;
  readonly cashAvailableMinorUnits: string;
  readonly cashUnsettledMinorUnits: string;
  readonly portfolioValueMinorUnits: string;
  readonly investedValueMinorUnits: string;
  readonly reconciliation: {
    readonly result: ReconciliationResult;
    readonly findings: readonly string[];
  };
  readonly fx: AttributionFxSnapshot;
  readonly extractedAt: UtcInstant;
};

function accountBalanceMinor(ledger: Ledger, accountId: string): bigint {
  const postings = ledger.listPostingsForAccount(accountId as never);
  return postings.reduce(
    (sum, posting) =>
      posting.direction === 'CREDIT'
        ? sum + ledgerScaledUnits(posting.amount)
        : sum - ledgerScaledUnits(posting.amount),
    0n,
  );
}

function sumFundingMinor(ledger: Ledger, accountId: string): bigint {
  let total = 0n;
  for (const journal of ledger.listJournals()) {
    const matchesFunding =
      journal.actionType === 'FUND_BROKERAGE_CASH' || journal.memo === 'FUND_BROKERAGE_CASH';
    if (!matchesFunding) {
      continue;
    }
    for (const posting of journal.postings) {
      if (posting.accountId === accountId && posting.direction === 'CREDIT') {
        total += ledgerScaledUnits(posting.amount);
      }
    }
  }
  return total;
}

function sumPrincipalDepositsMinor(ledger: Ledger, accountId: string): bigint {
  let total = 0n;
  for (const journal of ledger.listJournals()) {
    if (journal.actionType !== 'POST_DEPOSIT') {
      continue;
    }
    for (const posting of journal.postings) {
      if (posting.accountId === accountId && posting.direction === 'CREDIT') {
        total += ledgerScaledUnits(posting.amount);
      }
    }
  }
  return total;
}

export function buildCanonicalGrowAttributionSource(input: {
  readonly investments: InvestmentsService;
  readonly investmentAccountId: InvestmentAccountId;
  readonly ledger: Ledger;
  readonly demandAccountId: string;
  readonly now: UtcInstant;
}): CanonicalGrowAttributionSource {
  const profile = input.investments.store.getProfile(input.investmentAccountId);
  if (!profile) {
    throw new Error('investment account is missing');
  }
  const valuation = input.investments.valuePortfolio(input.investmentAccountId);
  const reconciliation = input.investments.reconcile(input.investmentAccountId);
  const market = input.investments.market;
  const simulated = market as SimulatedMarketDataProvider;

  const positions: AttributionPositionSnapshot[] = [];
  for (const row of valuation.positions) {
    const position = input.investments.store.getPosition(input.investmentAccountId, row.instrumentId);
    let mark: AttributionMarkSnapshot | null = null;
    const quote = market.getQuote(row.instrumentId, input.now);
    if (quote.ok) {
      const stale =
        typeof simulated.isStale === 'function' ? simulated.isStale(quote.value, input.now) : false;
      mark = Object.freeze({
        source: quote.value.source,
        asOf: quote.value.quotedAt,
        staleAfter: quote.value.staleAfter,
        freshness: stale ? 'STALE' : 'FRESH',
        methodology: 'SIMULATED_DETERMINISTIC_LAST_QUOTE',
      });
    }
    const pending =
      position !== undefined &&
      position.unsettledQuantity.units > 0n &&
      position.settledQuantity.units < position.quantity.units;
    positions.push(
      Object.freeze({
        instrumentId: row.instrumentId,
        quantityUnits: row.quantity.units.toString(),
        settledQuantityUnits: position?.settledQuantity.units.toString() ?? row.quantity.units.toString(),
        unsettledQuantityUnits: position?.unsettledQuantity.units.toString() ?? '0',
        remainingCostMinorUnits: row.remainingCost.minorUnits.toString(),
        acquisitionCostMinorUnits: row.remainingCost.minorUnits.toString(),
        marketValueMinorUnits: row.marketValue.minorUnits.toString(),
        unrealizedMinorUnits: row.unrealized.unrealized.minorUnits.toString(),
        currency: row.marketValue.currency,
        positionStatus: pending ? 'PENDING' : row.quantity.units > 0n ? 'OPEN' : 'CLOSED',
        mark,
      }),
    );
  }

  const realized = input.investments.store.listRealized().map((row) =>
    Object.freeze({
      instrumentId: row.instrumentId,
      quantityUnits: row.quantity.units.toString(),
      proceedsMinorUnits: row.proceeds.minorUnits.toString(),
      costBasisMinorUnits: row.costBasis.minorUnits.toString(),
      feesMinorUnits: row.fees.minorUnits.toString(),
      realizedMinorUnits: row.realized.minorUnits.toString(),
      currency: row.currency,
      lotsConsumed: Object.freeze([...row.lotsConsumed]),
    }),
  );

  const fills = input.investments.store.listFills().map((fill) =>
    Object.freeze({
      fillId: fill.fillId,
      providerFillRef: fill.providerFillRef,
      instrumentId: fill.instrumentId,
      side: fill.side,
      grossMinorUnits: fill.grossNotional.minorUnits.toString(),
      feeMinorUnits: fill.explicitFee.minorUnits.toString(),
      currency: fill.grossNotional.currency,
      filledAt: fill.filledAt,
    }),
  );

  const settlements = input.investments.store
    .listSettlements(input.investmentAccountId)
    .map((row) =>
      Object.freeze({
        settlementId: row.settlementId,
        fillId: row.fillId,
        state: row.state,
        feeMinorUnits: row.feeAmount.minorUnits.toString(),
        currency: row.cashAmount.currency,
      }),
    );

  const fees: AttributionFeeSnapshot[] = fills.map((fill) =>
    Object.freeze({
      feeId: `fee_${fill.fillId}`,
      feeType: 'COMMISSION',
      amountMinorUnits: fill.feeMinorUnits,
      currency: fill.currency,
      certainty: 'ACTUAL',
      sourceRef: fill.fillId,
    }),
  );

  const income: AttributionIncomeSnapshot[] = [];
  for (const row of input.investments.store.snapshot().corporateActions) {
    if (row.investmentAccountId !== input.investmentAccountId || !row.cashAmount) {
      continue;
    }
    if (row.kind === 'DIVIDEND') {
      income.push(
        Object.freeze({
          incomeId: row.corporateActionId,
          incomeType: 'DIVIDEND',
          amountMinorUnits: row.cashAmount.minorUnits.toString(),
          currency: row.cashAmount.currency,
          receivedAt: row.paymentAt,
          sourceRef: row.recordRef,
        }),
      );
    }
  }

  const brokerageCash = accountBalanceMinor(input.ledger, profile.brokerageCashAccountId);
  const pendingCash = accountBalanceMinor(input.ledger, profile.pendingSettlementAccountId);
  const demandCash = accountBalanceMinor(input.ledger, input.demandAccountId);
  const netContributions = sumFundingMinor(input.ledger, profile.brokerageCashAccountId);
  const principalDeposits = sumPrincipalDepositsMinor(input.ledger, input.demandAccountId);

  const currencies = new Set(positions.map((row) => row.currency));
  const fx: AttributionFxSnapshot =
    currencies.size <= 1 || [...currencies].every((c) => c === profile.baseCurrency)
      ? null
      : Object.freeze({
          sourceCurrency: [...currencies].find((c) => c !== profile.baseCurrency) ?? profile.baseCurrency,
          reportingCurrency: profile.baseCurrency,
          rateNumerator: '1',
          rateDenominator: '1',
          asOf: input.now,
          methodology: 'UNCONFIGURED_NO_SILENT_BLEND',
          reference: 'REPORTING_CURRENCY_SEGREGATED',
        });

  return Object.freeze({
    customerId: profile.customerId,
    investmentAccountId: profile.investmentAccountId,
    reportingCurrency: profile.baseCurrency,
    costBasisMethod: 'FIFO_SIMULATION_ACCOUNTING_METHOD',
    taxAdvice: false,
    positions: Object.freeze(positions),
    realized: Object.freeze(realized),
    fills: Object.freeze(fills),
    settlements: Object.freeze(settlements),
    fees: Object.freeze(fees),
    income: Object.freeze(income),
    principalDepositsMinorUnits: principalDeposits.toString(),
    netContributionsMinorUnits: netContributions.toString(),
    cashAvailableMinorUnits: (brokerageCash + demandCash).toString(),
    cashUnsettledMinorUnits: pendingCash.toString(),
    portfolioValueMinorUnits: (valuation.marketValue.minorUnits + valuation.cash.minorUnits).toString(),
    investedValueMinorUnits: valuation.marketValue.minorUnits.toString(),
    reconciliation: Object.freeze({
      result: reconciliation.result,
      findings: Object.freeze([...reconciliation.findings]),
    }),
    fx,
    extractedAt: input.now,
  });
}

export function moneyFromMinor(minorUnits: string, currency: string): Money {
  return Money.fromMinorUnits(BigInt(minorUnits), currency);
}
