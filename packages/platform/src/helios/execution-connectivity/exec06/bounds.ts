import type { UtcInstant } from '@solstice/domain';
import { EXEC06_ENGINE_VERSION, type ExecutionAlgorithmViolationCode } from './taxonomy.ts';
import type {
  AlgorithmMarketContext,
  AlgorithmRiskPort,
  ChildOrder,
  GovernedParentOrderAuthorization,
  ParentOrder,
  RegisterParentOrderInput,
} from './types.ts';

function effectiveParticipationCapBps(parent: ParentOrder): number {
  return Math.min(
    parent.participation.participationCapBps,
    parent.participation.mandateParticipationCapBps,
    parent.participation.riskParticipationCapBps,
  );
}

export function assertGovernedAuthorization(
  authorization: GovernedParentOrderAuthorization,
): ExecutionAlgorithmViolationCode | null {
  if (authorization.grantsExecutionAuthority !== false) {
    return 'PARENT_NOT_GOVERNED';
  }
  return null;
}

export function validateParentRegistration(
  input: RegisterParentOrderInput,
): ExecutionAlgorithmViolationCode | null {
  if (input.authorizedQuantityUnits <= 0n) {
    return 'ZERO_SLICE_QUANTITY';
  }
  if (input.authorization.validUntil <= input.now) {
    return 'VALIDITY_ENVELOPE_EXCEEDED';
  }
  if (input.authorization.grantsExecutionAuthority !== false) {
    return 'PARENT_NOT_GOVERNED';
  }
  const cap = Math.min(
    input.participation.participationCapBps,
    input.participation.mandateParticipationCapBps,
    input.participation.riskParticipationCapBps,
  );
  if (cap <= 0) {
    return 'PARTICIPATION_CEILING_EXCEEDED';
  }
  if (input.maxAuthorizedNotionalMinor <= 0n) {
    return 'NOTIONAL_EXCEEDED';
  }
  return null;
}

export function parentFromInput(
  input: RegisterParentOrderInput,
  parentOrderId: ParentOrder['parentOrderId'],
): ParentOrder {
  return Object.freeze({
    parentOrderId,
    customerId: input.customerId,
    accountId: input.accountId,
    instrumentId: input.instrumentId,
    side: input.side,
    authorizedQuantityUnits: input.authorizedQuantityUnits,
    quantityScale: input.quantityScale,
    currency: input.currency,
    algorithmKind: input.algorithmKind,
    limitConstraints: input.limitConstraints,
    horizon: input.horizon,
    urgency: input.urgency,
    participation: input.participation,
    authorization: input.authorization,
    maxAuthorizedNotionalMinor: input.maxAuthorizedNotionalMinor,
    status: 'REGISTERED',
    registeredAt: input.now,
    methodologyVersion: EXEC06_ENGINE_VERSION,
    grantsExecutionAuthority: false,
    governed: true,
  });
}

export function withinValidityEnvelope(parent: ParentOrder, now: UtcInstant): boolean {
  return now >= parent.authorization.validFrom && now <= parent.authorization.validUntil;
}

export function limitWithinAuthorizedBounds(
  parent: ParentOrder,
  limitPriceMinor: bigint | null,
): ExecutionAlgorithmViolationCode | null {
  if (limitPriceMinor == null) {
    return null;
  }
  const { minLimitPriceMinor, maxLimitPriceMinor } = parent.limitConstraints;
  if (minLimitPriceMinor != null && limitPriceMinor < minLimitPriceMinor) {
    return 'LIMIT_OUT_OF_AUTHORIZED_BOUNDS';
  }
  if (maxLimitPriceMinor != null && limitPriceMinor > maxLimitPriceMinor) {
    return 'LIMIT_OUT_OF_AUTHORIZED_BOUNDS';
  }
  return null;
}

