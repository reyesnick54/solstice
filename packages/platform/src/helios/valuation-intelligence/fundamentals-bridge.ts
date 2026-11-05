/**
 * Consume OS10 SEC point-in-time fundamentals — do not recompile filings here.
 */

import type { PointInTimeFundamentalSnapshot } from '../feature-fabric/fundamental-types.ts';
import type { ValuationIssuerProfile } from './applicability.ts';
import { bindSecFundamentalsSnapshot } from './input-manifest.ts';

export const VAL01_FUNDAMENTALS_BRIDGE_VERSION = 'helios-val01-fundamentals-bridge-v1' as const;

function featureMinor(
  snapshot: PointInTimeFundamentalSnapshot,
  featureId: keyof PointInTimeFundamentalSnapshot['features'],
): bigint | null {
  const row = snapshot.features[featureId];
  if (!row?.supported || row.knowableAt === null) {
    return null;
  }
  const evalMs = Date.parse(snapshot.evaluationTimeUtc);
  const knowMs = Date.parse(row.knowableAt);
  if (!Number.isFinite(evalMs) || !Number.isFinite(knowMs) || knowMs > evalMs) {
    return null;
  }
  return row.valueMinor;
}

export function issuerProfileFromFundamentals(
  snapshot: PointInTimeFundamentalSnapshot,
): ValuationIssuerProfile {
  const revenue = featureMinor(snapshot, 'revenue');
  const fcf = featureMinor(snapshot, 'fcf');
  const cash = featureMinor(snapshot, 'cash');
  const debt = featureMinor(snapshot, 'debt');
  const shareCount = featureMinor(snapshot, 'share_count');

  const isPreRevenue = revenue === null || revenue <= 0n;
  const hasPositiveOperatingCashFlow = fcf !== null && fcf > 0n;

  return Object.freeze({
    canonicalEntityId: snapshot.canonicalEntityId,
    sector: null,
    reportingSegments: 1,
    paysRegularDividend: false,
    hasPositiveOperatingCashFlow,
    hasMeaningfulBookEquity: cash !== null && cash > 0n,
    hasMarketPrice: false,
    hasPeerUniverse: false,
    isPreRevenue,
    hasLeverageInputs: debt !== null && shareCount !== null,
  });
}

export function attachSecFundamentalsToValuationInput(input: {
  readonly snapshot: PointInTimeFundamentalSnapshot;
}) {
  return Object.freeze({
    bridgeVersion: VAL01_FUNDAMENTALS_BRIDGE_VERSION,
    binding: bindSecFundamentalsSnapshot(input),
    issuerProfile: issuerProfileFromFundamentals(input.snapshot),
    grantsExecutionAuthority: false as const,
  });
}
