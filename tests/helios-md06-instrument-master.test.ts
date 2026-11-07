/**
 * HELIOS Market Data MD06 — temporal instrument master and reference data.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  CORPORATE_ACTION_KINDS,
  createInstrumentMasterFabric,
  evaluateMd06InstrumentMasterQualification,
  HELIOS_MD06,
  HELIOS_MD06_AUTHORITY,
  HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED,
  HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
  INSTRUMENT_IDENTIFIER_SYSTEMS,
  md06ReferenceSeedBundle,
  MD06_FIXTURE_META_IDENTITY,
  MD06_TEMPORAL_ENTITY_KINDS,
  MD06_TEMPORAL_RELATIONSHIP_TYPES,
  rejectTickerOnlyIdentity,
  runMd06SelfChecks,
} from '../packages/platform/src/helios/market-data-intelligence/index.ts';
import { createTemporalEntityGraphStore } from '../packages/platform/src/helios/feature-fabric/entity-resolution/graph-store.ts';
import {
  TEMPORAL_ENTITY_KINDS,
  TEMPORAL_RELATIONSHIP_TYPES,
} from '../packages/platform/src/helios/feature-fabric/entity-resolution/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS MD06 instrument master', () => {
  it('exports schema, chunk marker, and reference-only authority', () => {
    assert.equal(HELIOS_MD06, 'HELIOS_MD06');
    assert.equal(HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA, 'sunrey.helios.market-data.instrument-master.v1');
    assert.equal(HELIOS_MD06_AUTHORITY, 'REFERENCE_ONLY');
    assert.equal(CORPORATE_ACTION_KINDS.length, 9);
    assert.equal(INSTRUMENT_IDENTIFIER_SYSTEMS.includes('figi'), true);
    assert.equal(INSTRUMENT_IDENTIFIER_SYSTEMS.includes('ticker'), true);
  });

  it('extends canonical temporal entity graph kinds and relations', () => {
    for (const kind of MD06_TEMPORAL_ENTITY_KINDS) {
      assert.ok((TEMPORAL_ENTITY_KINDS as readonly string[]).includes(kind), kind);
    }
    for (const rel of MD06_TEMPORAL_RELATIONSHIP_TYPES) {
      assert.ok((TEMPORAL_RELATIONSHIP_TYPES as readonly string[]).includes(rel), rel);
    }
  });

  it('never uses ticker as permanent identity', () => {
    assert.equal(rejectTickerOnlyIdentity('META'), null);
    assert.notEqual(MD06_FIXTURE_META_IDENTITY, 'META');
  });

  it('preserves identity across FB → META symbol change', () => {
    const graph = createTemporalEntityGraphStore();
    const fabric = createInstrumentMasterFabric({ graph, seed: md06ReferenceSeedBundle() });
    const fb = fabric.store.resolveListingAt({
      ticker: 'FB',
      mic: 'XNAS',
      asOf: asUtcInstant('2018-01-01T00:00:00.000Z'),
      knowableAtCutoff: asUtcInstant('2018-01-02T00:00:00.000Z'),
    });
    const meta = fabric.store.resolveListingAt({
      ticker: 'META',
      mic: 'XNAS',
      asOf: asUtcInstant('2023-01-01T00:00:00.000Z'),
      knowableAtCutoff: asUtcInstant('2023-01-02T00:00:00.000Z'),
    });
    assert.equal(fb.instrumentIdentityId, MD06_FIXTURE_META_IDENTITY);
    assert.equal(meta.instrumentIdentityId, MD06_FIXTURE_META_IDENTITY);
    assert.ok(graph.listNodes().some((node) => node.kind === 'VENUE_INSTRUMENT'));
    assert.ok(graph.listNodes().some((node) => node.kind === 'TRADING_SESSION'));
  });

  it('keeps raw prices immutable while deriving adjusted research series', () => {
    const fabric = createInstrumentMasterFabric({ seed: md06ReferenceSeedBundle() });
    const nvdaId = fabric.store.snapshot().identities.find((row) => row.displayName.includes('NVIDIA'))!
      .instrumentIdentityId;
    const before = [...fabric.store.listRawPrices(nvdaId)];
    const adjusted = fabric.adjustedResearchSeries(nvdaId, asUtcInstant('2024-06-15T00:00:00.000Z'));
    fabric.store.appendRawPrice({
      observationId: 'raw:nvda:extra',
      instrumentIdentityId: nvdaId,
      seriesKind: 'RAW',
      eventTime: asUtcInstant('2024-06-12T00:00:00.000Z'),
      knowableAt: asUtcInstant('2024-06-12T01:00:00.000Z'),
      closeMinor: 13_000n,
      volume: 1n,
      immutable: true,
    });
    const after = fabric.store.listRawPrices(nvdaId);
    assert.equal(after.length, before.length + 1);
    assert.deepEqual(
      after.slice(0, before.length).map((row) => row.closeMinor),
      before.map((row) => row.closeMinor),
    );
    assert.equal(adjusted.seriesKind, 'ADJUSTED_RESEARCH');
    assert.notEqual(adjusted.points[1]?.closeMinor, 12_000n);
  });

  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const md06 = findings.filter((row) => row.file.includes('market-data-intelligence'));
    assert.deepEqual(md06, []);
  });

  it('qualifies with HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED', () => {
    const checks = runMd06SelfChecks();
    const qualification = evaluateMd06InstrumentMasterQualification(checks);
    assert.equal(qualification.marker, HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED, qualification.blockers.join('; '));
  });
});
