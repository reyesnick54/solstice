import { Money } from '../../money/src/money.ts';
import type { PaymentRoute, RouteHardConstraints, RouteRejection } from '../../payments/src/route.ts';
import { selectRoute } from '../../payments/src/route.ts';
import type { TreasuryAccount } from './account.ts';
import type { TreasuryPosition } from './position.ts';
import { totalUsableLiquidity } from './position.ts';
import { evaluatePrefunding } from './prefunding.ts';
import type { KillSwitch } from './controls.ts';
import { killSwitchBlocks } from './controls.ts';
import type { ConcentrationSnapshot } from './controls.ts';
import type { SettlementExposure } from './controls.ts';
import type { LiquiditySnapshotId, RouteDecisionId } from './ids.ts';
import { ROUTING_VERSION, ROUTING_WEIGHTS_V1, type SettlementRiskState } from './types.ts';

export type TreasuryRouteFacts = {
  readonly requiredLiquidity: Money;
  readonly destinationCountry: string;
  readonly sourceJurisdiction: string;
  readonly destinationJurisdiction: string;
  readonly sourceCurrency: string;
  readonly destinationCurrency: string;
  readonly acceptedQuoteRequired: boolean;
  readonly quoteAccepted: boolean;
  readonly customerAccountActive: boolean;
  readonly securityHold: boolean;
};

export type EnrichedRoute = PaymentRoute & {
  readonly sourceJurisdiction: string;
  readonly destinationJurisdiction: string;
  readonly sourceCurrency: string;
  readonly destinationCurrency: string;
  readonly estimatedProviderCost: Money;
  readonly estimatedFxCost: Money;
  readonly availableLiquidity: Money | null;
  readonly requiredLiquidity: Money;
  readonly providerHealth: string;
  readonly concentrationExposure: bigint;
  readonly settlementRiskState: SettlementRiskState;
  readonly treasuryAccountId: string | null;
};

export type ScoreComponents = {
  readonly providerFee: bigint;
  readonly fxCost: bigint;
  readonly expectedSpeed: bigint;
  readonly historicalReliability: bigint;
  readonly liquidityConsumption: bigint;
  readonly providerConcentration: bigint;
  readonly settlementExposure: bigint;
  readonly total: bigint;
};

export type RouteExplanation = {
  readonly routingVersion: string;
  readonly selectedRouteId: string | null;
  readonly eligible: readonly string[];
  readonly rejected: readonly RouteRejection[];
  readonly scoreComponents: Readonly<Record<string, ScoreComponents>>;
  readonly liquiditySnapshotId: LiquiditySnapshotId | null;
  readonly whySelected: string;
};

export type TreasuryRouteSelection = {
  readonly chosen: EnrichedRoute | null;
  readonly rejected: readonly RouteRejection[];
  readonly eligible: readonly EnrichedRoute[];
  readonly explanation: RouteExplanation;
  readonly decisionId: RouteDecisionId | null;
};

function asCost(route: PaymentRoute): Money {
  return route.fee;
}

export function enrichRoute(
  route: PaymentRoute,
  facts: TreasuryRouteFacts,
  book: TreasuryAccount | undefined,
  position: TreasuryPosition | undefined,
  concentration: bigint,
  settlementRisk: SettlementRiskState,
): EnrichedRoute {
  return Object.freeze({
    ...route,
    sourceJurisdiction: facts.sourceJurisdiction,
    destinationJurisdiction: facts.destinationJurisdiction,
    sourceCurrency: facts.sourceCurrency,
    destinationCurrency: facts.destinationCurrency,
    estimatedProviderCost: asCost(route),
    estimatedFxCost: Money.zero(facts.sourceCurrency),
    availableLiquidity: position ? totalUsableLiquidity(position) : null,
    requiredLiquidity: facts.requiredLiquidity,
    providerHealth: route.available ? 'AVAILABLE' : 'UNAVAILABLE',
    concentrationExposure: concentration,
    settlementRiskState: settlementRisk,
    treasuryAccountId: book?.treasuryAccountId ?? null,
  });
}

export function treasuryHardReject(
  route: EnrichedRoute,
  constraints: RouteHardConstraints,
  facts: TreasuryRouteFacts,
  switches: readonly KillSwitch[],
): string | null {
  if (!facts.customerAccountActive) {
    return 'customer_account_state';
  }
  if (facts.acceptedQuoteRequired && !facts.quoteAccepted) {
    return 'accepted_quote_required';
  }
  if (facts.securityHold) {
    return 'security';
  }
  if (route.settlementRiskState === 'HALTED' || route.settlementRiskState === 'RESTRICTED') {
    return 'settlement_risk';
  }
  const blocked = killSwitchBlocks(switches, {
    provider: route.provider,
    rail: route.rail,
    corridorId: route.corridorId,
    treasuryAccountId: route.treasuryAccountId,
    sourceCurrency: route.sourceCurrency,
    destinationCurrency: route.destinationCurrency,
  });
  if (blocked) {
    return blocked;
  }
  const prefund = evaluatePrefunding(
    {
      corridorId: route.corridorId,
      routeId: route.routeId,
      destinationCurrency: facts.destinationCurrency,
      destinationCountry: facts.destinationCountry,
      required: facts.requiredLiquidity,
    },
    route.treasuryAccountId
      ? ({
          treasuryAccountId: route.treasuryAccountId as never,
          currency: facts.destinationCurrency,
        } as TreasuryAccount)
      : undefined,
    route.availableLiquidity
      ? ({
          currency: facts.destinationCurrency,
          available: route.availableLiquidity,
        } as TreasuryPosition)
      : undefined,
  );
  if (!prefund.executable) {
    return 'liquidity';
  }
  void constraints;
  return null;
}

