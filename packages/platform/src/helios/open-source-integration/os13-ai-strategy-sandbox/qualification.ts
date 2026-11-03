import {
  HELIOS_OS13_AI_STRATEGY_SANDBOX_BLOCKED,
  HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED,
} from './taxonomy.ts';

export type AiStrategySandboxQualificationChecks = {
  readonly proposalValidationStages: boolean;
  readonly prohibitedNodesBlocked: boolean;
  readonly informationTimeEnforced: boolean;
  readonly featureAvailabilityChecked: boolean;
  readonly boundedParameterSweep: boolean;
  readonly trainValidationHoldoutRequired: boolean;
  readonly walkForwardRequired: boolean;
  readonly explicitCostsRequired: boolean;
  readonly coverageAndRegimeRequired: boolean;
  readonly noDeployFromSandbox: boolean;
  readonly noPromoteOnMaxReturnOnly: boolean;
  readonly evidenceSealed: boolean;
  readonly humanPromotionRequired: boolean;
};

export type AiStrategySandboxQualificationResult = {
  readonly marker:
    | typeof HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED
    | typeof HELIOS_OS13_AI_STRATEGY_SANDBOX_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAiStrategySandboxQualification(
  checks: AiStrategySandboxQualificationChecks,
): AiStrategySandboxQualificationResult {
  const entries = Object.entries(checks) as Array<[keyof AiStrategySandboxQualificationChecks, boolean]>;
  const blockers = entries.filter(([, passed]) => !passed).map(([key]) => key);
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_OS13_AI_STRATEGY_SANDBOX_QUALIFIED : HELIOS_OS13_AI_STRATEGY_SANDBOX_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
