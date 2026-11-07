/**
 * HELIOS MD09 — multi-venue crypto real-time market data research fabric.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { HELIOS_OS04_VENUE_IDS } from '../packages/provider-sdk/src/venue/index.ts';
import { HELIOS_NATIVE_VENUE_ADAPTERS, bindAllMd09VenueResearchAdapters } from '../packages/external-data/src/venue-adapters/index.ts';
import {
  HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED,
  Md09CryptoMarketFabric,
  applyMd09SequenceStep,
  initialMd09SequenceIntegrity,
  runMd09CryptoMarketQualification,
} from '../packages/platform/src/helios/market-data/md09/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { join } from 'node:path';

const NOW = asUtcInstant('2026-10-15T12:00:00.000Z');
const ROOT = join(import.meta.dirname, '..');

describe('HELIOS MD09 crypto market fabric', () => {
  it('architecture guard: md09 module stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('market-data/md09'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('binds all eight reference venues into research planes without execution', () => {
    const research = bindAllMd09VenueResearchAdapters(HELIOS_NATIVE_VENUE_ADAPTERS);
    assert.equal(research.length, HELIOS_OS04_VENUE_IDS.length);
    for (const row of research) {
      assert.equal(row.liveExecutionEnabled, false);
      assert.equal(row.liveOrderPlacementEnabled, false);
      assert.ok(row.referenceStream.length >= 2, `${row.venueId} must emit continuous fixture stream`);
    }
  });

  it('detects sequence gaps for monotonic venues but not for Hyperliquid', () => {
    let integrity = initialMd09SequenceIntegrity();
    const scheme = {
      venueId: 'binance' as const,
      sequenceField: 'update_id' as const,
      snapshotAnchored: true,
      checksumSupported: true,
      sequencePolicy: Object.freeze({
        strictMonotonic: true,
        dedupeDuplicates: true,
        resyncOnGap: true,
      }),
    };
    integrity = applyMd09SequenceStep(integrity, scheme, 100);
    integrity = applyMd09SequenceStep(integrity, scheme, 101);
    integrity = applyMd09SequenceStep(integrity, scheme, 103);
    assert.equal(integrity.gapDetected, true);
    assert.equal(integrity.resyncRequired, true);

    const hlScheme = {
      venueId: 'hyperliquid' as const,
      sequenceField: 'none' as const,
      snapshotAnchored: false,
      checksumSupported: false,
      sequencePolicy: scheme.sequencePolicy,
    };
    let hlIntegrity = initialMd09SequenceIntegrity();
    hlIntegrity = applyMd09SequenceStep(hlIntegrity, hlScheme, null);
    assert.equal(hlIntegrity.gapDetected, false);
  });

  it('computes cross-venue best bid/ask without claiming executable opportunity', () => {
    const fabric = new Md09CryptoMarketFabric();
    const snapshot = fabric.refresh(NOW);
    assert.ok(snapshot.crossVenue.bestExecutableBid);
    assert.ok(snapshot.crossVenue.bestExecutableAsk);
    assert.ok(snapshot.crossVenue.crossVenueSpread);
    assert.equal(snapshot.crossVenue.executableOpportunity.claimed, false);
    assert.ok(snapshot.observations.length > HELIOS_OS04_VENUE_IDS.length);
  });

  it('HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED when engineering checks pass', () => {
    const result = runMd09CryptoMarketQualification({ nowUtc: NOW });
    assert.equal(
      result.marker,
      HELIOS_MD09_CRYPTO_MARKET_DATA_QUALIFIED,
      result.blockers.join('; '),
    );
  });
});
