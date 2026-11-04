import {
  EARN11_MANDATORY_RESEARCH_ARTIFACTS,
  type Earn11MandatoryResearchArtifact,
} from './taxonomy.ts';

export type Earn11AafV2QualificationRef = {
  readonly qualificationId: string;
  readonly contentHash: string;
  readonly promotionPermitted: boolean;
  readonly policyHash: string;
  readonly grantsExecutionAuthority: false;
};

export type Earn11ResearchArtifactBundle = {
  readonly pitDatasetManifestRef: string;
  readonly coverageCertificationRef: string;
  readonly biasCertificationRef: string;
  readonly holdoutPartitionRef: string;
  readonly walkForwardPlanRef: string;
  readonly shadowRunRef: string;
  readonly paperRunRef: string;
  readonly aafV2Qualification: Earn11AafV2QualificationRef;
};

export type Earn11ResearchArtifactGateResult = {
  readonly complete: boolean;
  readonly missing: readonly Earn11MandatoryResearchArtifact[];
  readonly blockers: readonly string[];
};

function artifactPresent(bundle: Earn11ResearchArtifactBundle, artifact: Earn11MandatoryResearchArtifact): boolean {
  switch (artifact) {
    case 'PIT_DATASET':
      return bundle.pitDatasetManifestRef.length > 0;
    case 'COVERAGE_CERTIFICATION':
      return bundle.coverageCertificationRef.length > 0;
    case 'BIAS_CERTIFICATION':
      return bundle.biasCertificationRef.length > 0;
    case 'HOLDOUT':
      return bundle.holdoutPartitionRef.length > 0;
    case 'WALK_FORWARD':
      return bundle.walkForwardPlanRef.length > 0;
    case 'SHADOW':
      return bundle.shadowRunRef.length > 0;
    case 'PAPER':
      return bundle.paperRunRef.length > 0;
    default:
      return false;
  }
}

export function gateEarn11ResearchArtifacts(
  bundle: Earn11ResearchArtifactBundle | null | undefined,
): Earn11ResearchArtifactGateResult {
  const missing: Earn11MandatoryResearchArtifact[] = [];
  const blockers: string[] = [];

  if (!bundle) {
    return Object.freeze({
      complete: false,
      missing: EARN11_MANDATORY_RESEARCH_ARTIFACTS,
      blockers: Object.freeze(['earn11_research_artifact_bundle_missing']),
    });
  }

  for (const artifact of EARN11_MANDATORY_RESEARCH_ARTIFACTS) {
    if (!artifactPresent(bundle, artifact)) {
      missing.push(artifact);
    }
  }

  if (!bundle.aafV2Qualification.qualificationId) {
    blockers.push('aaf_v2_qualification_missing');
  }
  if (!bundle.aafV2Qualification.promotionPermitted) {
    blockers.push('aaf_v2_qualification_blocks_promotion');
  }
  if (bundle.aafV2Qualification.grantsExecutionAuthority !== false) {
    blockers.push('aaf_v2_must_not_grant_execution_authority');
  }

  if (missing.length > 0) {
    blockers.push(`missing_mandatory_artifacts:${missing.join(',')}`);
  }

  return Object.freeze({
    complete: missing.length === 0 && blockers.length === 0,
    missing: Object.freeze(missing),
    blockers: Object.freeze(blockers),
  });
}
