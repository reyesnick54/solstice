/**
 * Investment-domain adapter for approved Grow execution commands.
 * Uses Kernel-gated InvestmentsService methods. Growth Orchestrator
 * does not call this adapter or provider APIs.
 */

import { asAccountId } from '../../domain/src/account.ts';
import { asCurrencyCode } from '../../domain/src/currency.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asLegalEntityId } from '../../domain/src/legal-entity.ts';
import { asProductId } from '../../domain/src/product.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asInstrumentId } from './ids.ts';
import type { InvestmentsService, InvestmentsServiceOutcome } from './service.ts';
import { wholeShares } from './quantity.ts';

/** Structural command. Defined here so investments does not import platform. */
export type GrowInvestmentCommand = {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly customerId: string;
  readonly domain: string;
  readonly proposalType: string;
  readonly financialResource: {
    readonly sourceAccountId: string;
    readonly destinationAccountId: string | null;
    readonly instrumentId: string | null;
    readonly amount: { readonly minorUnits: string; readonly currency: string };
  };
};

/** Structural Provider Runtime port. Investments does not import sunrey-chain. */
export type GrowInvestmentProviderPort = {
  route(inquiry: {
    readonly capability: 'INVESTMENT.PAPER_ORDER';
    readonly jurisdiction: string;
    readonly currency: string;
    readonly product: string;
    readonly environment: 'SANDBOX';
    readonly nowUtc: string;
  }): { readonly ok: true; readonly value: { readonly selectedProviderId: string } } | { readonly ok: false };
  get(providerId: string): {
    readonly providerId: string;
    readonly environment: string;
    readonly lifecycleState: string;
  } | null;
};

export type GrowInvestmentAccounts = {
  readonly investmentAccountId: string;
  readonly demandAccountId: string;
  readonly brokerageCashAccountId: string;
  readonly securitiesAccountId: string;
  readonly pendingSettlementAccountId: string;
};

export type GrowInvestmentExecutionResult = {
  readonly outcome: 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'PROVIDER_UNAVAILABLE';
  readonly providerId: string | null;
  readonly orderId: string | null;
  readonly fillId: string | null;
  readonly journalId: string | null;
  readonly authorityId: string | null;
  readonly filledMinorUnits: string;
  readonly code: string;
  readonly message: string;
};

export function selectSandboxInvestmentProvider(
  runtime: GrowInvestmentProviderPort,
  jurisdiction: string,
  nowUtc: string,
): { readonly ok: true; readonly providerId: string } | { readonly ok: false; readonly code: 'PROVIDER_UNAVAILABLE'; readonly message: string } {
  const routed = runtime.route({
    capability: 'INVESTMENT.PAPER_ORDER',
    jurisdiction,
    currency: 'USD',
    product: 'invest',
    environment: 'SANDBOX',
    nowUtc,
  });
  if (!routed.ok) {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'no sandbox investment provider is available; refusing fake production execution',
    };
  }
  const registration = runtime.get(routed.value.selectedProviderId);
  if (!registration || registration.environment === 'PRODUCTION' || registration.lifecycleState === 'PRODUCTION') {
    return {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      message: 'do not silently switch to fake production execution',
    };
  }
  return { ok: true, providerId: registration.providerId };
}

