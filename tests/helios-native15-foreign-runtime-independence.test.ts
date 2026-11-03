/**
 * HELIOS NATIVE15 — foreign runtime independence qualification (fast CI).
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED,
  buildNativeAssimilationWorkPackageRegistry,
  buildNativeCapabilityParityMatrix,
  evaluateForeignRuntimeIndependenceQualification,
  scanForeignRuntimeIndependence,
  scanRuntimeAssimilationImports,
  auditVendorAssimilationTree,
} from '../packages/platform/src/helios/native-assimilation/index.ts';

const ROOT = join(import.meta.dirname, '..');

describe('HELIOS NATIVE15 — foreign runtime independence', () => {
  it('vendor/assimilation is quarantined or contains no foreign application source', () => {
    const audit = auditVendorAssimilationTree(ROOT);
    assert.equal(audit.pass, true, JSON.stringify(audit.blockers));
  });

  it('no runtime import paths reference vendor/assimilation', () => {
    const violations = scanRuntimeAssimilationImports(ROOT);
    assert.equal(violations.length, 0, violations.join(', '));
  });

  it('foreign runtime scan passes outside quarantined assimilation trees', () => {
    const scan = scanForeignRuntimeIndependence(ROOT);
    assert.equal(scan.pass, true, scan.blockers.join('; '));
  });

  it('native capability parity matrix is fully QUALIFIED', () => {
    const matrix = buildNativeCapabilityParityMatrix(ROOT);
    assert.equal(matrix.allQualified, true, matrix.blockers.join('; '));
  });

  it('NATIVE01–NATIVE15 work packages are QUALIFIED', () => {
    const rows = buildNativeAssimilationWorkPackageRegistry(ROOT);
    const blocked = rows.filter((row) => row.status !== 'QUALIFIED');
    assert.equal(blocked.length, 0, blocked.map((r) => r.workPackage).join(', '));
  });

  it('emits HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED when all checks pass', () => {
    const result = evaluateForeignRuntimeIndependenceQualification({
      root: ROOT,
      gitSha: 'ci-local',
      evaluatedAt: asUtcInstant('2026-11-03T09:00:00.000Z'),
    });
    assert.equal(result.marker, HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });
});
