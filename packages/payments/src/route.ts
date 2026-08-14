import type { Money } from '../../money/src/money.ts';
import type { Beneficiary } from './beneficiary.ts';
import type { PaymentCorridor } from './corridor.ts';
import { asRouteId, type RouteId } from './ids.ts';

export type PaymentRoute = {
  readonly routeId: RouteId;
  readonly corridorId: string;
  readonly rail: string;
  readonly provider: string;
  readonly sourceLegalEntityId: string;
  readonly destinationPartner: string;
  readonly settlementCurrency: string;
  readonly estimatedSettlementMs: bigint;
  readonly fee: Money;
  readonly available: boolean;
  readonly riskPosture: 'STANDARD' | 'ELEVATED';
  readonly compliant: boolean;
  readonly costScore: bigint;
  readonly speedScore: bigint;
  readonly reliabilityScore: bigint;
};

export type RouteRejection = {
  readonly routeId: RouteId;
  readonly reason: string;
};

export type RouteSelection = {
  readonly chosen: PaymentRoute | null;
  readonly rejected: readonly RouteRejection[];
};

export type RouteHardConstraints = {
  readonly corridor: PaymentCorridor;
  readonly beneficiary: Beneficiary;
  readonly sanctionsHit: boolean;
  readonly amount: Money;
  readonly maxAmount: Money;
  readonly providerAvailable: boolean;
};

/**
 * Compliance is a hard filter. Cost/speed/reliability are used only among
 * routes that already passed every hard constraint.
 */
export function selectRoute(
  candidates: readonly PaymentRoute[],
  constraints: RouteHardConstraints,
): RouteSelection {
  const rejected: RouteRejection[] = [];
  const eligible: PaymentRoute[] = [];
  for (const route of candidates) {
    const hard = hardReject(route, constraints);
    if (hard) {
      rejected.push({ routeId: route.routeId, reason: hard });
      continue;
    }
    eligible.push(route);
  }
  if (eligible.length === 0) {
    return Object.freeze({ chosen: null, rejected: Object.freeze(rejected) });
  }
  const chosen = [...eligible].sort((a, b) => {
    if (a.costScore !== b.costScore) {
      return a.costScore < b.costScore ? -1 : 1;
    }
    if (a.speedScore !== b.speedScore) {
      return a.speedScore > b.speedScore ? -1 : 1;
    }
    if (a.reliabilityScore !== b.reliabilityScore) {
      return a.reliabilityScore > b.reliabilityScore ? -1 : 1;
    }
    return a.routeId < b.routeId ? -1 : 1;
  })[0]!;
  return Object.freeze({ chosen, rejected: Object.freeze(rejected) });
}

function hardReject(route: PaymentRoute, constraints: RouteHardConstraints): string | null {
  if (route.corridorId !== constraints.corridor.corridorId) {
    return 'jurisdiction_mismatch';
  }
  if (route.sourceLegalEntityId !== constraints.corridor.servingLegalEntityId) {
    return 'legal_entity_mismatch';
  }
  if (route.settlementCurrency !== constraints.beneficiary.currency) {
    return 'currency_mismatch';
  }
  if (constraints.beneficiary.status !== 'ACTIVE') {
    return 'beneficiary_not_active';
  }
  if (constraints.sanctionsHit || !route.compliant) {
    return 'sanctions_or_compliance';
  }
  if (!route.available || !constraints.providerAvailable) {
    return 'provider_unavailable';
  }
  if (constraints.amount.cmp(constraints.maxAmount) > 0) {
    return 'amount_limit';
  }
  return null;
}

export function simulationRoutesFor(corridorId: string, fee: Money): readonly PaymentRoute[] {
  if (corridorId === 'US-SA-USD-SAR') {
    return Object.freeze([
      route({
        routeId: 'sim-gcc-usd-sar',
        corridorId,
        rail: 'SIMULATED_GCC',
        provider: 'SIMULATION_GCC_RAIL',
        sourceLegalEntityId: 'le_solstice_us_inc',
        destinationPartner: 'SIMULATION_SA_NOSTRO',
        settlementCurrency: 'SAR',
        estimatedSettlementMs: 86_400_000n,
        fee,
        available: true,
        riskPosture: 'STANDARD',
        compliant: true,
        costScore: 10n,
        speedScore: 50n,
        reliabilityScore: 80n,
      }),
      route({
        routeId: 'sim-swift-usd-sar',
        corridorId,
        rail: 'SIMULATED_SWIFT',
        provider: 'SIMULATION_SWIFT_RAIL',
        sourceLegalEntityId: 'le_solstice_us_inc',
        destinationPartner: 'SIMULATION_SA_NOSTRO',
        settlementCurrency: 'SAR',
        estimatedSettlementMs: 172_800_000n,
        fee,
        available: true,
        riskPosture: 'STANDARD',
        compliant: true,
        costScore: 20n,
        speedScore: 20n,
        reliabilityScore: 90n,
      }),
      route({
        routeId: 'sim-noncompliant-usd-sar',
        corridorId,
        rail: 'SIMULATED_BLOCKED',
        provider: 'SIMULATION_BLOCKED_RAIL',
        sourceLegalEntityId: 'le_solstice_us_inc',
        destinationPartner: 'SIMULATION_SA_NOSTRO',
        settlementCurrency: 'SAR',
        estimatedSettlementMs: 3_600_000n,
        fee,
        available: true,
        riskPosture: 'ELEVATED',
        compliant: false,
        costScore: 1n,
        speedScore: 100n,
        reliabilityScore: 10n,
      }),
    ]);
  }
  if (corridorId === 'SA-US-SAR-USD') {
    return Object.freeze([
      route({
        routeId: 'sim-gcc-sar-usd',
        corridorId,
        rail: 'SIMULATED_GCC',
        provider: 'SIMULATION_GCC_RAIL',
        sourceLegalEntityId: 'le_solstice_sa_entity',
        destinationPartner: 'SIMULATION_US_NOSTRO',
        settlementCurrency: 'USD',
        estimatedSettlementMs: 86_400_000n,
        fee,
        available: true,
        riskPosture: 'STANDARD',
        compliant: true,
        costScore: 10n,
        speedScore: 50n,
        reliabilityScore: 80n,
      }),
    ]);
  }
  return Object.freeze([]);
}

function route(input: Omit<PaymentRoute, 'routeId'> & { readonly routeId: string }): PaymentRoute {
  return Object.freeze({ ...input, routeId: asRouteId(input.routeId) });
}
