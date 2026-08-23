import type { DomainEvent } from '../../../../events/src/events.ts';

const MATERIAL_EVENT_TYPES = new Set([
  'DepositPosted',
  'WithdrawalPosted',
  'PaymentSettled',
  'InternalTransferPosted',
  'AccountPositionChanged',
  'EconomicGraphFactUpdated',
  'EconomicGraphSnapshotCreated',
  'MandateActivated',
  'MandatePaused',
  'MandateRevoked',
  'IdentityKycUpdated',
  'AccountRestricted',
  'InvestmentCashFunded',
  'GrowthOpportunityPreferencesUpdated',
]);

const MINOR_EVENT_TYPES = new Set([
  'CardAuthorizationApproved',
  'FeePosted',
  'CustomerActivityRecorded',
]);

export const MATERIAL_CASH_MINOR = 10_000n;
export const MATERIAL_CASH_BPS = 500;
export const MIN_RECOMPUTE_GAP_MS = 60 * 60 * 1000;

export function eventIsMaterialForOpportunities(eventType: string): boolean {
  return MATERIAL_EVENT_TYPES.has(eventType);
}

export function shouldRecalculateOpportunities(input: {
  readonly event?: Pick<DomainEvent, 'eventType' | 'payload'>;
  readonly lastRecomputeAt?: string;
  readonly now: string;
  readonly scheduled?: boolean;
  readonly previousLiquidMinor?: bigint;
  readonly nextLiquidMinor?: bigint;
}): { readonly recalculate: boolean; readonly reason: string } {
  if (input.event && eventIsMaterialForOpportunities(input.event.eventType)) {
    if (input.event.eventType === 'AccountPositionChanged' || input.event.eventType === 'DepositPosted' || input.event.eventType === 'WithdrawalPosted') {
      if (
        input.previousLiquidMinor !== undefined &&
        input.nextLiquidMinor !== undefined &&
        !cashChangeIsMaterial(input.previousLiquidMinor, input.nextLiquidMinor)
      ) {
        return { recalculate: false, reason: 'cash_change_below_material_threshold' };
      }
    }
    return { recalculate: true, reason: input.event.eventType };
  }
  if (input.event && MINOR_EVENT_TYPES.has(input.event.eventType)) {
    return { recalculate: false, reason: 'minor_event_ignored' };
  }
  if (input.scheduled) {
    if (input.lastRecomputeAt) {
      const last = Date.parse(input.lastRecomputeAt);
      const now = Date.parse(input.now);
      if (Number.isFinite(last) && Number.isFinite(now) && now - last < MIN_RECOMPUTE_GAP_MS) {
        return { recalculate: false, reason: 'scheduled_recompute_too_soon' };
      }
    }
    return { recalculate: true, reason: 'scheduled' };
  }
  return { recalculate: false, reason: 'no_trigger' };
}

export function cashChangeIsMaterial(previous: bigint, next: bigint): boolean {
  const delta = next > previous ? next - previous : previous - next;
  if (delta >= MATERIAL_CASH_MINOR) {
    return true;
  }
  if (previous <= 0n) {
    return delta > 0n;
  }
  return (delta * 10000n) / previous >= BigInt(MATERIAL_CASH_BPS);
}
