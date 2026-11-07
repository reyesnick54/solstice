/**
 * HELIOS MARKET DATA MD06 — temporal instrument master and reference data.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MD06,
  HELIOS_MD06_AUTHORITY,
  HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED,
  HELIOS_MD06_INSTRUMENT_MASTER_SCHEMA,
  MD06_TEMPORAL_ENTITY_KINDS,
  MD06_TEMPORAL_RELATIONSHIP_TYPES,
  assertTickerNotPermanentIdentity,
  createHeliosMd06InstrumentMasterFabric,
  createInstrumentMasterStore,
  runMd06QualificationHarness,
  seedMd06ReferenceInstrumentMaster,
} from '../packages/platform/src/helios/market-data/index.ts';
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
  });

  it('extends canonical temporal entity graph kinds and relations', () => {
    for (const kind of MD06_TEMPORAL_ENTITY_KINDS) {
      assert.ok((TEMPORAL_ENTITY_KINDS as readonly string[]).includes(kind), kind);
    }
    for (const rel of MD06_TEMPORAL_RELATIONSHIP_TYPES) {
      assert.ok((TEMPORAL_RELATIONSHIP_TYPES as readonly string[]).includes(rel), rel);
    }
  });

  it('rejects ticker as permanent instrument identity', () => {
    assert.throws(() => assertTickerNotPermanentIdentity('TICKER'), /ticker cannot be used/);
  });

  it('resolves symbol change without changing instrument identity', () => {
    const fixture = seedMd06ReferenceInstrumentMaster();
    const fabric = createHeliosMd06InstrumentMasterFabric({
      master: fixture.store,
      graph: fixture.graph,
    });
    const t1 = asUtcInstant('2020-06-01T00:00:00.000Z');
    const t2 = asUtcInstant('2023-06-01T00:00:00.000Z');
    const fb = fabric.resolveTicker({ ticker: 'FB', venueMic: 'XNAS', asOf: t1, knowableAtCutoff: t1 });
    const meta = fabric.resolveTicker({ ticker: 'META', venueMic: 'XNAS', asOf: t2, knowableAtCutoff: t2 });
    assert.equal(fb.instrumentIdentityId, fixture.metaIdentityId);
    assert.equal(meta.instrumentIdentityId, fixture.metaIdentityId);
    assert.notEqual(fb.listingId, meta.listingId);
  });

  it('keeps raw price series immutable while adjusting research series', () => {
    const fixture = seedMd06ReferenceInstrumentMaster();
    const raw = fixture.store.listRawBars(fixture.nvdaIdentityId);
    assert.equal(raw.length, 2);
    fixture.store.rebuildAdjustedResearch(fixture.nvdaIdentityId, asUtcInstant('2025-01-01T00:00:00.000Z'));
    const rawAgain = fixture.store.listRawBars(fixture.nvdaIdentityId);
    assert.deepEqual(raw, rawAgain);
    const adjusted = fixture.store.listAdjustedBars(fixture.nvdaIdentityId);
    const post = adjusted.find((row) => row.barTime === asUtcInstant('2024-06-10T21:00:00.000Z'));
    assert.ok(post);
    assert.equal(post!.closeMinor, 12_150n);
    assert.throws(
      () =>
        fixture.store.appendRawBar({
          instrumentIdentityId: fixture.nvdaIdentityId,
          barTime: asUtcInstant('2024-06-09T21:00:00.000Z'),
          openMinor: 1n,
          highMinor: 1n,
          lowMinor: 1n,
          closeMinor: 1n,
          volume: 1n,
          observationId: 'obs:nvda:raw:pre_split',
          knowableAt: asUtcInstant('2024-06-09T22:00:00.000Z'),
        }),
      /duplicate raw market event/,
    );
  });

  it('models derivative contract and option lifecycle fields', () => {
    const fixture = seedMd06ReferenceInstrumentMaster();
    const futures = fixture.store
      .listContractLifecycles()
      .find((row) => row.instrumentIdentityId === fixture.clContractIdentityId);
    const option = fixture.store
      .listContractLifecycles()
      .find((row) => row.instrumentIdentityId === fixture.nvdaCallIdentityId);
    assert.ok(futures?.expiry);
    assert.ok(futures?.firstNotice);
    assert.ok(futures?.lastTrade);
    assert.ok(futures?.delivery);
    assert.equal(option?.putCall, 'CALL');
    assert.equal(option?.underlyingInstrumentIdentityId, fixture.nvdaIdentityId);
  });

  it('qualifies with HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED', () => {
    const result = runMd06QualificationHarness();
    assert.equal(result.marker, HELIOS_MD06_INSTRUMENT_MASTER_QUALIFIED, result.blockers.join('; '));
  });

  it('persists instrument master snapshot across restart', () => {
    const fixture = seedMd06ReferenceInstrumentMaster();
    const snap = fixture.store.snapshot(asUtcInstant('2025-01-01T00:00:00.000Z'));
    const restarted = createInstrumentMasterStore();
    restarted.restore(snap);
    assert.equal(restarted.listIdentities().length, fixture.store.listIdentities().length);
    assert.equal(restarted.listRawBars(fixture.nvdaIdentityId).length, 2);
  });

  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const md06 = findings.filter((row) => row.file.includes('market-data/md06'));
    assert.equal(md06.length, 0, md06.map((row) => row.message).join('; '));
  });
});
