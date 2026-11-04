import type { Earn11ResearchArtifactBundle } from './research-requirements.ts';
import { buildEarn11ResearchTemplateGenome } from './templates.ts';

export function buildEarn11FixtureResearchArtifacts(
  overrides: Partial<Earn11ResearchArtifactBundle> = {},
): Earn11ResearchArtifactBundle {
  return Object.freeze({
    pitDatasetManifestRef: overrides.pitDatasetManifestRef ?? 'pit_manifest_earn11_fixture',
    coverageCertificationRef: overrides.coverageCertificationRef ?? 'coverage_cert_earn11_fixture',
    biasCertificationRef: overrides.biasCertificationRef ?? 'bias_cert_earn11_fixture',
    holdoutPartitionRef: overrides.holdoutPartitionRef ?? 'holdout_earn11_fixture',
    walkForwardPlanRef: overrides.walkForwardPlanRef ?? 'walk_forward_earn11_fixture',
    shadowRunRef: overrides.shadowRunRef ?? 'shadow_run_earn11_fixture',
    paperRunRef: overrides.paperRunRef ?? 'paper_run_earn11_fixture',
    aafV2Qualification: Object.freeze({
      qualificationId: overrides.aafV2Qualification?.qualificationId ?? 'aaf_v2_earn11_fixture',
      contentHash: overrides.aafV2Qualification?.contentHash ?? 'a'.repeat(64),
      promotionPermitted: overrides.aafV2Qualification?.promotionPermitted ?? true,
      policyHash: overrides.aafV2Qualification?.policyHash ?? 'b'.repeat(64),
      grantsExecutionAuthority: false as const,
    }),
  });
}

export function buildEarn11AnnouncementReactionGenomeFixture() {
  return buildEarn11ResearchTemplateGenome('ANNOUNCEMENT_REACTION', {
    genomeId: 'sgnm_helios_earn11_announcement_reaction_fixture',
  });
}
