/**
 * HELIOS OS15 — open-source integration wave 1 qualification (fast CI).
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED,
  buildOpenSourceWorkPackageRegistry,
  evaluateCanonicalAuthorityAssertions,
  evaluateLiveSafetyAssertions,
  evaluateOpenSourceIntegrationQualification,
  scanOpenSourceProvenance,
} from '../packages/platform/src/helios/open-source/index.ts';
import { runOpenSourceIntegrationSystemDemo } from '../scripts/lib/helios-open-source-system-demo.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS OS15 — open-source integration qualification', () => {
  it('architecture guard: open-source qualification stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT);
    const scoped = findings.filter((f) => f.file.includes('helios/open-source'));
    assert.equal(scoped.length, 0, JSON.stringify(scoped));
  });

  it('live safety posture remains simulation-only', () => {
    const live = evaluateLiveSafetyAssertions(ROOT);
    assert.equal(live.pass, true, JSON.stringify(live.assertions.filter((row) => !row.pass)));
  });

  it('canonical authority: no competing ledger/kernel/exchange owners', () => {
    const authority = evaluateCanonicalAuthorityAssertions(ROOT);
    assert.equal(authority.pass, true, authority.blockers.join('; '));
  });

  it('system demo runs canonical observation → H20 → paper fill → evidence without hard failures', () => {
    const demo = runOpenSourceIntegrationSystemDemo(ROOT);
    const failures = demo.steps.filter((row) => row.status === 'FAIL');
    assert.equal(failures.length, 0, JSON.stringify(failures));
  });

  it('provenance scan rejects committed binaries and credential patterns in open-source tree', () => {
    const manifest = scanOpenSourceProvenance({
      root: ROOT,
      gitSha: 'test',
      scannedAt: asUtcInstant('2026-09-21T12:00:00.000Z'),
    });
    assert.equal(manifest.binaryFilesFound.length, 0);
    assert.equal(manifest.credentialPatternHits.length, 0);
  });

  it('emits HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED only when OS00–OS14 and gates pass', () => {
    const workPackages = buildOpenSourceWorkPackageRegistry(ROOT);
    const osWaveComplete = workPackages
      .filter((row) => row.workPackage !== 'OS15')
      .every((row) => row.status === 'QUALIFIED');

    const systemDemo = runOpenSourceIntegrationSystemDemo(ROOT);
    const qualification = evaluateOpenSourceIntegrationQualification({
      root: ROOT,
      gitSha: 'ci-local',
      evaluatedAt: asUtcInstant('2026-09-21T12:00:00.000Z'),
      systemDemo,
      platformGates: Object.freeze([
        { gate: 'architecture_lint', pass: true, detail: 'ci-assumed' },
        { gate: 'production_safety', pass: true, detail: 'ci-assumed' },
        { gate: 'typecheck', pass: true, detail: 'ci-assumed' },
        { gate: 'repository_tests', pass: true, detail: 'ci-assumed' },
        { gate: 'helios_boundary', pass: true, detail: 'ci-assumed' },
        { gate: 'aaf_qualification', pass: osWaveComplete, detail: 'synthetic for marker test' },
        { gate: 'database_migrations', pass: true, detail: 'ci-assumed' },
        { gate: 'package_boundaries', pass: true, detail: 'ci-assumed' },
        { gate: 'security_scan', pass: true, detail: 'ci-assumed' },
        { gate: 'live_safety', pass: true, detail: 'ci-assumed' },
        { gate: 'canonical_authority', pass: true, detail: 'ci-assumed' },
        { gate: 'third_party_provenance', pass: true, detail: 'ci-assumed' },
        { gate: 'system_demo', pass: osWaveComplete, detail: 'synthetic for marker test' },
        { gate: 'open_source_work_packages', pass: osWaveComplete, detail: 'synthetic for marker test' },
      ]),
      provenance: scanOpenSourceProvenance({
        root: ROOT,
        gitSha: 'ci-local',
        scannedAt: asUtcInstant('2026-09-21T12:00:00.000Z'),
      }),
      aafQualified: osWaveComplete,
      aafDetail: 'synthetic',
    });

    if (osWaveComplete) {
      assert.equal(qualification.marker, HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED);
    } else {
      assert.equal(qualification.marker, HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED);
      assert.ok(qualification.blockers.length > 0);
    }
  });

  it('OS15 work package is qualified when qualification code and tests are present', () => {
    const rows = buildOpenSourceWorkPackageRegistry(ROOT);
    const os15 = rows.find((row) => row.workPackage === 'OS15');
    assert.ok(os15);
    assert.equal(os15!.status, 'QUALIFIED');
  });
});