export function childWithinParentIdentity(
  parent: ParentOrder,
  child: Pick<ChildOrder, 'side' | 'instrumentId' | 'customerId' | 'quantityUnits'>,
  filledQuantityUnits: bigint,
): ExecutionAlgorithmViolationCode | null {
  if (child.side !== parent.side) {
    return 'SIDE_REVERSED_FORBIDDEN';
  }
  if (child.instrumentId !== parent.instrumentId) {
    return 'INSTRUMENT_CHANGED_FORBIDDEN';
  }
  if (child.customerId !== parent.customerId) {
    return 'CUSTOMER_CHANGED_FORBIDDEN';
  }
  if (child.quantityUnits <= 0n) {
    return 'ZERO_SLICE_QUANTITY';
  }
  if (filledQuantityUnits + child.quantityUnits > parent.authorizedQuantityUnits) {
    return 'PARENT_QUANTITY_INCREASE_FORBIDDEN';
  }
  return null;
}

export function notionalWithinAuthorization(
  parent: ParentOrder,
  priceMinor: bigint,
  quantityUnits: bigint,
  filledNotionalMinor: bigint,
): ExecutionAlgorithmViolationCode | null {
  if (priceMinor <= 0n || quantityUnits <= 0n) {
    return 'NOTIONAL_EXCEEDED';
  }
  const scale = 10n ** BigInt(parent.quantityScale);
  const sliceNotional = (priceMinor * quantityUnits) / scale;
  if (filledNotionalMinor + sliceNotional > parent.maxAuthorizedNotionalMinor) {
    return 'NOTIONAL_EXCEEDED';
  }
  return null;
}

export function participationWithinCeiling(
  parent: ParentOrder,
  childQuantityUnits: bigint,
  intervalVolumeUnits: bigint,
): { readonly ok: true; readonly participationBps: number } | { readonly ok: false; readonly code: 'PARTICIPATION_CEILING_EXCEEDED' } {
  if (intervalVolumeUnits <= 0n) {
    return { ok: true, participationBps: 0 };
  }
  const participationBps = Number((childQuantityUnits * 10_000n) / intervalVolumeUnits);
  const cap = effectiveParticipationCapBps(parent);
  if (participationBps > cap) {
    return { ok: false, code: 'PARTICIPATION_CEILING_EXCEEDED' };
  }
  return { ok: true, participationBps };
}

export function assessChildWithRisk(
  parent: ParentOrder,
  childQuantityUnits: bigint,
  intervalVolumeUnits: bigint,
  participationBps: number,
  risk: AlgorithmRiskPort,
): ExecutionAlgorithmViolationCode | null {
  const riskResult = risk.assessParticipation({
    parent,
    proposedChildQuantityUnits: childQuantityUnits,
    intervalVolumeUnits,
    participationBps,
  });
  if (!riskResult.ok) {
    return riskResult.code;
  }
  return null;
}

export function referencePriceMinor(
  parent: ParentOrder,
  market: AlgorithmMarketContext,
): bigint {
  const ref = market.marketState.referencePrice?.minorUnits;
  if (ref != null) {
    return BigInt(ref);
  }
  return parent.limitConstraints.referenceArrivalPriceMinor;
}

export function passiveLimitPriceMinor(parent: ParentOrder, market: AlgorithmMarketContext): bigint | null {
  if (parent.side === 'BUY') {
    const bid = market.marketState.bid?.minorUnits;
    return bid != null ? BigInt(bid) : null;
  }
  const ask = market.marketState.ask?.minorUnits;
  return ask != null ? BigInt(ask) : null;
}

export function aggressiveLimitPriceMinor(parent: ParentOrder, market: AlgorithmMarketContext): bigint | null {
  if (parent.side === 'BUY') {
    const ask = market.marketState.ask?.minorUnits;
    return ask != null ? BigInt(ask) : null;
  }
  const bid = market.marketState.bid?.minorUnits;
  return bid != null ? BigInt(bid) : null;
}

export function clampLimitToBounds(parent: ParentOrder, priceMinor: bigint): bigint {
  let out = priceMinor;
  const { minLimitPriceMinor, maxLimitPriceMinor } = parent.limitConstraints;
  if (minLimitPriceMinor != null && out < minLimitPriceMinor) {
    out = minLimitPriceMinor;
  }
  if (maxLimitPriceMinor != null && out > maxLimitPriceMinor) {
    out = maxLimitPriceMinor;
  }
  return out;
}
