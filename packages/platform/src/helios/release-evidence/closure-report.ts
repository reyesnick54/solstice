/**
 * HELIOS H36 — H01-H36 engineering closure report.
 */

import type { UtcInstant } from '@solstice/domain';
import { buildHeliosWorkPackageRegistry, registryHasBlockers } from './work-package-registry.ts';
import type {
  HeliosClosureReport,
  HELIOSReleaseEvidencePackage,
  LivePilotGate,
  ReleaseCandidateQualificationResult,
} from './types.ts';

export function buildHeliosClosureReport(input: {
  readonly root: string;
  readonly generatedAt: UtcInstant;
  readonly releaseEvidence: HELIOSReleaseEvidencePackage;
  readonly qualification: ReleaseCandidateQualificationResult;
  readonly livePilotGate?: LivePilotGate | null;
}): HeliosClosureReport {
  const registry = buildHeliosWorkPackageRegistry(input.root);
  const engineering = input.releaseEvidence.engineering;

  const recommendedNext =
    input.qualification.marker === 'HELIOS_RC_QUALIFIED_READY_FOR_HUMAN_PILOT_AUTHORIZATION'
      ? 'Issue scoped LivePilotAuthorization through authorized governance roles, then execute pilot activation ceremony — H36 does not activate live connectivity.'
      : input.qualification.marker === 'HELIOS_RC_QUALIFIED_EXTERNAL_GATES_PENDING'
        ? 'Complete external live-pilot gate evidence (legal, provider, security, compliance, operations, customer) for the defined narrow pilot scope.'
        : 'Resolve engineering blockers and re-bind release evidence to the exact Git SHA before re-evaluating.';

  const humanReadableSummary = [
    `HELIOS H01-H36 closure at ${input.generatedAt}.`,
    `Release SHA ${input.releaseEvidence.identity.gitSha}.`,
    `Engineering qualified: ${engineering.engineeringQualified}.`,
    `Release candidate status: ${input.qualification.marker}.`,
    registryHasBlockers(registry) ? 'Work-package registry contains BLOCKED items.' : 'Work-package registry has no BLOCKED items.',
    'Live financial connectivity remains off; ENVIRONMENT simulation posture preserved.',
  ].join(' ');

  return Object.freeze({
    schema: 'sunrey.helios.closure-report.v1',
    generatedAt: input.generatedAt,
    releaseSha: input.releaseEvidence.identity.gitSha,
    baseSha: input.releaseEvidence.identity.baseSha ?? null,
    releaseArtifactDigest: input.releaseEvidence.identity.artifactDigest,
    h01ThroughH36: registry,
    architectureQualification: engineering.architectureChecks.qualified ? 'QUALIFIED' : 'BLOCKED',
    dataProviderStatus: input.releaseEvidence.data.externalQualificationStatus,
    modelsStatus: input.releaseEvidence.intelligence.qualifiedModelProviderState,
    strategyStatus: input.releaseEvidence.intelligence.strategyLabStatus,
    financialOperationsStatus: input.releaseEvidence.financialProviders[0]?.contractStatus ?? 'UNKNOWN',
    regulatoryFrameworkStatus: input.releaseEvidence.regulatory.regulatoryEvidenceState,
    resilienceStatus: engineering.resilienceH31.marker ?? 'UNKNOWN',
    economicEvaluationStatus: engineering.economicEvaluationH32.marker ?? 'UNKNOWN',
    capacityStatus: engineering.capacityLatencyH33.marker ?? 'UNKNOWN',
    deploymentAcceptanceStatus: input.releaseEvidence.operations.hetznerRelease.marker ?? 'UNKNOWN',
    externalGatesStatus: input.livePilotGate?.allGatesSatisfied ? 'ALL_SATISFIED' : 'PENDING',
    pilotEligibility: input.qualification.readyForHumanPilotAuthorization
      ? 'READY_FOR_HUMAN_LIVE_PILOT_AUTHORIZATION'
      : 'NOT_READY',
    knownLimitations: input.releaseEvidence.knownLimitations,
    recommendedNextAuthorizedAction: recommendedNext,
    releaseCandidateStatus: input.qualification.marker,
    humanReadableSummary,
  });
}
