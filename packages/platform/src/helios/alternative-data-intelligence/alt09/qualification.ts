import {
  HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED,
  HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED,
} from './taxonomy.ts';
import { runAlt09InnovationIntelligencePipeline } from './pipeline.ts';

export { HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED, HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED };

export type Alt09QualificationChecks = {
  readonly publicationFloorEnforced: boolean;
  readonly wave6UpgradePresent: boolean;
  readonly portfolioAndFamiliesBuilt: boolean;
  readonly embeddingsTimeSafe: boolean;
  readonly featureBundleComplete: boolean;
  readonly technologyGraphWired: boolean;
  readonly commercializationNotInferredFromGrant: boolean;
  readonly derivedInnovationSignalsPresent: boolean;
  readonly grantsInfringementConclusion: false;
  readonly grantsInvestmentAlpha: false;
};

export type Alt09QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly pipelineOk: boolean;
};

export function evaluateAlt09InnovationIntelligenceQualification(
  checks: Alt09QualificationChecks = deriveAlt09QualificationChecks(),
): Alt09QualificationResult {
  const blockers: string[] = [];
  const entries: [keyof Alt09QualificationChecks, string][] = [
    ['publicationFloorEnforced', 'publication_floor'],
    ['wave6UpgradePresent', 'wave6_upgrade'],
    ['portfolioAndFamiliesBuilt', 'portfolio_families'],
    ['embeddingsTimeSafe', 'embeddings_time_safe'],
    ['featureBundleComplete', 'feature_bundle'],
    ['technologyGraphWired', 'technology_graph'],
    ['commercializationNotInferredFromGrant', 'commercialization_evidence'],
    ['derivedInnovationSignalsPresent', 'derived_signals'],
  ];
  for (const [key, label] of entries) {
    if (!checks[key]) {
      blockers.push(label);
    }
  }
  if (checks.grantsInfringementConclusion !== false) {
    blockers.push('grants_infringement');
  }
  if (checks.grantsInvestmentAlpha !== false) {
    blockers.push('grants_investment_alpha');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED
      : HELIOS_ALT09_INNOVATION_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    pipelineOk: qualified,
  });
}

export function deriveAlt09QualificationChecks(): Alt09QualificationChecks {
  const pipeline = runAlt09InnovationIntelligencePipeline();
  const state = pipeline.innovationState!;
  const features = state.quality.features;
  const featureKeys: (keyof typeof features)[] = [
    'patentCount',
    'familyCount',
    'citationVelocity',
    'selfCitation',
    'forwardCitation',
    'backwardCitation',
    'technologyBreadth',
    'technologyConcentration',
    'inventorBreadth',
    'assigneeChange',
    'assignmentFrequency',
    'internationalFamilyBreadth',
    'semanticNovelty',
    'technologyCentrality',
  ];
  return Object.freeze({
    publicationFloorEnforced: pipeline.knowableAtViolations === 0,
    wave6UpgradePresent: pipeline.stages.some((s) => s.stage === 'ALT09_WAVE6_UPGRADE' && s.ok),
    portfolioAndFamiliesBuilt:
      state.portfolio.patents.length >= 1 && state.portfolio.families.length >= 1,
    embeddingsTimeSafe:
      state.portfolio.embeddings.length === state.portfolio.patents.length &&
      state.portfolio.embeddings.every(
        (row) => Date.parse(row.knowableAt) >= Date.parse(row.modelEffectiveAt),
      ),
    featureBundleComplete: featureKeys.every((key) => typeof features[key] === 'number'),
    technologyGraphWired: (pipeline.technologyGraph?.edges.length ?? 0) >= 2,
    commercializationNotInferredFromGrant: state.commercialization.patentUtilization.every(
      (row) => row.inferredFromGrantOnly === false,
    ),
    derivedInnovationSignalsPresent:
      state.momentum.score >= 0 &&
      state.expansion.score >= 0 &&
      state.convergence.score >= 0 &&
      state.commercializationGap.score >= 0,
    grantsInfringementConclusion: false as const,
    grantsInvestmentAlpha: false as const,
  });
}
