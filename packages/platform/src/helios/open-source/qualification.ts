/**
 * OS15 unified open-source integration qualification evaluator.
 */

import type { OpenSourceProvenanceManifest } from './provenance-scan.ts';
import {
  buildOpenSourceWorkPackageRegistry,
  openSourceWorkPackageBlockers,
  openSourceWorkPackagesQualified,
} from './work-package-registry.ts';
import { evaluateCanonicalAuthorityAssertions } from './authority-assertions.ts';
import { evaluateLiveSafetyAssertions } from './live-safety.ts';
import type { OpenSourceSystemDemoResult } from './system-demo-types.ts';
import {
  HELIOS_OPEN_SOURCE_INTEGRATION_SCHEMA,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED,
  HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED,
  type PlatformQualificationGateId,
} from './taxonomy.ts';

export type PlatformGateResult = {
  readonly gate: PlatformQualificationGateId;
  readonly pass: boolean;
  readonly detail: string;
};

export type OpenSourceIntegrationQualificationInput = {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: string;
  readonly platformGates: readonly PlatformGateResult[];
  readonly provenance: OpenSourceProvenanceManifest;
  readonly aafQualified: boolean;
  readonly aafDetail: string;
  readonly systemDemo: OpenSourceSystemDemoResult;
};

export type OpenSourceIntegrationQualificationResult = {
  readonly schema: typeof HELIOS_OPEN_SOURCE_INTEGRATION_SCHEMA;
  readonly marker:
    | typeof HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED
    | typeof HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED;
  readonly qualified: boolean;
  readonly gitSha: string;
  readonly evaluatedAt: string;
  readonly workPackages: ReturnType<typeof buildOpenSourceWorkPackageRegistry>;
  readonly platformGates: readonly PlatformGateResult[];
  readonly authority: ReturnType<typeof evaluateCanonicalAuthorityAssertions>;
  readonly liveSafety: ReturnType<typeof evaluateLiveSafetyAssertions>;
  readonly provenance: OpenSourceProvenanceManifest;
  readonly systemDemo: OpenSourceSystemDemoResult;
  readonly blockers: readonly string[];
};

export function evaluateOpenSourceIntegrationQualification(
  input: OpenSourceIntegrationQualificationInput,
): OpenSourceIntegrationQualificationResult {
  const workPackages = buildOpenSourceWorkPackageRegistry(input.root);
  const authority = evaluateCanonicalAuthorityAssertions(input.root);
  const liveSafety = evaluateLiveSafetyAssertions(input.root);
  const systemDemo = input.systemDemo;

  const blockers: string[] = [];

  if (!openSourceWorkPackagesQualified(workPackages)) {
    blockers.push(...openSourceWorkPackageBlockers(workPackages));
  }
  for (const gate of input.platformGates) {
    if (!gate.pass) {
      blockers.push(`platform gate ${gate.gate}: ${gate.detail}`);
    }
  }
  if (!authority.pass) {
    blockers.push(...authority.blockers);
  }
  if (!liveSafety.pass) {
    blockers.push('live safety assertions failed');
  }
  if (!input.provenance.pass) {
    blockers.push('third-party provenance scan failed');
  }
  if (!input.aafQualified) {
    blockers.push(`AAF qualification: ${input.aafDetail}`);
  }
  if (!systemDemo.pass) {
    blockers.push(
      `system demo incomplete (${systemDemo.openSourceStagesPending} open-source stages pending or hard failure)`,
    );
  }

  const qualified = blockers.length === 0;

  return Object.freeze({
    schema: HELIOS_OPEN_SOURCE_INTEGRATION_SCHEMA,
    marker: qualified
      ? HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_QUALIFIED
      : HELIOS_OPEN_SOURCE_INTEGRATION_WAVE1_BLOCKED,
    qualified,
    gitSha: input.gitSha,
    evaluatedAt: input.evaluatedAt,
    workPackages,
    platformGates: Object.freeze([...input.platformGates]),
    authority,
    liveSafety,
    provenance: input.provenance,
    systemDemo,
    blockers: Object.freeze(blockers),
  });
}
