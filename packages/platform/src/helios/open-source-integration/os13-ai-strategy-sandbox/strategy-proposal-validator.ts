import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { isKnowableAt } from '../../../../../strategy-lab/src/evaluation/information-time.ts';
import { validateStrategyAst } from '../../../../../strategy-lab/src/dsl.ts';
import { expandParameterGrid } from '../../../../../strategy-lab/src/experiment.ts';
import { freezeSpecification } from '../../../../../strategy-lab/src/specification.ts';
import type { StrategyFailure } from '../../../../../strategy-lab/src/types.ts';
import type { StrategyProposal } from './strategy-proposal.ts';
import {
  collectSafetyViolations,
  DEFAULT_STRATEGY_SAFETY_POLICY,
  type StrategySafetyPolicy,
} from './strategy-safety-policy.ts';

export type StrategyFeatureCatalog = {
  readonly hasDataFeature: (featureId: string) => boolean;
  readonly hasApprovedModel: (modelId: string, version: string) => boolean;
};

export type StrategyProposalValidationStage =
  | 'SYNTAX_SCHEMA'
  | 'PROHIBITED_NODES'
  | 'INFORMATION_TIME'
  | 'FEATURE_AVAILABILITY'
  | 'PARAMETER_SWEEP_BOUNDS';

export type StrategyProposalValidationResult = {
  readonly passed: boolean;
  readonly stages: readonly {
    readonly stage: StrategyProposalValidationStage;
    readonly passed: boolean;
    readonly violations: readonly string[];
  }[];
  readonly specificationReady: boolean;
};

function windowMs(instant: import('../../../../../domain/src/time.ts').UtcInstant): number {
  return Date.parse(instant);
}

export class StrategyProposalValidator {
  private readonly policy: StrategySafetyPolicy;

  constructor(policy: StrategySafetyPolicy = DEFAULT_STRATEGY_SAFETY_POLICY) {
    this.policy = policy;
  }

  validate(
    proposal: StrategyProposal,
    catalog: StrategyFeatureCatalog,
  ): Result<StrategyProposalValidationResult, StrategyFailure> {
    const stages: StrategyProposalValidationResult['stages'][number][] = [];

    const syntaxViolations: string[] = [];
    const spec = freezeSpecification(proposal.genome.specificationDraft);
    if (!spec.ok) {
      syntaxViolations.push(spec.error.message);
    } else {
      for (const expr of [
        spec.value.targetAllocation,
        spec.value.entryConditions,
        spec.value.exitConditions,
      ]) {
        const ast = validateStrategyAst(expr);
        if (!ast.ok) {
          syntaxViolations.push(ast.error.message);
        }
      }
      if (spec.value.instrumentUniverse.length > this.policy.maximumInstruments) {
        syntaxViolations.push('instrument universe exceeds policy maximum');
      }
      if (spec.value.transactionCosts.mode === 'ZERO_COST_SIMULATION' && this.policy.explicitCostsRequired) {
        syntaxViolations.push('explicit transaction costs required for sandbox evaluation');
      }
    }
    stages.push({
      stage: 'SYNTAX_SCHEMA',
      passed: syntaxViolations.length === 0,
      violations: Object.freeze([...syntaxViolations]),
    });

    const prohibited = collectSafetyViolations(proposal.genome);
    stages.push({
      stage: 'PROHIBITED_NODES',
      passed: prohibited.length === 0,
      violations: prohibited,
    });

    const informationViolations: string[] = [];
    if (!proposal.genome.informationTimeAttestation.usesOnlyKnowableObservations) {
      informationViolations.push('usesOnlyKnowableObservations must be true');
    }
    for (const ref of proposal.genome.informationTimeAttestation.dataRefs) {
      if (!isKnowableAt(ref.evaluationHorizonStart, ref.knowableAt)) {
        informationViolations.push(
          `feature ${ref.featureId} is not knowable at evaluation horizon start`,
        );
      }
    }
    const { train, validation, holdout } = proposal.genome.evaluationPlan;
    const trainEnd = windowMs(train.end);
    const validationStart = windowMs(validation.start);
    const validationEnd = windowMs(validation.end);
    const holdoutStart = windowMs(holdout.start);
    if (!(trainEnd <= validationStart && validationEnd <= holdoutStart)) {
      informationViolations.push('train, validation, and holdout windows must be chronological and non-overlapping');
    }
    stages.push({
      stage: 'INFORMATION_TIME',
      passed: informationViolations.length === 0,
      violations: Object.freeze([...informationViolations]),
    });

    const featureViolations: string[] = [];
    if (spec.ok) {
      for (const featureId of spec.value.requiredData) {
        if (!catalog.hasDataFeature(featureId)) {
          featureViolations.push(`missing data feature: ${featureId}`);
        }
      }
      for (const model of spec.value.requiredModels) {
        if (!catalog.hasApprovedModel(model.modelId, model.version)) {
          featureViolations.push(`missing approved model: ${model.modelId}@${model.version}`);
        }
      }
    }
    stages.push({
      stage: 'FEATURE_AVAILABILITY',
      passed: featureViolations.length === 0,
      violations: Object.freeze([...featureViolations]),
    });

    const sweepViolations: string[] = [];
    const sweep = proposal.genome.parameterSweep;
    if (sweep) {
      const expanded = expandParameterGrid(sweep);
      if (!expanded.ok) {
        sweepViolations.push(expanded.error.message);
      }
    }
    stages.push({
      stage: 'PARAMETER_SWEEP_BOUNDS',
      passed: sweepViolations.length === 0,
      violations: Object.freeze([...sweepViolations]),
    });

    const passed = stages.every((stage) => stage.passed);
    if (!passed) {
      return err({
        code: 'PROMOTION_GATE_FAILED',
        message: 'strategy proposal failed sandbox validation',
      });
    }
    return ok(
      Object.freeze({
        passed: true,
        stages: Object.freeze(stages),
        specificationReady: true,
      }),
    );
  }
}
