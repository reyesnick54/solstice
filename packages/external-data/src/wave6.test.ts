import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createWave6Services,
} from './wave6/services.ts';
import {
  assertWave6CoverageComplete,
  buildWave6CoverageReport,
} from './wave6/coverage.ts';
import { WAVE6_IMPLEMENTED_PROVIDER_IDS } from './wave6/catalog-entries.ts';
import { createExternalDataPlane } from './plane.ts';

describe('Wave 6 package tests', () => {
  it('creates services with fixture observations', () => {
    const services = createWave6Services();
    assert.ok(services.research.searchWorks().observations.length >= 2);
    assert.ok(services.patents.searchPatents().observations.length >= 1);
  });

  it('plane integrates wave6 bundle', () => {
    const plane = createExternalDataPlane();
    const bundle = plane.wave6KnowledgeBundle();
    assert.equal(bundle.grantsExecutionAuthority, false);
    assert.equal(bundle.mintsMoonRey, false);
  });

  it('coverage report complete', () => {
    assertWave6CoverageComplete();
    const report = buildWave6CoverageReport();
    for (const id of WAVE6_IMPLEMENTED_PROVIDER_IDS) {
      assert.ok(report.providers.some((p) => p.providerId === id && p.status === 'IMPLEMENTED'));
    }
  });
});
