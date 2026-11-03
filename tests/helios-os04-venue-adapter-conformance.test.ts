/**
 * HELIOS OS04 — multi-venue provider adapter conformance.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_OS04_VENUE_IDS,
  capabilityAvailability,
} from '../packages/provider-sdk/src/venue/index.ts';
import {
  HELIOS_OS04_VENUE_ADAPTERS,
  KRAKEN_VENUE_ADAPTER,
  assertOs04VenueRegistryComplete,
} from '../packages/external-data/src/venue-adapters/index.ts';
import { EXECUTION_PROVIDER_ROUTE_CATALOG } from '../packages/platform/src/helios/execution-routing/route-catalog.ts';
import { createKrakenVenueRoutingAdapter } from '../packages/platform/src/helios/execution-routing/adapters/kraken-venue.ts';
import {
  HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED,
  runHeliosOs04VenueConformanceSuite,
  describeVenueRoutingPosture,
} from '../packages/platform/src/helios/execution-routing/venue-conformance/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T12:00:00.000Z');

describe('HELIOS OS04 venue adapter conformance', () => {
  it('registers all reference venues with Kraken qualified and skeletons fail-closed', async () => {
    assert.equal(assertOs04VenueRegistryComplete(), true);
    assert.equal(HELIOS_OS04_VENUE_ADAPTERS.length, HELIOS_OS04_VENUE_IDS.length);

    const suite = await runHeliosOs04VenueConformanceSuite({ now: NOW, ciEnvironment: true });
    assert.equal(suite.marker, HELIOS_OS04_VENUE_ADAPTER_CONFORMANCE_QUALIFIED);
    assert.equal(suite.qualified, true);

    const kraken = suite.reports.find((row) => row.venueId === 'kraken');
    assert.ok(kraken?.adapterQualified);
    assert.ok(kraken?.checks.some((check) => check.checkId === 'market_data_probe' && check.outcome === 'PASS'));

    for (const venueId of HELIOS_OS04_VENUE_IDS) {
      if (venueId === 'kraken') {
        continue;
      }
      const report = suite.reports.find((row) => row.venueId === venueId);
      assert.ok(report?.conformancePassed, `${venueId} skeleton conformance must pass`);
      assert.equal(report?.adapterQualified, false);
      assert.equal(report?.manifest.marketData.restAvailable.availability, 'UNAVAILABLE');
    }
  });

  it('Kraken routing adapter surfaces health without live connectivity', () => {
    const adapter = createKrakenVenueRoutingAdapter();
    assert.equal(adapter.liveProviderConnected, false);
    assert.equal(adapter.productionAuthorized, false);
    const capability = adapter.describeCapability();
    assert.equal(capability.healthState, 'HEALTHY');
    const ping = adapter.ping(NOW);
    assert.equal(ping.ok, true);
  });

  it('describeVenueRoutingPosture fails closed for unknown venues', () => {
    const unknown = describeVenueRoutingPosture('unknown_venue');
    assert.equal(unknown.healthState, 'UNAVAILABLE');
    assert.equal(unknown.executionEnabled, false);

    const kraken = describeVenueRoutingPosture('kraken');
    assert.equal(kraken.marketDataOnly, true);
    assert.equal(kraken.executionEnabled, false);
    assert.equal(kraken.healthState, 'HEALTHY');
  });

  it('Kraken manifest declares REST market data without assuming sandbox', () => {
    const manifest = KRAKEN_VENUE_ADAPTER.manifest();
    assert.equal(capabilityAvailability(manifest.marketData.restAvailable), 'AVAILABLE');
    assert.equal(manifest.account.sandboxAvailability.availability, 'UNAVAILABLE');
    assert.equal(manifest.liveOrderPlacementEnabled, false);
  });

  it('execution route catalog documents OS04 venue routes without enabling trading', () => {
    const krakenRoute = EXECUTION_PROVIDER_ROUTE_CATALOG.find(
      (row) => row.routeId === 'route_venue_kraken_market_data',
    );
    assert.ok(krakenRoute);
    assert.equal(krakenRoute!.productionDisabled, true);
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });
});
