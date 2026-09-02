export {
  ACTIVE_DEPLOYABLE_NETWORK,
  MAINNET_INACTIVE,
  NETWORK_ENVIRONMENTS,
  NETWORK_REGISTRY,
  canonicalIdentity,
  identityFor,
  rejectCrossNetworkReplay,
  replayBinding,
} from './identity.ts';
export type { NetworkEnvironment, NetworkIdentity } from './identity.ts';

export {
  ENVIRONMENT_MATRIX,
  RUNTIME_ENVIRONMENT_LABEL,
  assertEnvironmentBinding,
  assertResourceIsolation,
  developmentSignatureInvalidOnMainnet,
  matrixRow,
} from './environment.ts';
export type {
  EnvironmentBindingCheck,
  EnvironmentMatrixRow,
  IsolationResource,
  ResourceIsolationCheck,
} from './environment.ts';

export {
  NODE_ROLES,
  PRODUCTION_PRIVATE_KEYS_COMMITTED as NODE_ROLE_KEYS_NOT_COMMITTED,
  nodeRoleConfig,
  validateNodeRoleConfig,
} from './node-roles.ts';
export type { NodeRole, NodeRoleConfig, NodeRoleValidation } from './node-roles.ts';

export {
  READINESS_PROBE_PATHS,
  evaluateRuntimeHealth,
  evaluateRuntimeReadiness,
} from './readiness.ts';
export type {
  RuntimeHealthStatus,
  RuntimeReadinessCheck,
  RuntimeReadinessInput,
  RuntimeReadinessReport,
} from './readiness.ts';

export {
  FUTURE_UPGRADE_REQUIREMENTS,
  PROTOCOL_UPGRADE_POLICY,
  SUPPORTED_PROTOCOL_VERSIONS,
  assertProtocolCompatible,
} from './protocol-version.ts';
export type {
  ProtocolCompatibilityResult,
  SupportedProtocolVersion,
  UpgradeMechanismRequirements,
} from './protocol-version.ts';

export {
  evaluateMainnetRuntimeGate,
  refuseMainnetRuntimeAction,
} from './mainnet-gate.ts';
export type {
  MainnetRuntimeAction,
  MainnetRuntimeBlocker,
  MainnetRuntimeGate,
  MainnetGateStatus,
} from './mainnet-gate.ts';

export {
  RUNTIME_SECURITY_DEFAULTS,
  assertKeyFilePermissions,
  assertSafeLogPayload,
  defaultSecurityConfig,
  validateSecurityConfig,
} from './security.ts';
export type { RuntimeSecurityConfig, SecurityValidationResult } from './security.ts';

export {
  CRYPTO_SUITE,
  DETERMINISTIC_CODEC,
  TRANSACTION_FIELDS,
  addressRelatesToPublicKey,
  requiredFieldsPresent,
} from './transaction.ts';
export type { CanonicalTransactionView, TransactionValidationFailure } from './transaction.ts';

export {
  FINALITY_SOURCES,
  TRANSACTION_FINALITY,
  classifyFinality,
  observeTransaction,
} from './finality.ts';
export type { FinalitySource, TransactionFinality, TransactionObservation } from './finality.ts';

export { DEFAULT_MEMPOOL_POLICY, admitToMempool, selectByFeePriority } from './mempool.ts';
export type { MempoolAdmission, MempoolPolicy } from './mempool.ts';

export {
  ALLOWED_OPERATOR_TRANSITIONS,
  OPERATOR_LIFECYCLE,
  PROTOCOL_STATUSES,
  refuseMainnetActivation,
  toOperatorLifecycle,
} from './validator.ts';
export type {
  OperatorLifecycle,
  ProtocolValidatorStatus,
  ValidatorProductRecord,
} from './validator.ts';

export {
  FORBIDDEN_PUBLIC_RPC_METHODS,
  PUBLIC_RPC_METHODS,
  PUBLIC_RPC_SECURITY,
  RPC_PLANES,
  VALIDATOR_RPC_METHODS,
  allowRequest,
  methodAllowedOnPlane,
} from './rpc.ts';
export type { RateLimitState, RpcPlane, RpcSecurityPolicy } from './rpc.ts';

export { generateGenesis, mainnetGenesisFailsClosed } from './genesis.ts';
export type { GenesisGenerationInput, GenesisGenerationResult } from './genesis.ts';

export {
  KEY_ROLES,
  PRODUCTION_PRIVATE_KEYS_COMMITTED,
  assertSeparatedRoles,
  rotateReference,
} from './keys.ts';
export type { KeyReference, KeyRole } from './keys.ts';

export {
  EXPLORER_API_ROUTES,
  EXPLORER_AUTHORITATIVE,
  EXPLORER_OWNER,
  explorerStatistics,
} from './explorer.ts';
export type { ExplorerNetworkStatistics } from './explorer.ts';

export { RUNTIME_METRICS, metricSample } from './observability.ts';
export type { RuntimeMetricName, RuntimeMetricSample } from './observability.ts';

export { RECOVERY_PROCEDURES, recoveryPlan, snapshotTrust } from './recovery.ts';
export type { RecoveryPlan, RecoveryProcedure } from './recovery.ts';

export {
  DEPLOYMENT_PROFILES_BY_ENVIRONMENT,
  DEVNET_DEPLOYMENT_PROFILES,
  INFRA_PRODUCTION_CANDIDATE_ROOT,
  LOCAL_DEPLOYMENT_PROFILES,
  MAINNET_DEPLOYMENT_PROFILES,
  MULTI_VALIDATOR_DEVNET,
  NODE_TYPES,
  STAGING_DEPLOYMENT_PROFILES,
  TESTNET_DEPLOYMENT_PROFILES,
  TESTNET_DEPLOY_ROOT,
} from './deployment.ts';
export type { DeploymentProfile, MultiValidatorDevnetSpec, NodeType } from './deployment.ts';

export { CHAOS_SCENARIOS, evaluateChaos, runChaosSuite } from './chaos.ts';
export type { ChaosOutcome, ChaosScenario } from './chaos.ts';

export const PHASE_G_03_RUNTIME = {
  owner: 'packages/sunrey-chain',
  rustProtocol: 'packages/sunrey-chain/rust',
  rustP2pNode: 'packages/sunrey-chain/node',
  consensus: 'packages/sunrey-chain/rust/crates/consensus',
  mainnetActive: false,
  testnetActive: true,
  replacedByEthereumOrEvm: false,
} as const;

export const WAVE2_PRODUCTION_RUNTIME = {
  owner: 'packages/sunrey-chain/src/runtime',
  schema: 'sunrey.chain.wave2.runtime.v1',
  mainnetActive: false,
  productionEconomicsAuthorized: false,
  environmentIsolation: true,
  nodeRoleSeparation: true,
  healthReadinessSemantics: true,
  observability: true,
  securityHardening: true,
  protocolVersioning: true,
  mainnetFailClosedGate: true,
  documentation: [
    'docs/architecture/WAVE2_PRODUCTION_RUNTIME.md',
    'docs/runbooks/SUNREY_NODE_OPERATIONS.md',
  ],
} as const;
