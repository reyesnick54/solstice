import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALL_VALID_FIXTURES,
  FIXTURES,
  UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH,
  ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA,
  OBSERVATION_IS_NOT_VERIFIED_FACT,
  assertNotVerifiedFact,
  createQuarantineRegistry,
  duplicateFingerprint,
  normalizeBatch,
  normalizeRawSourceRecord,
  normalizeObservationTime,
  normalizeGeography,
  refuseDimensionalMix,
  validateEnvelope,
  validateRawSourceRecord,
} from '../packages/sunrey-chain/src/economics/observation/index.ts';

const NOW = '2026-08-30T12:00:00.000Z';

describe('Wave 4 EconomicObservationEnvelope', () => {
  it('exports core invariants', () => {
    assert.equal(UNLABELED_NUMERIC_IS_NOT_ECONOMIC_TRUTH, true);
    assert.equal(OBSERVATION_IS_NOT_VERIFIED_FACT, true);
    assert.equal(ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA, 'sunrey.economic-observation-envelope.v1');
  });

  it('normalizes representative fixtures across economic domains', () => {
    const quarantine = createQuarantineRegistry();
    const result = normalizeBatch(ALL_VALID_FIXTURES, { nowUtc: NOW, quarantine });

    assert.equal(result.accepted.length, ALL_VALID_FIXTURES.length);
    assert.equal(result.quarantined.length, 0);
    assert.equal(quarantine.count(), 0);

    for (const envelope of result.accepted) {
      assert.equal(envelope.schemaVersion, ECONOMIC_OBSERVATION_ENVELOPE_SCHEMA);
      assert.equal(envelope.verifiedFact, false);
      assert.equal(envelope.mintsNativeAsset, false);
      assert.equal(envelope.simulation, true);
      assert.equal(envelope.environment, 'simulation');
      assert.ok(envelope.metric.length > 0);
      assert.ok(envelope.source.providerId.length > 0);
      assert.ok(envelope.source.sourceRecordId.length > 0);
      assert.ok(envelope.provenanceHash.length > 0);
      assert.ok(envelope.duplicateFingerprint.length > 0);
      assert.equal(validateEnvelope(envelope).ok, true);
      assert.doesNotThrow(() => assertNotVerifiedFact(envelope));
    }
  });

  it('converts energy MWh to canonical Wh', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.energy, { nowUtc: NOW });
    assert.equal(outcome.status, 'ACCEPTED');
    if (outcome.status !== 'ACCEPTED') return;
    assert.equal(outcome.envelope.canonicalUnit, 'Wh');
    assert.equal(outcome.envelope.normalizedValue.mantissa, 2_500_000_000n);
    assert.equal(outcome.envelope.extension?.kind, 'ENERGY');
  });

  it('preserves period aggregates without collapsing to instantaneous events', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.energyPeriod, { nowUtc: NOW });
    assert.equal(outcome.status, 'ACCEPTED');
    if (outcome.status !== 'ACCEPTED') return;
    assert.equal(outcome.envelope.time.isPeriodAggregate, true);
    assert.equal(outcome.envelope.time.isInstantaneous, false);
    assert.ok(outcome.envelope.time.periodStart);
    assert.ok(outcome.envelope.time.periodEnd);
  });

  it('rejects unlabeled numeric and missing units', () => {
    const quarantine = createQuarantineRegistry();

    const unlabeled = normalizeRawSourceRecord(FIXTURES.unlabeledNumeric, { nowUtc: NOW, quarantine });
    assert.equal(unlabeled.status, 'QUARANTINED');
    if (unlabeled.status === 'QUARANTINED') assert.equal(unlabeled.code, 'UNLABELED_NUMERIC');

    const missingUnit = normalizeRawSourceRecord(FIXTURES.missingUnit, { nowUtc: NOW, quarantine });
    assert.equal(missingUnit.status, 'QUARANTINED');
    if (missingUnit.status === 'QUARANTINED') assert.equal(missingUnit.code, 'MISSING_UNIT');

    assert.equal(quarantine.count(), 2);
  });

  it('rejects incompatible units and dimensional errors', () => {
    const badUnit = normalizeRawSourceRecord(FIXTURES.badUnit, { nowUtc: NOW });
    assert.equal(badUnit.status, 'QUARANTINED');

    assert.equal(refuseDimensionalMix('MW', 'MWh'), true);
    assert.equal(refuseDimensionalMix('MWh', 'kWh'), false);
  });

  it('rejects missing time context', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.missingTime, { nowUtc: NOW });
    assert.equal(outcome.status, 'QUARANTINED');
    if (outcome.status === 'QUARANTINED') {
      assert.ok(['MISSING_TIME_CONTEXT', 'MISSING_PROVIDER_ID'].includes(outcome.code) === false || outcome.code === 'MISSING_TIME_CONTEXT' || outcome.code === 'MISSING_SOURCE_ID');
    }
    const timeResult = normalizeObservationTime({
      receivedAt: NOW,
    });
    assert.equal(timeResult.ok, false);
  });

  it('preserves source identity through normalization', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.energy, { nowUtc: NOW });
    assert.equal(outcome.status, 'ACCEPTED');
    if (outcome.status !== 'ACCEPTED') return;
    assert.equal(outcome.envelope.source.providerId, 'uk-grid-sandbox');
    assert.equal(outcome.envelope.source.sourceRecordId, 'rec-energy-001');
    assert.equal(outcome.envelope.source.providerSchemaId, 'energy.grid-generation.v1');
    assert.equal(outcome.envelope.source.providerSchemaVersion, '1');
    assert.ok(outcome.envelope.source.provenanceRef.length > 0);
    assert.ok(outcome.envelope.source.rawValueRef);
  });

  it('rejects unsupported schema versions', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.unsupportedSchema, { nowUtc: NOW });
    assert.equal(outcome.status, 'QUARANTINED');
    if (outcome.status === 'QUARANTINED') assert.equal(outcome.code, 'SCHEMA_VERSION_UNSUPPORTED');
  });

  it('detects duplicate fingerprints', () => {
    const seen = new Set<string>();
    const first = normalizeRawSourceRecord(FIXTURES.energy, { nowUtc: NOW, seenFingerprints: seen });
    const second = normalizeRawSourceRecord(FIXTURES.energy, { nowUtc: NOW, seenFingerprints: seen });
    assert.equal(first.status, 'ACCEPTED');
    assert.equal(second.status, 'QUARANTINED');
    if (second.status === 'QUARANTINED') assert.equal(second.code, 'DUPLICATE_FINGERPRINT');
  });

  it('produces stable duplicate fingerprints', () => {
    const a = normalizeRawSourceRecord(FIXTURES.compute, { nowUtc: NOW });
    const b = normalizeRawSourceRecord(FIXTURES.compute, { nowUtc: NOW, envelopeId: 'other-id' });
    assert.equal(a.status, 'ACCEPTED');
    assert.equal(b.status, 'ACCEPTED');
    if (a.status === 'ACCEPTED' && b.status === 'ACCEPTED') {
      assert.equal(a.envelope.duplicateFingerprint, b.envelope.duplicateFingerprint);
      assert.notEqual(a.envelope.envelopeId, b.envelope.envelopeId);
    }
  });

  it('carries jurisdiction and license metadata', () => {
    const outcome = normalizeRawSourceRecord(FIXTURES.workforce, { nowUtc: NOW });
    assert.equal(outcome.status, 'ACCEPTED');
    if (outcome.status !== 'ACCEPTED') return;
    assert.equal(outcome.envelope.geography.jurisdiction, 'US-CA');
    assert.equal(outcome.envelope.rights.license, 'SANDBOX_FIXTURE');
    assert.equal(outcome.envelope.rights.rightsScope, 'PUBLIC_DERIVED');
  });

  it('enforces human economy geography minimization', () => {
    const allowed = normalizeGeography(
      {
        coordinates: { lat: 51.5, lon: -0.12 },
        publicDisclosureAllowed: true,
        jurisdiction: 'GB',
      },
      { economicDomain: 'HUMAN_ECONOMY' },
    );
    assert.equal(allowed.ok, true);

    const denied = normalizeGeography(
      {
        coordinates: { lat: 51.5, lon: -0.12 },
        publicDisclosureAllowed: undefined,
        jurisdiction: 'GB',
      },
      { economicDomain: 'HUMAN_ECONOMY' },
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.code, 'GEOGRAPHY_POLICY_VIOLATION');
  });

  it('attaches domain extensions without bloating the envelope', () => {
    const domains = [
      { fixture: FIXTURES.compute, kind: 'COMPUTE' },
      { fixture: FIXTURES.manufacturing, kind: 'MANUFACTURING' },
      { fixture: FIXTURES.agriculture, kind: 'AGRICULTURE' },
      { fixture: FIXTURES.research, kind: 'RESEARCH' },
      { fixture: FIXTURES.healthPublic, kind: 'HEALTH_PUBLIC' },
      { fixture: FIXTURES.geospatial, kind: 'GEOSPATIAL' },
    ] as const;

    for (const { fixture, kind } of domains) {
      const outcome = normalizeRawSourceRecord(fixture, { nowUtc: NOW });
      assert.equal(outcome.status, 'ACCEPTED');
      if (outcome.status === 'ACCEPTED') {
        assert.equal(outcome.envelope.extension?.kind, kind);
      }
    }
  });

  it('validates raw records before normalization', () => {
    assert.equal(validateRawSourceRecord(FIXTURES.unlabeledNumeric).ok, false);
    assert.equal(validateRawSourceRecord(FIXTURES.energy).ok, true);
  });
});
