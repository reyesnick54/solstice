import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createExternalDataPlane,
  buildWave4CoverageReport,
  assertWave4CoverageComplete,
  WAVE4_IMPLEMENTED_PROVIDER_IDS,
} from '../packages/external-data/src/index.ts';

describe('Wave 4 Prompt 17 completion', () => {
  it('exposes all Wave 4 services on ExternalDataPlane', () => {
    const plane = createExternalDataPlane();
    assert.ok(plane.compliance);
    assert.ok(plane.businessIdentity);
    assert.ok(plane.digitalRisk);
    assert.ok(plane.vulnerability);
    assert.ok(plane.threatIntel);
    assert.ok(plane.endpointSecurity);
    assert.ok(plane.serviceOutage);
    assert.ok(plane.providerRisk);
  });

  it('accounts for every Wave 4 catalog provider', () => {
    const report = buildWave4CoverageReport();
    assert.ok(report.implemented >= WAVE4_IMPLEMENTED_PROVIDER_IDS.length);
    assertWave4CoverageComplete();
    const unexplained = report.providers.filter(
      (p) =>
        ['compliance', 'kyb_identity', 'fraud_risk', 'cybersecurity'].includes(p.category) &&
        p.status === 'NOT_WAVE_4',
    );
    assert.equal(unexplained.length, 0);
  });

  it('preserves Wave 2 behavior on shared plane', () => {
    const plane = createExternalDataPlane();
    const macro = plane.macro.getIndicators();
    assert.ok(macro.observations.length > 0);
    const wave4 = plane.vulnerability.getCveObservations();
    assert.ok(wave4.observations.length > 0);
  });
});
