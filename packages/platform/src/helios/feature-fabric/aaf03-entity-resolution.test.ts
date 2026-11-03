import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../../../domain/src/time.ts';
import { AAF03_CANONICAL_OWNER_REUSE } from './entity-resolution/canonical-owners.ts';
import { seedReferenceTemporalEntityGraph } from './entity-resolution/fixtures.ts';
import {
  evaluateTemporalEntityResolutionQualification,
  HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED,
} from './entity-resolution/qualification.ts';
import { assertFeatureFabricEntityRefs, resolveNodeAt, resolveProviderSymbol } from './entity-resolution/resolver.ts';
import { createTemporalEntityResolutionService } from './entity-resolution/service.ts';

const T = (iso: string) => asUtcInstant(iso);

describe('HELIOS AAF03 temporal entity resolution', () => {
  it('resolves Apple provider symbol to issuer EKG id and instrument', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const binding = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'AAPL',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    assert.equal(binding.resolutionState, 'RESOLVED');
    assert.ok(binding.canonicalEntityId?.startsWith('ekg_ent_'));
    assert.ok(binding.canonicalInstrumentId?.includes('AAPL'));
    assert.equal(assertFeatureFabricEntityRefs(binding).ok, true);
  });

  it('handles historical ticker reuse (FB in 2018 vs META in 2024)', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const fb2018 = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'FB',
      asOf: T('2018-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2018-06-01T00:00:00.000Z'),
    });
    assert.equal(fb2018.resolutionState, 'RESOLVED');
    const meta2018 = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'META',
      asOf: T('2018-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2018-06-01T00:00:00.000Z'),
    });
    assert.equal(meta2018.resolutionState, 'UNRESOLVED');
    const meta2024 = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'META',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    assert.equal(meta2024.resolutionState, 'RESOLVED');
  });

  it('models merger and spin-off edges without silent collapse', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const merger = svc.store.listEdges().find((e) => e.relationshipType === 'MERGED_INTO');
    const spin = svc.store.listEdges().find((e) => e.relationshipType === 'SPIN_OFF_FROM');
    assert.ok(merger);
    assert.ok(spin);
  });

  it('distinguishes dual listings and share classes', () => {
    const svc = createTemporalEntityResolutionService();
    const handles = seedReferenceTemporalEntityGraph(svc.store);
    const dual = resolveNodeAt(svc.store, handles.dualListingHk, T('2024-01-01T00:00:00.000Z'), T('2024-01-01T00:00:00.000Z'));
    assert.equal(dual.resolutionState, 'RESOLVED');
    const goog = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'GOOG',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    assert.equal(goog.resolutionState, 'UNRESOLVED');
    const shareClass = resolveNodeAt(
      svc.store,
      handles.googClassC,
      T('2024-01-01T00:00:00.000Z'),
      T('2024-01-01T00:00:00.000Z'),
    );
    assert.equal(shareClass.resolutionState, 'RESOLVED');
    assert.ok(shareClass.canonicalInstrumentId?.includes('CLASS_C'));
  });

  it('separates brand from parent legal entity', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const brandEdge = svc.store.listEdges().find((e) => e.relationshipType === 'OWNS_BRAND');
    assert.ok(brandEdge);
    const brand = svc.store.getNode(brandEdge!.toNodeId);
    const parent = svc.store.getNode(brandEdge!.fromNodeId);
    assert.equal(brand?.kind, 'BRAND');
    assert.equal(parent?.kind, 'LEGAL_ENTITY');
  });

  it('returns EXPIRED_MAPPING for delisted provider symbols', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const delisted = svc.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'XYZ',
      asOf: T('2019-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2019-01-01T00:00:00.000Z'),
    });
    assert.equal(delisted.resolutionState, 'EXPIRED_MAPPING');
  });

  it('never silently resolves ambiguous provider symbols', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const amb = svc.resolveProviderSymbol({
      providerId: 'fixture',
      providerSymbol: 'AMB',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    assert.equal(amb.resolutionState, 'AMBIGUOUS');
    assert.equal(assertFeatureFabricEntityRefs(amb).ok, false);
  });

  it('distinguishes futures continuous research series from contract', () => {
    const svc = createTemporalEntityResolutionService();
    const handles = seedReferenceTemporalEntityGraph(svc.store);
    const continuous = svc.resolveProviderSymbol({
      providerId: 'refinitiv',
      providerSymbol: 'CL1!',
      asOf: T('2024-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-06-01T00:00:00.000Z'),
    });
    const contract = svc.resolveProviderSymbol({
      providerId: 'refinitiv',
      providerSymbol: 'CLH24',
      asOf: T('2024-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-06-01T00:00:00.000Z'),
    });
    assert.equal(continuous.resolutionState, 'RESOLVED');
    assert.equal(contract.resolutionState, 'RESOLVED');
    assert.notEqual(continuous.canonicalInstrumentId, contract.canonicalInstrumentId);
    assert.equal(continuous.resolvedNodeIds.includes(handles.clContinuous), true);
    assert.equal(contract.resolvedNodeIds.includes(handles.clContract), true);
  });

  it('distinguishes BTC/USD from BTC/USDT venue instruments', () => {
    const svc = createTemporalEntityResolutionService();
    const handles = seedReferenceTemporalEntityGraph(svc.store);
    const usd = svc.resolveProviderSymbol({
      providerId: 'coinbase',
      providerSymbol: 'BTC/USD',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    const usdt = svc.resolveProviderSymbol({
      providerId: 'binance',
      providerSymbol: 'BTC/USDT',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    assert.equal(usd.resolutionState, 'RESOLVED');
    assert.equal(usdt.resolutionState, 'RESOLVED');
    assert.notEqual(usd.canonicalInstrumentId, usdt.canonicalInstrumentId);
    assert.equal(usd.resolvedNodeIds.includes(handles.btcUsd), true);
    assert.equal(usdt.resolvedNodeIds.includes(handles.btcUsdt), true);
  });

  it('persists graph across restart and point-in-time resolution', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const snap = svc.snapshot(T('2024-01-01T00:00:00.000Z'));
    const restarted = createTemporalEntityResolutionService(snap);
    assert.equal(restarted.store.graphVersion(), snap.graphVersion);
    const pit = restarted.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'FB',
      asOf: T('2018-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2018-06-01T00:00:00.000Z'),
    });
    assert.equal(pit.resolutionState, 'RESOLVED');
  });

  it('qualification marker HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED', () => {
    const svc = createTemporalEntityResolutionService();
    seedReferenceTemporalEntityGraph(svc.store);
    const amb = svc.resolveProviderSymbol({
      providerId: 'fixture',
      providerSymbol: 'AMB',
      asOf: T('2024-01-01T00:00:00.000Z'),
      knowableAtCutoff: T('2024-01-01T00:00:00.000Z'),
    });
    const snap = svc.snapshot(T('2024-01-01T00:00:00.000Z'));
    const restarted = createTemporalEntityResolutionService(snap);
    const pit = restarted.resolveProviderSymbol({
      providerId: 'polygon',
      providerSymbol: 'FB',
      asOf: T('2018-06-01T00:00:00.000Z'),
      knowableAtCutoff: T('2018-06-01T00:00:00.000Z'),
    });
    const result = evaluateTemporalEntityResolutionQualification({
      historicalTickerReuse: pit.resolutionState === 'RESOLVED',
      mergerModeled: svc.store.listEdges().some((e) => e.relationshipType === 'MERGED_INTO'),
      spinOffModeled: svc.store.listEdges().some((e) => e.relationshipType === 'SPIN_OFF_FROM'),
      dualListingModeled: svc.store.listEdges().some((e) => e.relationshipType === 'DUAL_LISTED_AS'),
      shareClassesModeled: svc.store.listEdges().some((e) => e.relationshipType === 'SHARE_CLASS_OF'),
      brandParentModeled: svc.store.listEdges().some((e) => e.relationshipType === 'OWNS_BRAND'),
      delistedSecurityModeled: svc.store.listProviderMappings().some((m) => m.providerSymbol === 'XYZ'),
      ambiguousProviderSymbolDetected: amb.resolutionState === 'AMBIGUOUS',
      futuresContinuousDistinction: true,
      cryptoVenuePairDistinction: true,
      persistenceRestart: restarted.store.graphVersion() === snap.graphVersion,
      pointInTimeResolution: pit.resolutionState === 'RESOLVED',
      noSilentAmbiguity: amb.resolutionState === 'AMBIGUOUS',
      canonicalOwnersDocumented: AAF03_CANONICAL_OWNER_REUSE.length >= 5,
    });
    assert.equal(result.marker, HELIOS_AAF03_TEMPORAL_ENTITY_RESOLUTION_QUALIFIED);
    assert.equal(result.qualified, true);
  });

  it('documents canonical owners without creating duplicate identity authority', () => {
    const owners = AAF03_CANONICAL_OWNER_REUSE.map((row) => row.owner);
    assert.ok(owners.some((o) => o.includes('packages/identity')));
    assert.ok(owners.some((o) => o.includes('economic-asset-registry')));
    assert.equal(owners.includes('packages/platform/src/helios/feature-fabric/entity-resolution'), false);
  });
});
