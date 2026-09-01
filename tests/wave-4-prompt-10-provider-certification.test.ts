/**
 * Wave 4 Prompt 10 — provider certification framework integration tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildWave7CoverageReport } from '../packages/external-data/src/wave7/coverage.ts';
import { createProviderCertificationService } from '../packages/provider-sdk/src/certification/service.ts';
import { catalogEntryImpliesLive } from '../packages/provider-sdk/src/certification/state.ts';

describe('wave 4 prompt 10 — provider certification', () => {
  it('catalog integration_state never implies live', () => {
    assert.equal(catalogEntryImpliesLive('implemented'), false);
    assert.equal(catalogEntryImpliesLive('adapter_implemented'), false);
    assert.equal(catalogEntryImpliesLive('catalog_only'), false);
  });

  it('wave7 coverage includes certification semantics without upgrading to live', () => {
    const report = buildWave7CoverageReport();
    assert.ok(report.providers.length > 0);
    for (const entry of report.providers) {
      assert.ok(entry.certificationStatus.length > 0);
      assert.equal(entry.liveValidated, false);
      if (entry.status === 'IMPLEMENTED_ACTIVE' || entry.status === 'IMPLEMENTED_PREVIEW_ONLY') {
        assert.equal(entry.simulated, true);
        assert.match(entry.notes, /not live without evidence/i);
      }
    }
  });

  it('certification report is machine-readable and contains no secrets', () => {
    const service = createProviderCertificationService();
    const report = service.certifyAllCatalogEntries();
    assert.equal(report.schemaVersion, 'sunrey.provider-certification.v1');
    assert.ok(report.summary.total > 0);
    const json = JSON.stringify(report);
    assert.ok(!json.includes('api_key'));
    assert.ok(!json.includes('Bearer '));
  });
});
