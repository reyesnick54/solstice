/**
 * HELIOS OS04 — venue adapter conformance evaluation.
 */

import type { HeliosVenueAdapterContract, VenueConformanceRunInput } from './contract.ts';
import {
  HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
  type VenueConformanceOutcome,
} from './taxonomy.ts';
import type {
  VenueCapabilityManifest,
  VenueConformanceCheck,
  VenueConformanceReport,
} from './types.ts';
import { capabilityAvailability, isFieldAvailable } from './types.ts';

function check(
  checkId: string,
  outcome: VenueConformanceOutcome,
  message: string,
): VenueConformanceCheck {
  return Object.freeze({ checkId, outcome, message });
}

function assertLiveOrdersDisabled(manifest: VenueCapabilityManifest): VenueConformanceCheck {
  if (manifest.liveOrderPlacementEnabled !== false) {
    return check('live_order_placement_disabled', 'FAIL', 'liveOrderPlacementEnabled must be false');
  }
  return check('live_order_placement_disabled', 'PASS', 'live order placement disabled');
}

function assertManifestIdentity(
  adapter: HeliosVenueAdapterContract,
  manifest: VenueCapabilityManifest,
): VenueConformanceCheck {
  if (manifest.venueId !== adapter.venueId) {
    return check(
      'manifest_venue_identity',
      'FAIL',
      `manifest venueId ${manifest.venueId} !== adapter ${adapter.venueId}`,
    );
  }
  return check('manifest_venue_identity', 'PASS', 'manifest venue identity matches adapter');
}

function assertNoAssumedCapabilities(manifest: VenueCapabilityManifest): VenueConformanceCheck {
  const assumed: string[] = [];
  const inspect = (path: string, availability: string) => {
    if (availability !== 'UNAVAILABLE' && availability !== 'AVAILABLE') {
      assumed.push(path);
    }
  };

  inspect('assetClasses', capabilityAvailability(manifest.assetClasses));
  inspect('instruments', capabilityAvailability(manifest.instruments));
  inspect('venues', capabilityAvailability(manifest.venues));
  inspect('marketData.marketDataTypes', capabilityAvailability(manifest.marketData.marketDataTypes));
  inspect('orders.orderTypes', capabilityAvailability(manifest.orders.orderTypes));

  if (assumed.length > 0) {
    return check('fail_closed_declarations', 'FAIL', `invalid availability: ${assumed.join(', ')}`);
  }
  return check('fail_closed_declarations', 'PASS', 'capabilities explicitly declared');
}

function assertReadonlyLivePolicy(
  input: VenueConformanceRunInput,
): VenueConformanceCheck {
  if (input.qualificationMode === 'readonly_live' && input.ciEnvironment) {
    return check(
      'readonly_live_ci_blocked',
      'FAIL',
      'readonly_live qualification is not permitted in CI',
    );
  }
  return check('readonly_live_ci_blocked', 'PASS', 'qualification mode permitted for environment');
}

export type VenueAdapterQualificationProfile = Readonly<{
  readonly requiresMarketDataProbe: boolean;
  readonly requiresMarketDataManifest: boolean;
  readonly minimumAvailableMarketDataTypes: number;
}>;

export const KRAKEN_OS04_QUALIFICATION_PROFILE: VenueAdapterQualificationProfile = Object.freeze({
  requiresMarketDataProbe: true,
  requiresMarketDataManifest: true,
  minimumAvailableMarketDataTypes: 2,
});

/** NATIVE05 — full native adapter qualification (all reference crypto venues). */
export const NATIVE05_VENUE_QUALIFICATION_PROFILE: VenueAdapterQualificationProfile = Object.freeze({
  requiresMarketDataProbe: true,
  requiresMarketDataManifest: true,
  minimumAvailableMarketDataTypes: 3,
});

export const SKELETON_OS04_QUALIFICATION_PROFILE: VenueAdapterQualificationProfile = Object.freeze({
  requiresMarketDataProbe: false,
  requiresMarketDataManifest: false,
  minimumAvailableMarketDataTypes: 0,
});

