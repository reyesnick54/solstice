/**
 * HELIOS H35 — pre-deploy release package verification.
 */

import type { HeliosReleasePackageManifest } from '../release-package/index.ts';
import type { AcceptanceCheck } from './types.ts';

export function verifyHeliosReleasePackageGate(input: {
  readonly manifest: HeliosReleasePackageManifest | null;
  readonly expectedCommitSha?: string;
  readonly expectedArtifactDigest?: string;
}): AcceptanceCheck[] {
  const checks: AcceptanceCheck[] = [];

  if (!input.manifest) {
    checks.push({
      category: 'preDeploy',
      label: 'H34 release package manifest present',
      status: 'BLOCKED',
      detail: 'release/helios-release-package.json missing — run npm run helios:release-package:qualify',
    });
    return checks;
  }

  checks.push({
    category: 'preDeploy',
    label: 'H34 release package manifest present',
    status: 'PASS',
  });

  checks.push({
    category: 'preDeploy',
    label: 'H34 release package qualified',
    status: input.manifest.qualified ? 'PASS' : 'BLOCKED',
    detail: input.manifest.qualified ? undefined : input.manifest.blockers.join('; '),
  });

  if (input.expectedCommitSha) {
    checks.push({
      category: 'preDeploy',
      label: 'Exact Git SHA match',
      status: input.manifest.commitSha === input.expectedCommitSha ? 'PASS' : 'FAIL',
      detail:
        input.manifest.commitSha === input.expectedCommitSha
          ? undefined
          : `manifest=${input.manifest.commitSha} expected=${input.expectedCommitSha}`,
    });
  }

  if (input.expectedArtifactDigest) {
    checks.push({
      category: 'preDeploy',
      label: 'Exact artifact digest match',
      status: input.manifest.artifactDigest === input.expectedArtifactDigest ? 'PASS' : 'FAIL',
    });
  }

  checks.push({
    category: 'preDeploy',
    label: 'Rollback artifact reference recorded',
    status: input.manifest.rollbackArtifactRef.length > 0 ? 'PASS' : 'FAIL',
  });

  checks.push({
    category: 'preDeploy',
    label: 'Same-SHA migration image digest recorded',
    status: input.manifest.migrationImageDigest.length > 0 ? 'PASS' : 'FAIL',
  });

  checks.push({
    category: 'preDeploy',
    label: 'Approved configuration package recorded',
    status: input.manifest.configurationPackage.length > 0 ? 'PASS' : 'FAIL',
  });

  return checks;
}