export function scoreRoute(
  route: EnrichedRoute,
  concentration: ConcentrationSnapshot | undefined,
  exposure: SettlementExposure | undefined,
  weights = ROUTING_WEIGHTS_V1,
): ScoreComponents {
  const fee = route.estimatedProviderCost.minorUnits;
  const fx = route.estimatedFxCost.minorUnits;
  const speedPenalty = route.estimatedSettlementMs / 3_600_000n;
  const reliabilityPenalty = 100n - route.reliabilityScore;
  const available = route.availableLiquidity?.minorUnits ?? 0n;
  const consumption =
    available === 0n ? 1_000_000n : (route.requiredLiquidity.minorUnits * 10_000n) / available;
  const concentrationPts = concentration?.ratioBps ?? route.concentrationExposure;
  const exposurePts =
    exposure?.state === 'HALTED'
      ? 1_000_000n
      : exposure?.state === 'RESTRICTED'
        ? 50_000n
        : exposure?.state === 'ELEVATED'
          ? 10_000n
          : 0n;
  const total =
    weights.providerFee * fee +
    weights.fxCost * fx +
    weights.expectedSpeed * speedPenalty +
    weights.historicalReliability * reliabilityPenalty +
    weights.liquidityConsumption * consumption +
    weights.providerConcentration * concentrationPts +
    weights.settlementExposure * exposurePts;
  return Object.freeze({
    providerFee: weights.providerFee * fee,
    fxCost: weights.fxCost * fx,
    expectedSpeed: weights.expectedSpeed * speedPenalty,
    historicalReliability: weights.historicalReliability * reliabilityPenalty,
    liquidityConsumption: weights.liquidityConsumption * consumption,
    providerConcentration: weights.providerConcentration * concentrationPts,
    settlementExposure: weights.settlementExposure * exposurePts,
    total,
  });
}

export function selectTreasuryRoute(
  candidates: readonly EnrichedRoute[],
  constraints: RouteHardConstraints,
  facts: TreasuryRouteFacts,
  switches: readonly KillSwitch[],
  concentrations: ReadonlyMap<string, ConcentrationSnapshot>,
  exposures: ReadonlyMap<string, SettlementExposure>,
  liquiditySnapshotId: LiquiditySnapshotId | null,
): TreasuryRouteSelection {
  const paymentFilter = selectRoute(candidates, constraints);
  const rejected: RouteRejection[] = [...paymentFilter.rejected];
  const afterCompliance: EnrichedRoute[] = [];
  for (const route of candidates) {
    if (paymentFilter.rejected.some((row) => row.routeId === route.routeId)) {
      continue;
    }
    afterCompliance.push(route);
  }
  const eligible: EnrichedRoute[] = [];
  for (const route of afterCompliance) {
    const hard = treasuryHardReject(route, constraints, facts, switches);
    if (hard) {
      rejected.push({ routeId: route.routeId, reason: hard });
      continue;
    }
    eligible.push(route);
  }
  const scores: Record<string, ScoreComponents> = {};
  for (const route of eligible) {
    scores[route.routeId] = scoreRoute(
      route,
      concentrations.get(route.provider),
      exposures.get(`${route.provider}:${route.corridorId}`),
    );
  }
  const chosen =
    eligible.length === 0
      ? null
      : [...eligible].sort((a, b) => {
          const sa = scores[a.routeId]!.total;
          const sb = scores[b.routeId]!.total;
          if (sa !== sb) {
            return sa < sb ? -1 : 1;
          }
          return a.routeId < b.routeId ? -1 : 1;
        })[0]!;
  const whySelected = chosen
    ? `selected ${chosen.routeId} after hard eligibility filter; score ${scores[chosen.routeId]!.total.toString()} using ${ROUTING_VERSION}`
    : 'no eligible route survived the hard filter';
  return Object.freeze({
    chosen,
    rejected: Object.freeze(rejected),
    eligible: Object.freeze(eligible),
    decisionId: null,
    explanation: Object.freeze({
      routingVersion: ROUTING_VERSION,
      selectedRouteId: chosen?.routeId ?? null,
      eligible: Object.freeze(eligible.map((row) => row.routeId)),
      rejected: Object.freeze(rejected),
      scoreComponents: Object.freeze(scores),
      liquiditySnapshotId,
      whySelected,
    }),
  });
}