export function evaluateVenueManifestQualification(
  manifest: VenueCapabilityManifest,
  profile: VenueAdapterQualificationProfile,
): VenueConformanceCheck[] {
  const checks: VenueConformanceCheck[] = [];

  if (profile.requiresMarketDataManifest) {
    if (!isFieldAvailable(manifest.marketData.restAvailable) || !manifest.marketData.restAvailable.value) {
      checks.push(
        check('market_data_rest', 'FAIL', 'qualified adapter must declare REST market data AVAILABLE'),
      );
    } else {
      checks.push(check('market_data_rest', 'PASS', 'REST market data declared'));
    }

    if (!isFieldAvailable(manifest.marketData.marketDataTypes)) {
      checks.push(check('market_data_types', 'FAIL', 'market data types UNAVAILABLE'));
    } else if (
      manifest.marketData.marketDataTypes.value.length < profile.minimumAvailableMarketDataTypes
    ) {
      checks.push(
        check(
          'market_data_types',
          'FAIL',
          `insufficient declared market data types (${manifest.marketData.marketDataTypes.value.length})`,
        ),
      );
    } else {
      checks.push(check('market_data_types', 'PASS', 'market data types declared'));
    }

    if (isFieldAvailable(manifest.orders.orderTypes)) {
      checks.push(
        check(
          'orders_not_qualified_in_os04',
          'PASS',
          'order types declared without enabling live placement',
        ),
      );
    } else {
      checks.push(check('orders_not_qualified_in_os04', 'SKIPPED', 'order types remain UNAVAILABLE'));
    }
  } else {
    if (isFieldAvailable(manifest.orders.orderTypes) && manifest.orders.orderTypes.value.length > 0) {
      checks.push(
        check(
          'skeleton_no_assumed_orders',
          'FAIL',
          'skeleton adapter must not declare order types without full qualification',
        ),
      );
    } else {
      checks.push(check('skeleton_no_assumed_orders', 'PASS', 'skeleton leaves orders UNAVAILABLE'));
    }
  }

  return checks;
}

export async function runVenueAdapterConformance(
  adapter: HeliosVenueAdapterContract,
  input: VenueConformanceRunInput,
  profile: VenueAdapterQualificationProfile,
): Promise<VenueConformanceReport> {
  const manifest = adapter.manifest();
  const checks: VenueConformanceCheck[] = [
    assertLiveOrdersDisabled(manifest),
    assertManifestIdentity(adapter, manifest),
    assertNoAssumedCapabilities(manifest),
    assertReadonlyLivePolicy(input),
    ...evaluateVenueManifestQualification(manifest, profile),
  ];

  if (profile.requiresMarketDataProbe) {
    if (!adapter.probeMarketData) {
      checks.push(check('market_data_probe', 'FAIL', 'probeMarketData required for qualified adapter'));
    } else if (input.qualificationMode === 'readonly_live' && input.ciEnvironment) {
      checks.push(check('market_data_probe', 'SKIPPED', 'readonly_live blocked in CI'));
    } else {
      const symbol = isFieldAvailable(manifest.instruments)
        ? (manifest.instruments.value[0] ?? 'BTC/USD')
        : 'BTC/USD';
      const probe = await adapter.probeMarketData({
        symbol,
        qualificationMode: input.qualificationMode,
      });
      if (!probe.ok) {
        checks.push(check('market_data_probe', 'FAIL', probe.reason));
      } else {
        checks.push(check('market_data_probe', 'PASS', `observed ${probe.symbol} @ ${probe.lastPrice}`));
      }
    }
  } else {
    checks.push(check('market_data_probe', 'SKIPPED', 'skeleton adapter — probe not required'));
  }

  const conformancePassed = checks.every((row) => row.outcome !== 'FAIL');
  const adapterQualified =
    conformancePassed &&
    profile.requiresMarketDataProbe &&
    checks.some((row) => row.checkId === 'market_data_probe' && row.outcome === 'PASS');

  return Object.freeze({
    venueId: adapter.venueId,
    schemaVersion: HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    qualificationMode: input.qualificationMode,
    checks: Object.freeze(checks),
    conformancePassed,
    adapterQualified,
    manifest,
  });
}

export function runVenueAdapterConformanceSync(
  adapter: HeliosVenueAdapterContract,
  input: VenueConformanceRunInput,
  profile: VenueAdapterQualificationProfile,
): VenueConformanceReport {
  const manifest = adapter.manifest();
  const checks: VenueConformanceCheck[] = [
    assertLiveOrdersDisabled(manifest),
    assertManifestIdentity(adapter, manifest),
    assertNoAssumedCapabilities(manifest),
    assertReadonlyLivePolicy(input),
    ...evaluateVenueManifestQualification(manifest, profile),
    check('market_data_probe', 'SKIPPED', 'use async runner when probe required'),
  ];
  const conformancePassed = checks.every((row) => row.outcome !== 'FAIL');
  return Object.freeze({
    venueId: adapter.venueId,
    schemaVersion: HELIOS_VENUE_ADAPTER_SCHEMA_VERSION,
    evaluatedAt: input.evaluatedAt,
    qualificationMode: input.qualificationMode,
    checks: Object.freeze(checks),
    conformancePassed,
    adapterQualified: false,
    manifest,
  });
}
