/**
 * HELIOS ALT03 — temporal entity, brand, facility, and product resolution for alternative data.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALT_ASSET_ENTITY_KINDS,
  ALT_ASSET_RELATIONSHIP_TYPES,
  ALT_MATCH_CASCADE_STAGES,
  HELIOS_ALT03,
  HELIOS_ALT03_AUTHORITY,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED,
  HELIOS_ALT03_ENTITY_ASSET_GRAPH_SCHEMA,
  assertAltObservationCompanyFeatureEligible,
  createHeliosAlt03EntityAssetGraphFabric,
  runAlt03QualificationHarness,
  seedAlt03ReferenceEntityAssetGraph,
} from '../packages/platform/src/helios/alternative-data/index.ts';
import {
  TEMPORAL_ENTITY_KINDS,
  TEMPORAL_RELATIONSHIP_TYPES,
} from '../packages/platform/src/helios/feature-fabric/entity-resolution/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS ALT03 entity asset graph', () => {
  it('exports schema, chunk marker, and reference-only authority', () => {
    assert.equal(HELIOS_ALT03, 'HELIOS_ALT03');
    assert.equal(HELIOS_ALT03_ENTITY_ASSET_GRAPH_SCHEMA, 'sunrey.helios.alternative-data.entity-asset-graph.v1');
    assert.equal(HELIOS_ALT03_AUTHORITY, 'REFERENCE_ONLY');
  });

  it('extends canonical temporal entity graph kinds and relations', () => {
    for (const kind of ALT_ASSET_ENTITY_KINDS) {
      assert.ok((TEMPORAL_ENTITY_KINDS as readonly string[]).includes(kind), kind);
    }
    for (const rel of ALT_ASSET_RELATIONSHIP_TYPES) {
      assert.ok((TEMPORAL_RELATIONSHIP_TYPES as readonly string[]).includes(rel), rel);
    }
    assert.equal(ALT_MATCH_CASCADE_STAGES.length, 5);
  });

  it('does not treat brand mention as public company', () => {
    const fixture = seedAlt03ReferenceEntityAssetGraph();
    const fabric = createHeliosAlt03EntityAssetGraphFabric({ graph: fixture.store });
    const t = asUtcInstant('2024-06-01T00:00:00.000Z');
    const record = fabric.resolveObservation({
      observationRef: 'obs:brand-dawn-test',
      providerId: 'fixture_alt',
      surface: 'BRAND_MENTION',
      rawLabel: 'Dawn dish soap brand',
      asOf: t,
      knowableAtCutoff: t,
      deterministicIdentifiers: Object.freeze([]),
      normalizedTokens: Object.freeze(['dawn dish soap brand']),
      sourceRefs: Object.freeze(['evidence:test']),
    });
    assert.equal(record.matchState, 'EXACT');
    assert.equal(record.resolvedKind, 'BRAND');
    assert.notEqual(record.resolvedNodeId, fixture.pghParent);
  });

  it('blocks ambiguous alternative observations from company-specific investment features', () => {
    const gate = assertAltObservationCompanyFeatureEligible('AMBIGUOUS');
    assert.equal(gate.ok, false);
    const ok = assertAltObservationCompanyFeatureEligible('EXACT');
    assert.equal(ok.ok, true);
  });

  it('resolves vessel observations to VESSEL nodes via IMO, not listed parent', () => {
    const fixture = seedAlt03ReferenceEntityAssetGraph();
    const fabric = createHeliosAlt03EntityAssetGraphFabric({ graph: fixture.store });
    const t = asUtcInstant('2024-06-01T00:00:00.000Z');
    const record = fabric.resolveObservation({
      observationRef: 'obs:vessel-imo',
      providerId: 'fixture_alt',
      surface: 'VESSEL_CARGO',
      rawLabel: 'Pacific Trader',
      asOf: t,
      knowableAtCutoff: t,
      deterministicIdentifiers: Object.freeze([{ system: 'imo', id: 'IMO9123456' }]),
      normalizedTokens: Object.freeze([]),
      sourceRefs: Object.freeze(['evidence:ais']),
    });
    assert.equal(record.matchState, 'EXACT');
    assert.equal(record.resolvedKind, 'VESSEL');
    assert.notEqual(record.resolvedNodeId, fixture.pghParent);
  });

  it('does not silently certify LLM parent-guess proposals', () => {
    const fixture = seedAlt03ReferenceEntityAssetGraph();
    const fabric = createHeliosAlt03EntityAssetGraphFabric({
      graph: fixture.store,
      llmProposals: fixture.llmProposals,
    });
    const t = asUtcInstant('2024-06-01T00:00:00.000Z');
    const record = fabric.resolveObservation({
      observationRef: 'obs:vessel-cargo-ambiguous',
      providerId: 'fixture_alt',
      surface: 'VESSEL_CARGO',
      rawLabel: 'Mystery bulk cargo consignee',
      asOf: t,
      knowableAtCutoff: t,
      deterministicIdentifiers: Object.freeze([]),
      normalizedTokens: Object.freeze([]),
      sourceRefs: Object.freeze(['evidence:ais']),
    });
    assert.equal(record.matchState, 'AMBIGUOUS');
    assert.equal(record.llmProposal?.certified, false);
    assert.equal(assertAltObservationCompanyFeatureEligible(record.matchState).ok, false);
  });

  it('qualification marker HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED', () => {
    const result = runAlt03QualificationHarness();
    assert.equal(result.marker, HELIOS_ALT03_ENTITY_ASSET_GRAPH_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);
  });

  it('passes HELIOS boundary lint', () => {
    const violations = lintHeliosBoundary(
      'packages/platform/src/helios/alternative-data/alt03-entity-asset-graph/matching-cascade.ts',
    );
    assert.equal(violations.length, 0);
  });
});
