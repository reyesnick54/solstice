import { asExchangeAccountId, asExchangeMarketId } from '../../sunrey-exchange/src/ids.ts';
import { defaultMarketOperationsPolicy } from '../../sunrey-exchange/src/ops/policy.ts';
import { defaultOrderRatePolicy, emptyRateWindow, evaluatePreTradeRisk } from '../../sunrey-exchange/src/ops/risk.ts';
import { admitsNewOrders, type MarketState } from '../../sunrey-exchange/src/ops/taxonomy.ts';
import type { ExchangeEligibilityView, MandateRefusal } from './types.ts';

/**
 * Chunk 95 Exchange adapter. Agent orders reuse eligibility, pre-trade
 * risk, market state, price protection, and DVP. This is not a second
 * Exchange or risk engine.
 */
export function evaluateAgentExchangePath(input: {
  readonly marketId: string;
  readonly approvedMarketIds: readonly string[];
  readonly marketState: MarketState;
  readonly quantity: bigint;
  readonly notional: bigint;
  readonly priceUnits: bigint;
  readonly referenceUnits: bigint;
  readonly participantEligible: boolean;
  readonly accountRestricted: boolean;
  readonly settlementHealthy: boolean;
}): ExchangeEligibilityView {
  if (!input.approvedMarketIds.includes(input.marketId)) {
    return Object.freeze({
      marketId: input.marketId,
      eligible: false,
      marketState: input.marketState,
      priceProtectionOk: false,
      dvpRequired: true,
      restrictionHash: `mkt:${input.marketId}:unapproved`,
      refusal: 'MARKET_NOT_PERMITTED',
    });
  }
  if (!admitsNewOrders(input.marketState)) {
    return Object.freeze({
      marketId: input.marketId,
      eligible: false,
      marketState: input.marketState,
      priceProtectionOk: false,
      dvpRequired: true,
      restrictionHash: `mkt:${input.marketId}:${input.marketState}`,
      refusal: 'MARKET_UNAVAILABLE',
    });
  }
  const policy = defaultMarketOperationsPolicy();
  const accountId = asExchangeAccountId('xacct_agent_sim');
  const risk = evaluatePreTradeRisk({
    family: 'DIGITAL_ASSET',
    credential: {
      credentialId: 'agent-sim-credential',
      participantId: 'agent-sim',
      accountId,
      marketPermissions: ['DIGITAL_ASSET'],
      environment: 'SANDBOX',
      sessionId: 'sess_agent_sim',
      protocol: 'NATIVE',
      cancelOnDisconnect: false,
      marketMaker: false,
      custodyPrivateKeyPresent: false,
    },
    access: {
      identityClass: 'RETAIL',
      jurisdiction: 'SIM',
      marketFamily: 'DIGITAL_ASSET',
      complianceState: 'CLEAR',
      professionalStatus: false,
      institutionalStatus: false,
      consentReady: true,
      rightsReady: true,
      listingAllowed: true,
      riskRestricted: false,
    },
    accountRestricted: input.accountRestricted,
    reservationAvailable: true,
    quantity: input.quantity,
    notional: input.notional,
    rate: defaultOrderRatePolicy('agent-sim', accountId, asExchangeMarketId(input.marketId)),
    window: emptyRateWindow(),
    priceUnits: input.priceUnits,
    referenceUnits: input.referenceUnits,
    collarBps: policy.priceCollarBps,
    killSwitches: [],
    marketId: input.marketId,
    settlementHealthy: input.settlementHealthy,
    custodyHealthy: true,
    referenceAvailable: true,
  });
  const eligible = input.participantEligible && risk.allowed && !input.accountRestricted;
  return Object.freeze({
    marketId: input.marketId,
    eligible,
    marketState: input.marketState,
    priceProtectionOk: risk.priceWithinCollar,
    dvpRequired: true,
    restrictionHash: `mkt:${input.marketId}:${input.marketState}:${risk.reasonCodes.join(',')}`,
    ...(eligible ? {} : { refusal: risk.reasonCodes.join(',') }),
  });
}

export function exchangeRefusal(view: ExchangeEligibilityView): MandateRefusal | null {
  if (view.eligible) {
    return null;
  }
  if (view.refusal === 'MARKET_NOT_PERMITTED') {
    return { ok: false, code: 'MARKET_NOT_PERMITTED', detail: 'market is not on the mandate' };
  }
  if (view.refusal === 'MARKET_UNAVAILABLE') {
    return { ok: false, code: 'RISK_RESTRICTED', detail: 'market does not admit new orders' };
  }
  return { ok: false, code: 'RISK_RESTRICTED', detail: view.refusal ?? 'exchange path refused' };
}
