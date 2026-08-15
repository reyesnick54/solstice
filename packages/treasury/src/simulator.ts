import { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { RouteHardConstraints } from '../../payments/src/route.ts';
import type { KillSwitch } from './controls.ts';
import { freezeKillSwitch } from './controls.ts';
import { asKillSwitchId } from './ids.ts';
import type { EnrichedRoute, TreasuryRouteFacts, TreasuryRouteSelection } from './routing.ts';
import { selectTreasuryRoute } from './routing.ts';

export type RoutingScenario =
  | { readonly kind: 'PROVIDER_UNAVAILABLE'; readonly provider: string }
  | { readonly kind: 'DESTINATION_LIQUIDITY_REDUCED'; readonly treasuryAccountId: string; readonly availableMinor: bigint }
  | { readonly kind: 'PROVIDER_FEE_CHANGED'; readonly routeId: string; readonly feeMinor: bigint }
  | { readonly kind: 'RAIL_LATENCY_INCREASED'; readonly routeId: string; readonly settlementMs: bigint }
  | { readonly kind: 'CONCENTRATION_THRESHOLD_REACHED'; readonly provider: string }
  | { readonly kind: 'SETTLEMENT_EXPOSURE_ELEVATED'; readonly key: string };

/**
 * Read-only routing simulator. Must not mutate live treasury or payment state.
 */
export function simulateRoutingScenario(input: {
  readonly candidates: readonly EnrichedRoute[];
  readonly constraints: RouteHardConstraints;
  readonly facts: TreasuryRouteFacts;
  readonly switches: readonly KillSwitch[];
  readonly scenario: RoutingScenario;
  readonly now: UtcInstant;
}): TreasuryRouteSelection {
  const switches = [...input.switches];
  let candidates = input.candidates.map((row) => Object.freeze({ ...row }));
  if (input.scenario.kind === 'PROVIDER_UNAVAILABLE') {
    switches.push(
      freezeKillSwitch({
        killSwitchId: asKillSwitchId('sim_provider_unavailable'),
        scope: 'PROVIDER',
        target: input.scenario.provider,
        enabled: true,
        reason: 'simulator',
        createdAt: input.now,
        updatedAt: input.now,
      }),
    );
  }
  if (input.scenario.kind === 'DESTINATION_LIQUIDITY_REDUCED') {
    const treasuryAccountId = input.scenario.treasuryAccountId;
    const availableMinor = input.scenario.availableMinor;
    candidates = candidates.map((row) => {
      if (row.treasuryAccountId !== treasuryAccountId || !row.availableLiquidity) {
        return row;
      }
      return Object.freeze({
        ...row,
        availableLiquidity: Money.fromMinorUnits(availableMinor, row.availableLiquidity.currency),
      });
    });
  }
  if (input.scenario.kind === 'PROVIDER_FEE_CHANGED') {
    const routeId = input.scenario.routeId;
    const feeMinor = input.scenario.feeMinor;
    candidates = candidates.map((row) => {
      if (row.routeId !== routeId) {
        return row;
      }
      const fee = Money.fromMinorUnits(feeMinor, row.fee.currency);
      return Object.freeze({
        ...row,
        fee,
        estimatedProviderCost: fee,
        costScore: feeMinor,
      });
    });
  }
  if (input.scenario.kind === 'RAIL_LATENCY_INCREASED') {
    const routeId = input.scenario.routeId;
    const settlementMs = input.scenario.settlementMs;
    candidates = candidates.map((row) =>
      row.routeId === routeId ? Object.freeze({ ...row, estimatedSettlementMs: settlementMs }) : row,
    );
  }
  return selectTreasuryRoute(
    candidates,
    input.constraints,
    input.facts,
    switches,
    new Map(),
    new Map(),
    null,
  );
}
