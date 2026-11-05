/**
 * Consume AAF10 macro intelligence yield / rate observations for discount inputs.
 */

import type { MacroOfficialReleaseEvent } from '../feature-fabric/macro-intelligence/types.ts';
import type { MacroYieldRateBinding } from './input-manifest.ts';

export const VAL01_MACRO_BRIDGE_VERSION = 'helios-val01-macro-yield-bridge-v1' as const;

const YIELD_SERIES = new Set(['treasury_yield_10y', 'treasury_yield_2y', 'policy_rate']);

export function macroReleaseToYieldBinding(release: MacroOfficialReleaseEvent): MacroYieldRateBinding | null {
  if (!YIELD_SERIES.has(release.seriesKey)) {
    return null;
  }
  return Object.freeze({
    source: 'macro_intelligence_yield_rates',
    seriesKey: release.seriesKey,
    observationRef: release.eventId,
    valueMinor: release.initialReportedValue.valueMinor,
    knowableAt: release.knowableAt,
    grantsExecutionAuthority: false,
  });
}

export function collectMacroYieldBindings(
  releases: readonly MacroOfficialReleaseEvent[],
): readonly MacroYieldRateBinding[] {
  return Object.freeze(
    releases
      .map((row) => macroReleaseToYieldBinding(row))
      .filter((row): row is MacroYieldRateBinding => row !== null),
  );
}
