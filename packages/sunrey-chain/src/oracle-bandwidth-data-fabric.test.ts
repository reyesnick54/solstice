import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { convertExact } from './units/convert.ts';
import { FACT_SCHEMAS, BANDWIDTH_USAGE_SCHEMA_V1, BANDWIDTH_USAGE_SCHEMA_V2, schemaAllowsUnit } from './oracle/schemas.ts';
import {
  BANDWIDTH_FACT_AUTO_MINTS_MOONREY,
  CAPACITY_EQUALS_REALIZED_USAGE,
  DATA_RATE_EQUALS_DATA_VOLUME,
  PACKET_PAYLOAD_STORED,
  REAL_PROVIDER_CONTACTED,
  USER_BROWSING_HISTORY_STORED,
  bandwidthCertificationDoesNotMint,
  bandwidthEventId,
  bandwidthUtilization,
  capacityDoesNotEqualUsage,
  capacityRateFixture,
  certifyBandwidthObservation,
  corroboratingSources,
  deliveredBytesFixture,
  distinctNetworkStages,
  economicRecordOmitsPayloads,
  evaluateBandwidthAdversary,
  evaluateBandwidthIndependence,
  gbPerSecondPresentedAsGbFixture,
  grossBytesFixture,
  ingestBandwidthObservation,
  missingDurationFixture,
  originStageFixture,
  packetPayloadFixture,
  projectBandwidthMetadata,
  rateOverTimeFixture,
  rateTimesDuration,
  retainTransferSemantics,
  retransmissionIsNotNewOutput,
  sameBandwidthTransfer,
  SANDBOX_END,
  SANDBOX_NOW,
  SANDBOX_START,
  sourceQuantityOf,
  subscriberPiiFixture,
  tbUsageFixture,
  transitStageFixture,
  transferredBytesFixture,
  urlFieldFixture,
} from './oracle/production/provider-families/bandwidth/index.ts';

