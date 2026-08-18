/**
 * Immediate genesis supply audit. Zero-allocation genesis is a
 * supported approved configuration. Tickers are never invented.
 */

import { totalsOf } from '../mainnet/allocation.ts';
import { verifyGenesisAllocationManifest } from '../economics/genesis.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import type { GenesisSupplyAudit, ProductionLaunchPlan } from './types.ts';

export function auditGenesisSupply(plan: ProductionLaunchPlan): GenesisSupplyAudit {
  const totals = totalsOf(plan.allocation.lines);
  const verification = verifyGenesisAllocationManifest(plan.allocation);
  const sunrey = totals.SUNREY_COIN;
  const moonrey = totals.MOONREY_COIN;
  const zeroCompatible = sunrey === 0n && moonrey === 0n;
  if (NATIVE_ASSET_TICKER_STATUS !== 'NOT_ASSIGNED' || plan.tickerStatus !== 'NOT_ASSIGNED') {
    throw new TypeError('TICKER_INVENTION_FORBIDDEN');
  }
  return Object.freeze({
    sunreyGenesisQuantity: sunrey,
    moonreyGenesisQuantity: moonrey,
    allocationManifestHash: plan.allocationManifestHash,
    nativeSupplyEquationHolds: verification.ok,
    hiddenAllocation: false,
    zeroSupplyCompatible: zeroCompatible,
    tickerStatus: 'NOT_ASSIGNED',
    ok: verification.ok && plan.allocation.hiddenPremint === false,
  });
}
