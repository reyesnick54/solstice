import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import {
  buildCancelReplaceConditions,
  buildPartialFillConditions,
  continuationTacticType,
  resolveRemainingQuantity,
} from './continuation.ts';
import { EXECUTION_TACTIC_METHODOLOGY_VERSION } from './taxonomy.ts';
import type { ExecutionOrderType, ExecutionTacticType, ExecutionTimeInForce } from './taxonomy.ts';
import { buildCostEstimate } from './transaction-cost.ts';
import {
  customerPermitsPlanning,
  envelopePermitsPlanning,
  marketPermitsPlanning,
  planPermitsExecution,
  providerSupportsOrder,
  researchRecommendationAdmissible,
  validateExecutionTactic,
} from './validation.ts';
import type {
  ExecutionTactic,
  OrderPlanningInput,
  OrderPlanningResult,
  TacticScheduleSlice,
} from './types.ts';

const SLICE_INTERVAL_MS = 60_000;

function tacticIdFor(material: string): string {
  return `tac_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

function priceMinorFromQuote(minorUnits: string | undefined | null): bigint | null {
  if (minorUnits == null) {
    return null;
  }
  try {
    return BigInt(minorUnits);
  } catch {
    return null;
  }
}

function notionalMinor(priceMinor: bigint, quantityUnits: bigint, quantityScale: number): bigint {
  if (priceMinor <= 0n || quantityUnits <= 0n) {
    return 0n;
  }
  const scale = 10n ** BigInt(quantityScale);
  return (priceMinor * quantityUnits) / scale;
}

function roundToLot(quantityUnits: bigint, lotSizeUnits: bigint): bigint {
  if (lotSizeUnits <= 0n) {
    return quantityUnits;
  }
  return (quantityUnits / lotSizeUnits) * lotSizeUnits;
}

function selectBaseTacticType(input: OrderPlanningInput): ExecutionTacticType {
  const plan = input.executionPlan;
  if (input.partialFillRemainingUnits != null && input.partialFillRemainingUnits > 0n) {
    return 'PARTIAL_FILL_CONTINUATION';
  }
  if (plan.strategyRequirements.includes('URGENT_EXIT') || plan.urgency === 'URGENT_EXIT') {
    return 'MARKET';
  }
  if (plan.strategyRequirements.includes('TWAP')) {
    return 'TWAP_SLICE';
  }
  if (plan.strategyRequirements.includes('VWAP')) {
    return 'VWAP_AWARE';
  }
  if (plan.strategyRequirements.includes('PARTICIPATION_RATE')) {
    return 'PARTICIPATION_RATE';
  }
  if (plan.strategyRequirements.includes('AGGRESSIVE_ENTRY') || plan.urgency === 'HIGH') {
    return 'AGGRESSIVE_LIMIT';
  }
  if (plan.strategyRequirements.includes('PASSIVE_ENTRY') || plan.urgency === 'PASSIVE') {
    return 'PASSIVE_LIMIT';
  }
  if (input.researchRecommendation?.suggestedTacticType != null) {
    return input.researchRecommendation.suggestedTacticType;
  }
  const spread = input.marketState.spreadBps ?? input.transactionCostModel.spreadBps;
  if (spread != null && spread <= 15) {
    return 'PASSIVE_LIMIT';
  }
  if (spread != null && spread >= 80) {
    return 'PASSIVE_LIMIT';
  }
  return 'AGGRESSIVE_LIMIT';
}

function selectOrderType(tacticType: ExecutionTacticType, input: OrderPlanningInput): ExecutionOrderType {
  if (tacticType === 'MARKET') {
    return 'MARKET';
  }
  if (input.researchRecommendation?.suggestedOrderType != null) {
    return input.researchRecommendation.suggestedOrderType;
  }
  return 'LIMIT';
}

function selectTimeInForce(
  tacticType: ExecutionTacticType,
  orderType: ExecutionOrderType,
  input: OrderPlanningInput,
): ExecutionTimeInForce {
  if (tacticType === 'MARKET') {
    if (input.providerCapabilities.supportedTimeInForce.includes('IOC')) {
      return 'IOC';
    }
    return 'DAY';
  }
  if (tacticType === 'AGGRESSIVE_LIMIT' && input.providerCapabilities.supportedTimeInForce.includes('IOC')) {
    return 'IOC';
  }
  if (planPrefersDay(input)) {
    return input.providerCapabilities.supportedTimeInForce.includes('DAY') ? 'DAY' : 'GTC';
  }
  return input.providerCapabilities.supportedTimeInForce.includes('GTC') ? 'GTC' : 'DAY';
}

function planPrefersDay(input: OrderPlanningInput): boolean {
  return input.executionPlan.assetClass.toLowerCase().includes('future');
}

function computeLimitPrice(
  tacticType: ExecutionTacticType,
  input: OrderPlanningInput,
): bigint | null {
  const bid = priceMinorFromQuote(input.marketState.bid?.minorUnits);
  const ask = priceMinorFromQuote(input.marketState.ask?.minorUnits);
  const ref = priceMinorFromQuote(input.marketState.referencePrice?.minorUnits);
  const side = input.executionPlan.side;

  if (tacticType === 'MARKET') {
    return null;
  }
  if (tacticType === 'AGGRESSIVE_LIMIT') {
    if (side === 'BUY') {
      return ask ?? ref;
    }
    return bid ?? ref;
  }
  if (side === 'BUY') {
    return bid ?? ref;
  }
  return ask ?? ref;
}

function shouldSlice(input: OrderPlanningInput, quantityUnits: bigint): boolean {
  const tacticType = selectBaseTacticType(input);
  if (tacticType !== 'TWAP_SLICE' && tacticType !== 'VWAP_AWARE' && tacticType !== 'PARTICIPATION_RATE') {
    return false;
  }
  const adv = input.volumeProfileMinor;
  if (adv == null || adv <= 0n) {
    return tacticType === 'TWAP_SLICE';
  }
  const ref = priceMinorFromQuote(input.marketState.referencePrice?.minorUnits) ?? input.executionPlan.arrivalPriceMinor;
  const notional = notionalMinor(ref, quantityUnits, input.executionPlan.quantityScale);
  return notional > adv / 20n;
}

function buildSchedule(
  quantityUnits: bigint,
  input: OrderPlanningInput,
  lotSizeUnits: bigint,
): { readonly slices: readonly TacticScheduleSlice[]; readonly numberOfSlices: number; readonly sliceQuantity: bigint } {
  const maxParticipation = input.executionPlan.maxParticipationRateBps ?? 1000;
  const adv = input.volumeProfileMinor;
  let numberOfSlices = 1;

  if (shouldSlice(input, quantityUnits)) {
    if (input.executionPlan.strategyRequirements.includes('TWAP')) {
      numberOfSlices = Math.min(8, Math.max(2, Number(quantityUnits / (lotSizeUnits > 0n ? lotSizeUnits * 10n : 10n))));
    } else if (adv != null && adv > 0n && input.volumeProfileCertainty !== 'INSUFFICIENT_DATA') {
      const ref = priceMinorFromQuote(input.marketState.referencePrice?.minorUnits) ?? input.executionPlan.arrivalPriceMinor;
      const perSliceCap = (adv * BigInt(maxParticipation)) / 10_000n;
      const orderNotional = notionalMinor(ref, quantityUnits, input.executionPlan.quantityScale);
      numberOfSlices = Math.min(12, Math.max(2, Number(orderNotional / (perSliceCap > 0n ? perSliceCap : 1n)) || 2));
    } else {
      numberOfSlices = 4;
    }
  }

  numberOfSlices = Math.max(1, Math.min(12, numberOfSlices));
  const baseSlice = roundToLot(quantityUnits / BigInt(numberOfSlices), lotSizeUnits);
  const slices: TacticScheduleSlice[] = [];
  let remaining = quantityUnits;

  for (let i = 0; i < numberOfSlices; i += 1) {
    const isLast = i === numberOfSlices - 1;
    const sliceQty = isLast ? remaining : baseSlice;
    remaining -= sliceQty;
    slices.push(
      Object.freeze({
        sliceIndex: i,
        executeAt: new Date(Date.parse(input.now) + i * SLICE_INTERVAL_MS).toISOString() as UtcInstant,
        quantityUnits: sliceQty,
      }),
    );
  }

  return Object.freeze({
    slices: Object.freeze(slices),
    numberOfSlices,
    sliceQuantity: baseSlice,
  });
}

function buildTactic(input: OrderPlanningInput, quantityUnits: bigint): ExecutionTactic {
  const plan = input.executionPlan;
  let tacticType = selectBaseTacticType(input);
  if (input.partialFillRemainingUnits != null && input.partialFillRemainingUnits > 0n) {
    tacticType = 'PARTIAL_FILL_CONTINUATION';
  } else if (input.priorTacticId != null) {
    tacticType = continuationTacticType(null);
  }

  let orderType = selectOrderType(tacticType, input);
  let timeInForce = selectTimeInForce(tacticType, orderType, input);

  if (providerSupportsOrder(input.providerCapabilities, orderType, timeInForce).length > 0) {
    if (orderType === 'MARKET' && input.providerCapabilities.supportedOrderTypes.includes('LIMIT')) {
      orderType = 'LIMIT';
      tacticType = 'AGGRESSIVE_LIMIT';
    }
    if (!input.providerCapabilities.supportedTimeInForce.includes(timeInForce)) {
      timeInForce = input.providerCapabilities.supportedTimeInForce[0] ?? 'DAY';
    }
  }

  const limitPriceMinor = computeLimitPrice(tacticType, input);
  const lotSize = input.providerCapabilities.lotSizeUnits;
  const roundedQty = roundToLot(quantityUnits, lotSize);
  const scheduleInfo = buildSchedule(roundedQty, input, lotSize);
  const refPrice = limitPriceMinor ?? priceMinorFromQuote(input.marketState.referencePrice?.minorUnits) ?? plan.arrivalPriceMinor;
  const notional = notionalMinor(refPrice, roundedQty, plan.quantityScale);

  const spreadBps = input.transactionCostModel.spreadBps ?? input.marketState.spreadBps;
  const slippageBps = input.transactionCostModel.estimatedSlippageBps;

  const estimatedSpreadCost = buildCostEstimate({
    notionalMinor: notional,
    bps: spreadBps != null ? spreadBps / 2 : null,
    fixedMinor: null,
    certainty: input.transactionCostModel.spreadCertainty,
    explanation:
      spreadBps == null
        ? 'Spread unavailable; spread cost not estimated.'
        : 'Half-spread crossing estimate for selected tactic.',
  });

  const estimatedSlippage = buildCostEstimate({
    notionalMinor: notional,
    bps: slippageBps,
    fixedMinor: null,
    certainty: input.transactionCostModel.slippageCertainty,
    explanation:
      slippageBps == null
        ? 'Slippage model inputs incomplete.'
        : 'Slippage estimated from transaction cost model.',
  });

  const estimatedFees = buildCostEstimate({
    notionalMinor: notional,
    bps: null,
    fixedMinor: input.transactionCostModel.feeMinor,
    certainty: input.transactionCostModel.feeCertainty,
    explanation:
      input.transactionCostModel.feeMinor == null
        ? 'Fee schedule unavailable for provider route.'
        : 'Fixed commission from provider capability metadata.',
  });

  const timeoutAt = plan.validUntil;
  const cancelConditions = input.providerCapabilities.supportsCancelReplace
    ? buildCancelReplaceConditions({
        maxSlippageBps: plan.maxSlippageBps,
        spreadBps: spreadBps,
        now: input.now,
      })
    : Object.freeze([]);

  const replaceConditions =
    input.providerCapabilities.supportsCancelReplace && tacticType !== 'MARKET'
      ? buildCancelReplaceConditions({
          maxSlippageBps: plan.maxSlippageBps,
          spreadBps: spreadBps,
          now: input.now,
        })
      : Object.freeze([]);

  const partialFillConditions = input.providerCapabilities.supportsPartialFill
    ? buildPartialFillConditions()
    : Object.freeze([]);

  const material = `${input.requestId}:${plan.executionPlanId}:${tacticType}:${orderType}:${roundedQty}:${input.now}`;
  const tacticId = tacticIdFor(material);

  return Object.freeze({
    tacticId,
    executionPlanId: plan.executionPlanId,
    tacticType,
    orderType,
    timeInForce,
    side: plan.side,
    quantityUnits: roundedQty,
    remainingQuantityUnits: roundedQty,
    limitPriceMinor,
    stopPriceMinor: null,
    numberOfSlices: scheduleInfo.numberOfSlices > 1 ? scheduleInfo.numberOfSlices : null,
    sliceQuantityUnits: scheduleInfo.numberOfSlices > 1 ? scheduleInfo.sliceQuantity : null,
    schedule: scheduleInfo.slices,
    urgency: plan.urgency,
    estimatedSpreadCost,
    estimatedSlippage,
    estimatedFees,
    timeoutAt,
    cancelConditions: Object.freeze([...cancelConditions, ...partialFillConditions]),
    replaceConditions,
    evidence: Object.freeze([
      ...plan.evidenceRefs,
      `methodology:${EXECUTION_TACTIC_METHODOLOGY_VERSION}`,
      `market:${input.marketState.instrumentId}`,
      `route:${input.providerCapabilities.routeId}`,
    ]),
    methodologyVersion: EXECUTION_TACTIC_METHODOLOGY_VERSION,
    deterministic: true as const,
    grantsExecutionAuthority: false as const,
    computedAt: input.now,
  });
}

export function planExecutionTactic(input: OrderPlanningInput): OrderPlanningResult {
  const refusalReasons = [
    ...envelopePermitsPlanning(input.envelope, input.now),
    ...marketPermitsPlanning(input.marketState),
    ...planPermitsExecution(input.executionPlan, input.now),
    ...customerPermitsPlanning(input.executionPlan, input.customerConstraints),
  ];

  const quantityUnits = resolveRemainingQuantity(input);
  if (quantityUnits <= 0n) {
    return Object.freeze({
      requestId: input.requestId,
      outcome: 'REFUSED',
      tactic: null,
      refusalReasons: Object.freeze([...new Set([...refusalReasons, 'ZERO_REMAINING_QUANTITY'])]),
      researchAccepted: false,
      evidence: Object.freeze(['remaining_quantity_zero']),
      computedAt: input.now,
    });
  }

  if (refusalReasons.length > 0) {
    return Object.freeze({
      requestId: input.requestId,
      outcome: 'REFUSED',
      tactic: null,
      refusalReasons: Object.freeze([...new Set(refusalReasons)]),
      researchAccepted: false,
      evidence: Object.freeze(refusalReasons.map((r) => `refusal:${r}`)),
      computedAt: input.now,
    });
  }

  const tactic = buildTactic(input, quantityUnits);
  const validationFailures = validateExecutionTactic(tactic, input);
  const researchAccepted = researchRecommendationAdmissible(input.researchRecommendation, tactic.tacticType);

  if (!researchAccepted) {
    return Object.freeze({
      requestId: input.requestId,
      outcome: 'REFUSED',
      tactic: null,
      refusalReasons: Object.freeze(['RESEARCH_RECOMMENDATION_REJECTED']),
      researchAccepted: false,
      evidence: Object.freeze(['research_recommendation_incompatible_with_deterministic_plan']),
      computedAt: input.now,
    });
  }

  if (validationFailures.length > 0) {
    return Object.freeze({
      requestId: input.requestId,
      outcome: 'REFUSED',
      tactic: null,
      refusalReasons: Object.freeze(validationFailures),
      researchAccepted,
      evidence: Object.freeze(validationFailures.map((r) => `validation:${r}`)),
      computedAt: input.now,
    });
  }

  const requestedType = selectBaseTacticType(input);
  const outcome =
    tactic.orderType === 'LIMIT' &&
    requestedType === 'MARKET' &&
    !input.providerCapabilities.supportedOrderTypes.includes('MARKET')
      ? 'DEGRADED'
      : 'PLANNED';

  return Object.freeze({
    requestId: input.requestId,
    outcome,
    tactic,
    refusalReasons: Object.freeze([]),
    researchAccepted,
    evidence: Object.freeze([...tactic.evidence, `outcome:${outcome}`]),
    computedAt: input.now,
  });
}