describe('CHUNK-136 bandwidth network economic data fabric', () => {
  it('1. records bandwidth capacity as a DATA_RATE', () => {
    const ingested = ingestBandwidthObservation(capacityRateFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(ingested.value.factType, 'BANDWIDTH_CAPACITY');
    assert.equal(ingested.value.dimension, 'DATA_RATE');
    assert.equal(ingested.value.canonicalUnit, 'GB_s');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 2n);
    assert.equal(ingested.value.derivedVolume, null);
    assert.equal(DATA_RATE_EQUALS_DATA_VOLUME, false);
  });

  it('2. records transferred GB usage as DATA_VOLUME', () => {
    const ingested = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(ingested.value.factType, 'BANDWIDTH_USAGE');
    assert.equal(ingested.value.dimension, 'DATA_VOLUME');
    assert.equal(ingested.value.canonicalUnit, 'GB');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 20n);
    assert.equal(schemaAllowsUnit('BANDWIDTH_USAGE', 'GB'), true);
    assert.equal(BANDWIDTH_USAGE_SCHEMA_V2.quantityKind, 'DATA_VOLUME');
  });

  it('3. normalizes TB usage onto GB exactly', () => {
    const ingested = ingestBandwidthObservation(tbUsageFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(ingested.value.canonicalUnit, 'GB');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 3_000n);
    assert.equal(schemaAllowsUnit('BANDWIDTH_USAGE', 'TB'), true);
  });

  it('4. keeps GB/s as a rate on capacity and V1 usage schemas', () => {
    const capacity = ingestBandwidthObservation(capacityRateFixture(), SANDBOX_NOW);
    assert.equal(capacity.ok, true);
    if (capacity.ok) {
      assert.equal(capacity.value.quantityKind, 'DATA_RATE');
      assert.equal(capacity.value.canonicalUnit, 'GB_s');
    }
    assert.deepEqual([...BANDWIDTH_USAGE_SCHEMA_V1.allowedUnits], ['GB_s']);
    assert.equal(FACT_SCHEMAS.BANDWIDTH_USAGE.allowedUnits.includes('GB_s'), true);
    const conversion = convertExact({
      source: { mantissa: 2n, scale: 0, numerator: 1n, denominator: 1n, unitId: 'GB_s' },
      targetUnitId: 'GB',
    });
    assert.equal(conversion.ok, false);
  });

  it('5. converts rate × duration into exact transferred volume', () => {
    const ingested = ingestBandwidthObservation(rateOverTimeFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(ingested.value.sourceQuantity.unitId, 'GB_s');
    assert.equal(ingested.value.canonicalUnit, 'GB');
    assert.equal(ingested.value.canonicalQuantity.mantissa, 20n);
    const source = sourceQuantityOf(rateOverTimeFixture());
    if (!source.ok) {
      throw new Error('expected ok');
    }
    const derived = rateTimesDuration({ rate: source.value, durationSeconds: 10n, factType: 'BANDWIDTH_USAGE' });
    assert.equal(derived.ok, true);
    if (derived.ok) {
      assert.equal(derived.value.volume.mantissa, 20n);
      assert.equal(derived.value.volume.unitId, 'GB');
    }
  });

  it('6. rejects rate → volume without duration', () => {
    const ingested = ingestBandwidthObservation(missingDurationFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code === 'DURATION_REQUIRED' || ingested.error.code === 'IMPOSSIBLE_TIMESTAMP_WINDOW', true);
    }
    const source = sourceQuantityOf(rateOverTimeFixture());
    if (!source.ok) {
      throw new Error('expected ok');
    }
    const refused = rateTimesDuration({ rate: source.value, durationSeconds: null, factType: 'BANDWIDTH_USAGE' });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.error.code, 'DURATION_REQUIRED');
    }
  });

  it('7. treats capacity as distinct from realized usage', () => {
    const capacity = ingestBandwidthObservation(capacityRateFixture(), SANDBOX_NOW);
    const usage = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    assert.equal(capacity.ok && usage.ok, true);
    if (!capacity.ok || !usage.ok) {
      throw new Error('expected ok');
    }
    assert.equal(capacityDoesNotEqualUsage(capacity.value.factType, usage.value.factType), true);
    assert.equal(CAPACITY_EQUALS_REALIZED_USAGE, false);
    assert.notEqual(capacity.value.dimension, usage.value.dimension);
    const adversary = evaluateBandwidthAdversary('CAPACITY_REPORTED_AS_USAGE');
    assert.equal(adversary.ok, false);
  });

  it('8. retains GROSS_NETWORK_BYTES semantics', () => {
    const ingested = ingestBandwidthObservation(grossBytesFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(retainTransferSemantics(ingested.value.transferSemantics!), 'GROSS_NETWORK_BYTES');
    assert.equal(ingested.value.grossEqualsDelivered, false);
  });

  it('9. retains DELIVERED_BYTES semantics', () => {
    const ingested = ingestBandwidthObservation(deliveredBytesFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    assert.equal(retainTransferSemantics(ingested.value.transferSemantics!), 'DELIVERED_BYTES');
    assert.notEqual(ingested.value.transferSemantics, 'GROSS_NETWORK_BYTES');
  });

  it('10. does not treat retransmission as new productive output', () => {
    const gross = ingestBandwidthObservation(grossBytesFixture(), SANDBOX_NOW);
    const delivered = ingestBandwidthObservation(deliveredBytesFixture(), SANDBOX_NOW);
    assert.equal(gross.ok && delivered.ok, true);
    if (!gross.ok || !delivered.ok) {
      throw new Error('expected ok');
    }
    assert.equal(retransmissionIsNotNewOutput(grossBytesFixture()), true);
    assert.equal(gross.value.transferSemantics, 'GROSS_NETWORK_BYTES');
    assert.equal(delivered.value.transferSemantics, 'DELIVERED_BYTES');
    assert.equal(gross.value.grossEqualsDelivered, false);
  });

  it('11. clusters duplicate multi-source observations of one transfer', () => {
    const sources = corroboratingSources();
    assert.equal(sameBandwidthTransfer(sources[0]!, sources[1]!), true);
    assert.equal(sameBandwidthTransfer(sources[1]!, sources[2]!), true);
    assert.equal(bandwidthEventId(sources[0]!), bandwidthEventId(sources[2]!));
  });

  it('12. keeps distinct transit stages as separate services', () => {
    const origin = originStageFixture();
    const transit = transitStageFixture();
    assert.equal(distinctNetworkStages(origin.networkStage, transit.networkStage), true);
    assert.equal(sameBandwidthTransfer(origin, transit), false);
    assert.notEqual(bandwidthEventId(origin), bandwidthEventId(transit));
  });

  it('13. refuses subscriber PII on economic evidence', () => {
    const ingested = ingestBandwidthObservation(subscriberPiiFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'SUBSCRIBER_PII_FORBIDDEN');
    }
  });

  it('14. refuses packet content on economic evidence', () => {
    const ingested = ingestBandwidthObservation(packetPayloadFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'PACKET_PAYLOAD_FORBIDDEN');
    }
    const clean = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    assert.equal(clean.ok, true);
    if (clean.ok) {
      assert.equal(clean.value.packetPayloadStored, false);
      assert.equal(PACKET_PAYLOAD_STORED, false);
      assert.equal(economicRecordOmitsPayloads(clean.value), true);
    }
  });

  it('15. refuses URL fields on economic evidence', () => {
    const ingested = ingestBandwidthObservation(urlFieldFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, false);
    if (!ingested.ok) {
      assert.equal(ingested.error.code, 'URL_FIELD_FORBIDDEN');
    }
    assert.equal(USER_BROWSING_HISTORY_STORED, false);
  });

  it('16. enforces utilization dimensional safety', () => {
    const usage = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    const capacity = ingestBandwidthObservation(capacityRateFixture(), SANDBOX_NOW);
    assert.equal(usage.ok && capacity.ok, true);
    if (!usage.ok || !capacity.ok) {
      throw new Error('expected ok');
    }
    const unsafe = bandwidthUtilization({
      actualVolume: usage.value.canonicalQuantity,
      capacityRate: capacity.value.canonicalQuantity,
      durationSeconds: null,
      actualStart: SANDBOX_START,
      actualEnd: SANDBOX_END,
      capacityStart: SANDBOX_START,
      capacityEnd: SANDBOX_END,
      actualStage: 'TRANSIT_NETWORK',
      capacityStage: 'TRANSIT_NETWORK',
      actualRegion: 'sandbox-east',
      capacityRegion: 'sandbox-east',
    });
    assert.equal(unsafe.ok, false);
    if (!unsafe.ok) {
      assert.equal(unsafe.error.code, 'DURATION_REQUIRED');
    }
    const safe = bandwidthUtilization({
      actualVolume: usage.value.canonicalQuantity,
      capacityRate: capacity.value.canonicalQuantity,
      durationSeconds: 10n,
      actualStart: SANDBOX_START,
      actualEnd: SANDBOX_END,
      capacityStart: SANDBOX_START,
      capacityEnd: SANDBOX_END,
      actualStage: 'TRANSIT_NETWORK',
      capacityStage: 'TRANSIT_NETWORK',
      actualRegion: 'sandbox-east',
      capacityRegion: 'sandbox-east',
    });
    assert.equal(safe.ok, true);
    if (safe.ok) {
      assert.equal(safe.value.utilizationNumerator, 20n);
      assert.equal(safe.value.utilizationDenominator, 20n);
    }
  });

  it('17. rejects a same-controller fake quorum', () => {
    const independence = evaluateBandwidthIndependence(transferredBytesFixture());
    assert.equal(independence.fakeQuorum, true);
    assert.equal(independence.verdict, 'FAIL');
    const adversary = evaluateBandwidthAdversary('SAME_CONTROLLER_FAKE_QUORUM');
    assert.equal(adversary.ok, false);
    if (!adversary.ok) {
      assert.equal(adversary.error.code, 'SAME_CONTROLLER_FAKE_QUORUM');
    }
  });

  it('18. never contacts a real provider', () => {
    assert.equal(REAL_PROVIDER_CONTACTED, false);
    const ingested = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.realProviderContacted, false);
    }
  });

  it('19. bandwidth facts cannot auto-mint MoonRey', () => {
    const ingested = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    assert.equal(BANDWIDTH_FACT_AUTO_MINTS_MOONREY, false);
    assert.equal(ingested.ok, true);
    if (ingested.ok) {
      assert.equal(ingested.value.bandwidthFactAutoMintsMoonRey, false);
    }
  });

  it('20. certification cannot mint MoonRey', () => {
    const certified = certifyBandwidthObservation(rateOverTimeFixture(), SANDBOX_NOW);
    assert.equal(bandwidthCertificationDoesNotMint(), false);
    assert.equal(certified.record.mintsMoonRey, false);
    assert.equal(certified.record.productionAuthorized, false);
  });

  it('refuses GB/s presented as GB and projects metadata only', () => {
    const spoofed = ingestBandwidthObservation(gbPerSecondPresentedAsGbFixture(), SANDBOX_NOW);
    assert.equal(spoofed.ok, false);
    if (!spoofed.ok) {
      assert.equal(spoofed.error.code, 'RATE_PRESENTED_AS_VOLUME');
    }
    const ingested = ingestBandwidthObservation(transferredBytesFixture(), SANDBOX_NOW);
    if (!ingested.ok) {
      throw new Error('expected ok');
    }
    const projected = projectBandwidthMetadata(new EconomicAssetRegistry(), ingested.value);
    assert.equal(projected.ok, true);
    if (projected.ok) {
      assert.equal(JSON.stringify(projected.value).toLowerCase().includes('https://'), false);
      assert.equal(projected.value.economicCategory, 'BANDWIDTH_COMMUNICATIONS');
    }
  });
});
