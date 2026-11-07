import type { UtcInstant } from '@solstice/domain';

import { filterKnowablePatents } from './knowable-at.ts';
import { buildInnovationIntelligenceForCompany, DEFAULT_FIXTURE_COMPANY } from './service.ts';
import { FIXTURE_UNPUBLISHED_APPLICATION, ALT09_FIXTURE_AS_OF } from './fixtures.ts';
import type { Alt09PipelineResult, Alt09PipelineStageResult } from './types.ts';

function stage(stageId: string, ok: boolean, detail: string): Alt09PipelineStageResult {
  return Object.freeze({ stage: stageId, ok, detail });
}

export type Alt09PipelineInput = {
  readonly asOf?: UtcInstant;
  readonly companyId?: string;
  readonly companyLabel?: string;
};

export function runAlt09InnovationIntelligencePipeline(
  input: Alt09PipelineInput = {},
): Alt09PipelineResult {
  const asOf = input.asOf ?? ALT09_FIXTURE_AS_OF;
  const companyId = input.companyId ?? DEFAULT_FIXTURE_COMPANY;
  const companyLabel = input.companyLabel ?? 'SunRey Simulation Labs';
  const stages: Alt09PipelineStageResult[] = [];

  const unpublishedVisible = filterKnowablePatents(asOf, [FIXTURE_UNPUBLISHED_APPLICATION]);
  stages.push(
    stage(
      'ALT09_PIT_PUBLICATION',
      unpublishedVisible.length === 0,
      `unpublished applications visible=${unpublishedVisible.length}`,
    ),
  );

  const result = buildInnovationIntelligenceForCompany({
    companyId,
    companyLabel,
    asOf,
  });
  const state = result.innovationState;
  const features = state.quality.features;

  stages.push(
    stage(
      'ALT09_WAVE6_UPGRADE',
      result.wave6PatentCount + result.fixturePatentCount >= 1,
      `wave6=${result.wave6PatentCount} fixture=${result.fixturePatentCount}`,
    ),
  );
  stages.push(
    stage(
      'ALT09_PORTFOLIO',
      state.portfolio.patents.length >= 1 && state.portfolio.families.length >= 1,
      `patents=${state.portfolio.patents.length} families=${state.portfolio.families.length}`,
    ),
  );
  stages.push(
    stage(
      'ALT09_EMBEDDINGS',
      state.portfolio.embeddings.length === state.portfolio.patents.length,
      `embeddings=${state.portfolio.embeddings.length}`,
    ),
  );
  stages.push(
    stage(
      'ALT09_FEATURES',
      features.patentCount >= 1 &&
        features.familyCount >= 1 &&
        features.semanticNovelty >= 0 &&
        features.technologyCentrality >= 0,
      `patentCount=${features.patentCount}`,
    ),
  );
  stages.push(
    stage(
      'ALT09_GRAPH',
      result.technologyGraph.nodes.length >= 3 && result.technologyGraph.edges.length >= 2,
      `nodes=${result.technologyGraph.nodes.length} edges=${result.technologyGraph.edges.length}`,
    ),
  );
  const util = state.commercialization.patentUtilization;
  const noGrantInference = util.every((row) => row.inferredFromGrantOnly === false);
  const hasLikely = util.some((row) => row.utilizationClass === 'LIKELY_UTILIZED');
  stages.push(
    stage(
      'ALT09_COMMERCIALIZATION',
      noGrantInference && (util.length === 0 || hasLikely || util.some((row) => row.utilizationClass === 'NO_EVIDENCE')),
      `utilization rows=${util.length}`,
    ),
  );
  stages.push(
    stage(
      'ALT09_DERIVED_SIGNALS',
      state.momentum.score >= 0 &&
        state.expansion.score >= 0 &&
        state.convergence.score >= 0 &&
        state.commercializationGap.score >= 0,
      'momentum/expansion/convergence/gap',
    ),
  );

  const knowableAtViolations = unpublishedVisible.length;
  const ok = stages.every((row) => row.ok);

  return Object.freeze({
    ok,
    stages: Object.freeze(stages),
    innovationState: state,
    technologyGraph: result.technologyGraph,
    knowableAtViolations,
  });
}
