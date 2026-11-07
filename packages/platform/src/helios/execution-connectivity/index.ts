/**
 * HELIOS execution connectivity — broker protocol, routing, measurement, submission safety, and EXEC15 qualification.
 */

export * from './exec01/index.ts';
export * from './exec02/index.ts';
export * from './exec03/index.ts';
export * from './pretrade-firewall/index.ts';
export * from './exec05/index.ts';
export * from './exec06/index.ts';
export * from './exec07/index.ts';
export * from './exec09/index.ts';
export * from './exec10/index.ts';
export * from './exec11/index.ts';
export * from './exec12/index.ts';
export * from './exec13/index.ts';
export * from './exec14/index.ts';

export {
  HELIOS_EXECUTION_CONNECTIVITY_SCHEMA,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_BLOCKED,
  HELIOS_BROKER_CUSTODY_EXECUTION_V1_QUALIFIED,
  EXEC_WORK_PACKAGES,
  EXECUTION_PROVIDER_STATUSES,
  EXEC15_E2E_PIPELINE_STAGES,
  EXEC15_ADVERSARIAL_SCENARIO_IDS,
  type ExecWorkPackageId,
  type ExecutionProviderStatus,
  type Exec15E2ePipelineStage,
  type Exec15AdversarialScenarioId,
} from './taxonomy.ts';

export { listExecWorkPackages, type ExecWorkPackageRow } from './work-package-registry.ts';

export {
  describeExecutionConnectivityRealityPosture,
  assertExecutionConnectivityRealitySafe,
  type ExecutionConnectivityRealityPosture,
} from './reality-gate.ts';

export {
  runExec15SyntheticE2ePipeline,
  type Exec15E2ePipelineStageResult,
  type Exec15E2ePipelineResult,
} from './e2e-pipeline.ts';

export {
  runExec15AdversarialScenario,
  runAllExec15AdversarialScenarios,
  evaluatePreTradeMandateBlock,
  evaluateBuyingPowerLimit,
  evaluateEffectiveBuyingPower,
  evaluateReconciliationBreak,
  evaluateMidExecutionMarketDataPolicy,
  evaluateKillSwitchBlocksNewOrders,
  evaluateFailoverDuplicateGuard,
  evaluateAiWithdrawalAfterTrade,
  evaluateSettlementFailureState,
  assertExecutionSurfacesDisabledInAdversarialSuite,
  type Exec15AdversarialScenarioResult,
} from './adversarial-qualification.ts';

export {
  evaluateExecutionConnectivityQualification,
  type ExecutionConnectivityQualificationInput,
  type ExecutionConnectivityQualificationResult,
} from './exec15-qualification.ts';
