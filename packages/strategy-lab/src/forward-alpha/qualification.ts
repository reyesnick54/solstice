import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { LIVE_TRADING_ENABLED } from '@solstice/config';

import {
  FORWARD_ALPHA_ARCHITECTURE_TEST_CAPABLE_STATUSES,
  FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED,
  type ForwardAlphaArchitectureTestCapableStatus,
  type ForwardAlphaStatus,
} from './taxonomy.ts';

export {
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED,
};

export type Alpha01EngineeringQualificationChecks = Readonly<{
  readonly taxonomyModule: boolean;
  readonly typesModule: boolean;
  readonly laneSeparationModule: boolean;
  readonly forwardRequirementsModule: boolean;
  readonly sealModule: boolean;
  readonly manifestModule: boolean;
  readonly packageTestPresent: boolean;
}>;

export function alpha01EngineeringQualificationChecks(root: string): Alpha01EngineeringQualificationChecks {
  const base = join(root, 'packages/strategy-lab/src/forward-alpha');
  return Object.freeze({
    taxonomyModule: existsSync(join(base, 'taxonomy.ts')),
    typesModule: existsSync(join(base, 'types.ts')),
    laneSeparationModule: existsSync(join(base, 'lane-separation.ts')),
    forwardRequirementsModule: existsSync(join(base, 'forward-requirements.ts')),
    sealModule: existsSync(join(base, 'seal.ts')),
    manifestModule: existsSync(join(base, 'manifest.ts')),
    packageTestPresent: existsSync(join(base, 'forward-alpha.test.ts')),
  });
}

export type Alpha01QualificationResult = Readonly<{
  readonly marker:
    | typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED
    | typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}>;

export function evaluateAlpha01ForwardEvidenceDomainEngineering(
  checks: Alpha01EngineeringQualificationChecks,
): Alpha01QualificationResult {
  const entries: [keyof Alpha01EngineeringQualificationChecks, string][] = [
    ['taxonomyModule', 'alpha01_taxonomy'],
    ['typesModule', 'alpha01_types'],
    ['laneSeparationModule', 'alpha01_lane_separation'],
    ['forwardRequirementsModule', 'alpha01_forward_requirements'],
    ['sealModule', 'alpha01_seal'],
    ['manifestModule', 'alpha01_manifest'],
    ['packageTestPresent', 'alpha01_package_test'],
  ];
  const blockers = entries.filter(([key]) => !checks[key]).map(([, label]) => label);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED
      : HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function assertArchitectureTestStatusCap(status: ForwardAlphaStatus): status is ForwardAlphaArchitectureTestCapableStatus {
  return (FORWARD_ALPHA_ARCHITECTURE_TEST_CAPABLE_STATUSES as readonly string[]).includes(status);
}

export function assertSyntheticFixtureStatusAllowed(status: ForwardAlphaStatus, syntheticFixture: boolean): boolean {
  if (!syntheticFixture) {
    return true;
  }
  return !(FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES as readonly string[]).includes(status);
}

export type ForwardAlphaStatusResolutionInput = Readonly<{
  readonly architectureQualified: boolean;
  readonly campaignConfigured: boolean;
  readonly accumulatingForwardEvidence: boolean;
  readonly edgeCandidateMetricsPass: boolean;
  readonly forwardAlphaSupportedEvidence: boolean;
  readonly forwardRobustnessSupported: boolean;
  readonly paperImplementationSupported: boolean;
  readonly liveCapitalEvidence: boolean;
  readonly syntheticFixture: boolean;
  readonly architectureTestOnly: boolean;
}>;

export function resolveForwardAlphaStatus(input: ForwardAlphaStatusResolutionInput): {
  readonly status: ForwardAlphaStatus;
  readonly notes: readonly string[];
} {
  const notes: string[] = [];

  if (!input.architectureQualified) {
    notes.push('ALPHA01 modules incomplete');
    return Object.freeze({ status: 'ARCHITECTURE_QUALIFIED', notes: Object.freeze(notes) });
  }

  let status: ForwardAlphaStatus = 'ARCHITECTURE_QUALIFIED';

  if (input.campaignConfigured) {
    status = 'FORWARD_CAMPAIGN_READY';
  }

  if (input.architectureTestOnly) {
    if (!assertArchitectureTestStatusCap(status)) {
      notes.push('architecture tests may not assert status beyond FORWARD_CAMPAIGN_READY');
      status = 'FORWARD_CAMPAIGN_READY';
    }
    return Object.freeze({ status, notes: Object.freeze(notes) });
  }

  if (input.accumulatingForwardEvidence && status === 'FORWARD_CAMPAIGN_READY') {
    status = 'FORWARD_EVIDENCE_ACCUMULATING';
  }

  if (input.edgeCandidateMetricsPass && status === 'FORWARD_EVIDENCE_ACCUMULATING') {
    status = 'FORWARD_EDGE_CANDIDATE';
  }

  if (input.forwardRobustnessSupported && status === 'FORWARD_EDGE_CANDIDATE') {
    status = 'FORWARD_ROBUSTNESS_SUPPORTED';
  }

  if (input.paperImplementationSupported) {
    status = 'PAPER_IMPLEMENTATION_SUPPORTED';
  }

  if (input.forwardAlphaSupportedEvidence) {
    status = 'FORWARD_ALPHA_SUPPORTED';
    notes.push('forward alpha supported requires non-synthetic forward evidence');
  }

  if (input.liveCapitalEvidence && LIVE_TRADING_ENABLED) {
    notes.push('LIVE_TRADING_ENABLED must remain false in simulation qualification');
  }

  if (input.liveCapitalEvidence) {
    status = 'LIVE_ALPHA_SUPPORTED';
    notes.push('live alpha requires human capital authorization — not enabled in repository qualification');
  }

  if (input.syntheticFixture && !assertSyntheticFixtureStatusAllowed(status, true)) {
    notes.push('synthetic fixtures cannot mint FORWARD_ALPHA_SUPPORTED or LIVE_ALPHA_SUPPORTED');
    if (status === 'LIVE_ALPHA_SUPPORTED') {
      status = 'PAPER_IMPLEMENTATION_SUPPORTED';
    } else if (status === 'FORWARD_ALPHA_SUPPORTED') {
      status = 'FORWARD_ROBUSTNESS_SUPPORTED';
    }
  }

  return Object.freeze({ status, notes: Object.freeze(notes) });
}
