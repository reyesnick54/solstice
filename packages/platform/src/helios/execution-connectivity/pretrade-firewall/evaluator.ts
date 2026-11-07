import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '@solstice/config';

import {
  deriveEffectiveCreditCapitalLimits,
  fatFingerDeviationBps,
  priceWithinCollarBps,
} from './limits.ts';
import { preTradeExecutionDecisionIdFor } from './ids.ts';
import {
  PRE_TRADE_FIREWALL_POLICY_VERSION,
  type PreTradeExecutionOutcome,
  type PreTradeExecutionReasonCode,
} from './taxonomy.ts';
import type { PreTradeExecutionDecision, PreTradeExecutionRequest } from './types.ts';

function pushReason(
  reasons: PreTradeExecutionReasonCode[],
  code: PreTradeExecutionReasonCode,
): void {
  if (!reasons.includes(code)) {
    reasons.push(code);
  }
}

function structuredProductAllowed(
  governed: boolean,
  externallyEnabled: boolean,
): boolean {
  return governed && externallyEnabled;
}

function deriveOutcome(
  blockReasons: readonly PreTradeExecutionReasonCode[],
  reviewReasons: readonly PreTradeExecutionReasonCode[],
): PreTradeExecutionOutcome {
  if (blockReasons.length > 0) {
    return 'BLOCK';
  }
  if (reviewReasons.length > 0) {
    return 'REVIEW_REQUIRED';
  }
  return 'ALLOW';
}

/**
 * Deterministic final pre-submission gate immediately before an external broker adapter.
 * Does not issue Execution Authority or post journals. Canonical Risk Engine facts are inputs only.
 */