export function executeGrowInvestmentCommand(input: {
  readonly investments: InvestmentsService;
  readonly command: GrowInvestmentCommand;
  readonly actorId: string;
  readonly now: UtcInstant;
  readonly accounts: GrowInvestmentAccounts;
  readonly providerId: string;
  readonly openIfNeeded?: boolean;
}): GrowInvestmentExecutionResult {
  if (input.command.domain !== 'INVESTMENT_EXECUTION') {
    return fail('PROVIDER_REJECTION', 'command is not an investment execution');
  }
  if (input.openIfNeeded) {
    const opened = input.investments.openInvestmentAccount({
      id: asIntentId(`I-grow-open-${input.command.commandId}`),
      actionType: ACTION_TYPES.OPEN_INVESTMENT_ACCOUNT,
      idempotencyKey: `grow-open:${input.command.idempotencyKey}`,
      actorId: input.actorId,
      requestedAt: input.now,
      purpose: 'CUSTOMER_INVESTMENT',
      payload: {
        accountId: asAccountId(input.accounts.demandAccountId),
        investmentAccountId: input.accounts.investmentAccountId,
        customerId: asCustomerId(input.command.customerId),
        brokerageCashAccountId: asAccountId(input.accounts.brokerageCashAccountId),
        securitiesAccountId: asAccountId(input.accounts.securitiesAccountId),
        pendingSettlementAccountId: asAccountId(input.accounts.pendingSettlementAccountId),
        productId: asProductId('prod_brokerage_cash_usd_gb'),
        legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
        jurisdiction: asJurisdiction('GB'),
        currency: asCurrencyCode(input.command.financialResource.amount.currency),
      },
    });
    if (opened.outcome !== 'OK' && opened.outcome !== 'KERNEL_REFUSED') {
      return fail(opened.code, opened.message);
    }
    if (opened.outcome === 'KERNEL_REFUSED') {
      return fail('KERNEL_REFUSED', 'Kernel refused investment account open');
    }
  }
  const funded = input.investments.fundBrokerageCash({
    id: asIntentId(`I-grow-fund-${input.command.commandId}`),
    actionType: ACTION_TYPES.FUND_BROKERAGE_CASH,
    idempotencyKey: `grow-fund:${input.command.idempotencyKey}`,
    actorId: input.actorId,
    requestedAt: input.now,
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: asAccountId(input.accounts.brokerageCashAccountId),
      sourceAccountId: asAccountId(input.accounts.demandAccountId),
      amount: Money.fromMinorUnitsString(
        input.command.financialResource.amount.minorUnits,
        input.command.financialResource.amount.currency,
      ),
    },
  });
  if (funded.outcome === 'KERNEL_REFUSED') {
    return fail('KERNEL_REFUSED', 'Kernel refused brokerage funding');
  }
  if (funded.outcome !== 'OK') {
    return fail(funded.code, funded.message);
  }
  const priceMinor = '10000';
  const quantityUnits = wholeShareUnitsForNotional(input.command.financialResource.amount.minorUnits, priceMinor);
  const filledNotional = filledNotionalForUnits(quantityUnits, priceMinor);
  if (quantityUnits === '0') {
    return fail('INVALID_QUANTITY', 'notional is below one whole sandbox share after concentration buffer');
  }
  const ordered = input.investments.createPaperOrder({
    id: asIntentId(`I-grow-ord-${input.command.commandId}`),
    actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
    idempotencyKey: `grow-ord:${input.command.idempotencyKey}`,
    actorId: input.actorId,
    requestedAt: input.now,
    purpose: 'CUSTOMER_INVESTMENT',
    payload: {
      accountId: asAccountId(input.accounts.brokerageCashAccountId),
      investmentAccountId: input.accounts.investmentAccountId,
      orderId: `ord_${input.command.commandId}`.slice(0, 48),
      instrumentId: asInstrumentId(input.command.financialResource.instrumentId ?? 'SIM-ETF-1'),
      side: input.command.proposalType === 'INVESTMENT_SELL' ? 'SELL' : 'BUY',
      quantityUnits,
      orderType: 'MARKET_SIMULATION',
    },
  });
  if (ordered.outcome === 'KERNEL_REFUSED') {
    return fail('KERNEL_REFUSED', 'Kernel refused paper order');
  }
  if (ordered.outcome !== 'OK') {
    return fail(ordered.code, ordered.message);
  }
  const complete = Boolean(ordered.value.fillId) && filledNotional === input.command.financialResource.amount.minorUnits;
  return {
    outcome: !ordered.value.fillId || !complete ? 'PARTIAL' : 'COMPLETED',
    providerId: input.providerId,
    orderId: ordered.value.orderId,
    fillId: ordered.value.fillId,
    journalId: funded.value.journalId,
    authorityId: ordered.decision.executionAuthority?.authorityId ?? funded.decision.executionAuthority?.authorityId ?? null,
    filledMinorUnits: ordered.value.fillId ? filledNotional : '0',
    code: 'OK',
    message: ordered.value.fillId
      ? complete
        ? 'sandbox paper order filled'
        : 'sandbox paper order partially filled; leftover cash remains for concentration limits'
      : 'order submitted without fill',
  };
}

export function refuseGrowthOrchestratorAutoTrade(): InvestmentsServiceOutcome<never> {
  return {
    outcome: 'REJECTED',
    code: 'GROWTH_CANNOT_AUTO_TRADE',
    message: 'Growth Orchestrator cannot auto-submit paper orders; user confirmation and Kernel are required',
    decision: null,
  };
}

function wholeShareUnitsForNotional(notionalMinor: string, priceMinor: string): string {
  const notional = BigInt(notionalMinor);
  const price = BigInt(priceMinor);
  if (price <= 0n) {
    return '0';
  }
  // Leave cash in brokerage so a first paper lot stays under the
  // engineering 60% single-instrument concentration budget.
  const deployable = notional / 2n;
  const shares = deployable / price;
  const qty = wholeShares(shares);
  return qty.ok ? qty.value.units.toString() : '0';
}

function filledNotionalForUnits(quantityUnits: string, priceMinor: string): string {
  const units = BigInt(quantityUnits);
  const price = BigInt(priceMinor);
  return ((units / 100_000_000n) * price).toString();
}

function fail(code: string, message: string): GrowInvestmentExecutionResult {
  return {
    outcome: 'FAILED',
    providerId: null,
    orderId: null,
    fillId: null,
    journalId: null,
    authorityId: null,
    filledMinorUnits: '0',
    code,
    message,
  };
}
