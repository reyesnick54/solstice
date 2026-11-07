/**
 * HELIOS Alternative Data ALT12 — missing-aware multimodal fusion and signal routing.
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ALT_MISSING_REASONS,
  ALT_MODALITIES,
  HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED,
  alt12FullModalityInputs,
  alt12SparseModalityInputs,
  ALT12_FIXTURE_AS_OF,
  ALT12_FIXTURE_ENTITY_ID,
  evaluateAlt12MultimodalFusionQualification,
  listAltWorkPackages,
  qualificationChecksFromState,
  runAlt12MultimodalFusion,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS ALT12 — multimodal fusion', () => {
  it('architecture guard: alternative-data-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('alternative-data-intelligence'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('registers ALT12 in the work package registry when module and test exist', () => {
    const rows = listAltWorkPackages(ROOT);
    const alt12 = rows.find((r) => r.packageId === 'ALT12');
    assert.ok(alt12);
    assert.equal(alt12!.status, 'IMPLEMENTED');
  });

  it('tracks all modality families and missingness reason taxonomy', () => {
    assert.equal(ALT_MODALITIES.length, 11);
    assert.ok(ALT_MISSING_REASONS.includes('PROVIDER_OUTAGE'));
    assert.ok(ALT_MISSING_REASONS.includes('LICENSE_BLOCKED'));
  });

  it('fuses heterogeneous modalities with baseline and advanced model families', () => {
    const state = runAlt12MultimodalFusion({
      fusionId: 'alt12-demo-full',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12FullModalityInputs(),
    });

    assert.equal(state.grantsExecutionAuthority, false);
    assert.equal(state.researchOnly, true);
    assert.ok(Number.isFinite(state.fusedSignal));
    assert.equal(Object.keys(state.baselineOutputs).length, 3);
    assert.equal(Object.keys(state.advancedOutputs).length, 4);
    assert.ok(state.sourceContributions.length >= 8);
    assert.equal(state.uncertainty.calibrated, true);
    assert.ok(state.dropoutResults.every((row) => !row.catastrophic));
  });

  it('accepts partial modality subsets without catastrophic failure', () => {
    const sparse = runAlt12MultimodalFusion({
      fusionId: 'alt12-demo-sparse',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12SparseModalityInputs(),
      runDropoutValidation: false,
    });
    assert.ok(Number.isFinite(sparse.fusedSignal));
    assert.ok(sparse.route.activeModalities.length < ALT_MODALITIES.length);
    const digital = sparse.modalities.find((m) => m.modality === 'digital_demand');
    assert.equal(digital?.missingReason, 'PROVIDER_OUTAGE');
    assert.ok(sparse.uncertainty.missingnessInflation > 0);
  });

  it('applies dynamic routing for cloud, search reliability, and workforce coverage', () => {
    const routed = runAlt12MultimodalFusion({
      fusionId: 'alt12-demo-routing',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12FullModalityInputs(),
      routingContext: {
        satelliteCloudObscured: true,
        digitalDemandReliabilityDegraded: true,
        workforceGeographicCoverageLost: true,
      },
      runDropoutValidation: false,
    });

    assert.ok(routed.route.routingNotes.some((n) => n.includes('satellite_cloud_obscured')));
    assert.ok(routed.route.routingNotes.some((n) => n.includes('search_reliability_degraded')));
    assert.ok(routed.route.blockedModalities.includes('workforce'));
    assert.ok((routed.route.modalityRouteWeights.satellite_geospatial ?? 1) < 0.05);
    assert.ok((routed.route.modalityRouteWeights.digital_demand ?? 1) < 0.1);
  });

  it('widens uncertainty when modalities are missing or low quality', () => {
    const full = runAlt12MultimodalFusion({
      fusionId: 'alt12-uncertainty-full',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12FullModalityInputs(),
      runDropoutValidation: false,
    });
    const sparse = runAlt12MultimodalFusion({
      fusionId: 'alt12-uncertainty-sparse',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12SparseModalityInputs(),
      runDropoutValidation: false,
    });
    assert.ok(sparse.uncertainty.total >= full.uncertainty.total);
  });

  it('qualifies HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED on sparse fusion with dropout validation', () => {
    const state = runAlt12MultimodalFusion({
      fusionId: 'alt12-qualify',
      entityId: ALT12_FIXTURE_ENTITY_ID,
      asOf: ALT12_FIXTURE_AS_OF,
      modalityInputs: alt12SparseModalityInputs(),
    });
    const checks = qualificationChecksFromState(state);
    const result = evaluateAlt12MultimodalFusionQualification(checks);
    assert.equal(result.marker, HELIOS_ALT12_MULTIMODAL_FUSION_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
