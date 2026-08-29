/**
 * ACCESS-14 — Redemption Funding Router.
 *
 * Emits intents toward canonical financial owners. Does not post balances.
 */

export const FUNDING_SOURCE_KINDS = [
  'ACCESS_ENTITLEMENT',
  'FIAT',
  'SUNREY_COIN',
  'MOONREY_COIN',
  'REWARD_CREDIT',
] as const;
export type FundingSourceKind = (typeof FUNDING_SOURCE_KINDS)[number];

export type FundingAllocation = {
  readonly kind: FundingSourceKind;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly targetOwner: 'packages/access-fabric' | 'packages/payments' | 'packages/custody' | 'packages/sunrey-chain';
  readonly reference: string | null;
};

export type FundingComposition = {
  readonly redemptionId: string;
  readonly providerSettlementMinorUnits: bigint;
  readonly currency: string;
  readonly allocations: readonly FundingAllocation[];
};

export type FundingIntent = {
  readonly intentId: string;
  readonly redemptionId: string;
  readonly kind: FundingSourceKind;
  readonly amountMinorUnits: bigint;
  readonly currency: string;
  readonly targetOwner: FundingAllocation['targetOwner'];
  readonly createdAt: string;
};

export type FundingIntentPort = {
  emit(intent: FundingIntent): void;
  listByRedemption(redemptionId: string): readonly FundingIntent[];
};

export class InMemoryFundingIntentPort implements FundingIntentPort {
  private readonly byRedemption = new Map<string, FundingIntent[]>();

  emit(intent: FundingIntent): void {
    const frozen = Object.freeze({ ...intent });
    const rows = this.byRedemption.get(intent.redemptionId) ?? [];
    rows.push(frozen);
    this.byRedemption.set(intent.redemptionId, rows);
  }

  listByRedemption(redemptionId: string): readonly FundingIntent[] {
    return this.byRedemption.get(redemptionId) ?? [];
  }
}

export type FundingRouterInput = {
  readonly redemptionId: string;
  readonly currency: string;
  readonly providerSettlementMinorUnits: bigint;
  readonly entitlementCoverageMinorUnits: bigint;
  readonly userFiatMinorUnits: bigint;
  readonly sunreyCoinMinorUnits?: bigint;
  readonly moonreyCoinMinorUnits?: bigint;
  readonly rewardCreditMinorUnits?: bigint;
  readonly createdAt: string;
};

export function composeFunding(input: FundingRouterInput): FundingComposition {
  const allocations: FundingAllocation[] = [];
  if (input.entitlementCoverageMinorUnits > 0n) {
    allocations.push(
      Object.freeze({
        kind: 'ACCESS_ENTITLEMENT',
        amountMinorUnits: input.entitlementCoverageMinorUnits,
        currency: input.currency,
        targetOwner: 'packages/access-fabric',
        reference: input.redemptionId,
      }),
    );
  }
  if (input.userFiatMinorUnits > 0n) {
    allocations.push(
      Object.freeze({
        kind: 'FIAT',
        amountMinorUnits: input.userFiatMinorUnits,
        currency: input.currency,
        targetOwner: 'packages/payments',
        reference: input.redemptionId,
      }),
    );
  }
  if ((input.sunreyCoinMinorUnits ?? 0n) > 0n) {
    allocations.push(
      Object.freeze({
        kind: 'SUNREY_COIN',
        amountMinorUnits: input.sunreyCoinMinorUnits!,
        currency: input.currency,
        targetOwner: 'packages/custody',
        reference: input.redemptionId,
      }),
    );
  }
  if ((input.moonreyCoinMinorUnits ?? 0n) > 0n) {
    allocations.push(
      Object.freeze({
        kind: 'MOONREY_COIN',
        amountMinorUnits: input.moonreyCoinMinorUnits!,
        currency: input.currency,
        targetOwner: 'packages/custody',
        reference: input.redemptionId,
      }),
    );
  }
  if ((input.rewardCreditMinorUnits ?? 0n) > 0n) {
    allocations.push(
      Object.freeze({
        kind: 'REWARD_CREDIT',
        amountMinorUnits: input.rewardCreditMinorUnits!,
        currency: input.currency,
        targetOwner: 'packages/access-fabric',
        reference: input.redemptionId,
      }),
    );
  }
  return Object.freeze({
    redemptionId: input.redemptionId,
    providerSettlementMinorUnits: input.providerSettlementMinorUnits,
    currency: input.currency,
    allocations: Object.freeze(allocations),
  });
}

export class RedemptionFundingRouter {
  private readonly port: FundingIntentPort;

  constructor(port: FundingIntentPort) {
    this.port = port;
  }

  route(input: FundingRouterInput): FundingComposition {
    const composition = composeFunding(input);
    for (const allocation of composition.allocations) {
      this.port.emit(
        Object.freeze({
          intentId: `fi_${input.redemptionId}_${allocation.kind}`,
          redemptionId: input.redemptionId,
          kind: allocation.kind,
          amountMinorUnits: allocation.amountMinorUnits,
          currency: allocation.currency,
          targetOwner: allocation.targetOwner,
          createdAt: input.createdAt,
        }),
      );
    }
    return composition;
  }
}