export function evaluatePreTradeExecutionFirewall(
  request: PreTradeExecutionRequest,
): PreTradeExecutionDecision {
  const blockReasons: PreTradeExecutionReasonCode[] = [];
  const reviewReasons: PreTradeExecutionReasonCode[] = [];

  if (LIVE_INVESTMENT_EXECUTION || LIVE_TRADING_ENABLED) {
    pushReason(blockReasons, 'LIVE_GATE_BLOCKED');
  }
  if (request.environment !== 'SIMULATION' && request.environment !== 'SANDBOX' && request.environment !== 'PAPER') {
    pushReason(blockReasons, 'SIMULATION_ONLY');
  }

  if (request.brokerPreTradeRejection?.rejected) {
    pushReason(blockReasons, 'BROKER_PRETRADE_REJECTION');
    for (const code of request.brokerPreTradeRejection.reasonCodes) {
      if (code === 'BLOCK' || code.startsWith('BROKER_')) {
        pushReason(blockReasons, 'BROKER_PRETRADE_REJECTION');
      }
    }
  }

  if (!request.customerOwnsAccount) {
    pushReason(blockReasons, 'CUSTOMER_ACCOUNT_OWNERSHIP_DENIED');
  }
  if (!request.mandateActive) {
    pushReason(blockReasons, 'MANDATE_INACTIVE');
  }
  if (!request.envelopeValid) {
    pushReason(blockReasons, 'DECISION_VALIDITY_ENVELOPE_INVALID');
  }
  if (!request.kernelAuthorized) {
    pushReason(blockReasons, 'KERNEL_AUTHORIZATION_DENIED');
  }
  if (!request.instrumentEligible) {
    pushReason(blockReasons, 'INSTRUMENT_INELIGIBLE');
  }
  if (!request.marketAccess.allowed) {
    pushReason(blockReasons, 'MARKET_ACCESS_DENIED');
  }
  if (!request.marketSessionOpen) {
    pushReason(blockReasons, 'MARKET_CLOSED');
  }
  if (!request.marketData.authoritative) {
    pushReason(blockReasons, 'MARKET_DATA_NOT_AUTHORITATIVE');
  }
  if (!request.marketData.fresh) {
    pushReason(blockReasons, 'MARKET_DATA_STALE');
  }
  if (!request.capitalReserved) {
    pushReason(blockReasons, 'CAPITAL_NOT_RESERVED');
  }

  const limits = deriveEffectiveCreditCapitalLimits({
    sunrey: request.sunreyLimits,
    broker: request.brokerLimits,
  });

  if (request.order.notionalMinorUnits > limits.effective.maxOrderNotionalMinor) {
    pushReason(blockReasons, 'MAX_ORDER_NOTIONAL_EXCEEDED');
    if (limits.limitingSource === 'BROKER' || limits.limitingSource === 'BOTH') {
      pushReason(blockReasons, 'BROKER_LIMIT_MORE_RESTRICTIVE');
    }
    if (limits.limitingSource === 'SUNREY' || limits.limitingSource === 'BOTH') {
      pushReason(blockReasons, 'SUNREY_LIMIT_MORE_RESTRICTIVE');
    }
  }

  if (request.order.quantityUnits > limits.effective.maxOrderQuantity) {
    pushReason(blockReasons, 'MAX_ORDER_QUANTITY_EXCEEDED');
  }

  if (request.order.side === 'BUY' && request.order.notionalMinorUnits > limits.effective.availableBuyingPowerMinor) {
    pushReason(blockReasons, 'INSUFFICIENT_CASH_OR_BUYING_POWER');
  }

  if (request.participationRateBps > limits.effective.maxParticipationRateBps) {
    pushReason(blockReasons, 'PARTICIPATION_RATE_LIMIT');
  }

  if (request.duplicateOrderDetected) {
    pushReason(blockReasons, 'DUPLICATE_ORDER_DETECTED');
  }
  if (request.order.restrictedSecurity) {
    pushReason(blockReasons, 'RESTRICTED_SECURITY');
  }
  if (request.liquidityConstraintViolated) {
    pushReason(blockReasons, 'LIQUIDITY_CONSTRAINT');
  }
  if (request.strategyContributionBreached) {
    pushReason(blockReasons, 'STRATEGY_CONTRIBUTION_LIMIT');
  }
  if (request.dailyLossBreached) {
    pushReason(blockReasons, 'DAILY_LOSS_LIMIT');
  } else if (request.dailyLossReviewBand) {
    pushReason(reviewReasons, 'DAILY_LOSS_LIMIT');
  }

  const posture = request.structuredProductPosture;
  const order = request.order;

  if (order.positionEffect === 'OPEN_SHORT') {
    if (!structuredProductAllowed(posture.shortSaleGoverned, posture.shortSaleExternallyEnabled)) {
      pushReason(blockReasons, 'SHORT_SALE_DEFAULT_BLOCK');
    }
  }

  if (order.marginLeverageRequested) {
    if (!structuredProductAllowed(posture.marginLeverageGoverned, posture.marginLeverageExternallyEnabled)) {
      pushReason(blockReasons, 'MARGIN_LEVERAGE_DEFAULT_BLOCK');
    }
  }

  if (order.instrumentDerivativeKind === 'UNSUPPORTED' || order.instrumentDerivativeKind === 'SWAP') {
    if (!structuredProductAllowed(posture.derivativesGoverned, posture.derivativesExternallyEnabled)) {
      pushReason(blockReasons, 'UNSUPPORTED_DERIVATIVE_DEFAULT_BLOCK');
    }
  }

  if (order.instrumentDerivativeKind === 'OPTION' && order.optionCoverage === 'NAKED') {
    if (!structuredProductAllowed(posture.nakedOptionsGoverned, posture.nakedOptionsExternallyEnabled)) {
      pushReason(blockReasons, 'NAKED_OPTION_DEFAULT_BLOCK');
    }
  }

  if (order.borrowedSharesRequired && !order.borrowingCovered) {
    if (!structuredProductAllowed(posture.uncoveredBorrowingGoverned, posture.uncoveredBorrowingExternallyEnabled)) {
      pushReason(blockReasons, 'UNCOVERED_BORROWING_DEFAULT_BLOCK');
    }
  }

  if (order.limitPriceMinorUnits !== null && request.marketData.referencePriceMinor !== null) {
    const reference = request.marketData.referencePriceMinor;
    const limit = order.limitPriceMinorUnits;
    if (!priceWithinCollarBps(limit, reference, request.priceCollarBps)) {
      pushReason(blockReasons, 'PRICE_COLLAR_VIOLATION');
    }
    if (fatFingerDeviationBps(limit, reference) > request.fatFingerThresholdBps) {
      pushReason(blockReasons, 'FAT_FINGER_PROTECTION');
    }
  }

  if (request.sunreyRisk.consulted) {
    switch (request.sunreyRisk.outcome) {
      case 'BLOCK':
        pushReason(blockReasons, 'RISK_ENGINE_BLOCK');
        break;
      case 'REQUIRE_REVIEW':
        pushReason(reviewReasons, 'RISK_ENGINE_REVIEW_REQUIRED');
        break;
      case 'INSUFFICIENT_DATA':
        pushReason(blockReasons, 'RISK_ENGINE_INSUFFICIENT_DATA');
        break;
      case 'ALLOW_SIMULATION':
        break;
      default:
        pushReason(blockReasons, 'RISK_ENGINE_INSUFFICIENT_DATA');
        break;
    }
    for (const code of request.sunreyRisk.reasonCodes) {
      if (code.includes('CONCENTRATION')) {
        pushReason(blockReasons, 'CONCENTRATION_LIMIT_EXCEEDED');
      }
      if (code.includes('POSITION')) {
        pushReason(blockReasons, 'POSITION_LIMIT_EXCEEDED');
      }
    }
    for (const id of request.sunreyRisk.triggeredLimitIds) {
      if (id.includes('concentration')) {
        pushReason(blockReasons, 'CONCENTRATION_LIMIT_EXCEEDED');
      }
      if (id.includes('position')) {
        pushReason(blockReasons, 'POSITION_LIMIT_EXCEEDED');
      }
    }
  }

  const outcome = deriveOutcome(blockReasons, reviewReasons);
  const reasonCodes: PreTradeExecutionReasonCode[] =
    outcome === 'ALLOW' ? ['OK'] : Object.freeze([...blockReasons, ...reviewReasons]);

  const brokerAuthoritativeRejection = request.brokerPreTradeRejection?.rejected === true;

  return Object.freeze({
    decisionId: preTradeExecutionDecisionIdFor(request.requestId, request.evaluatedAt),
    requestId: request.requestId,
    outcome,
    reasonCodes: Object.freeze(reasonCodes),
    policyVersion: PRE_TRADE_FIREWALL_POLICY_VERSION,
    evaluatedAt: request.evaluatedAt,
    effectiveLimits: limits.effective,
    limitingSource: limits.limitingSource,
    brokerAuthoritativeRejection,
    grantsSubmissionEligibility: outcome === 'ALLOW' && !brokerAuthoritativeRejection,
  });
}
