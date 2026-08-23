/**
 * Productized native-asset economic-control surface.
 *
 * Extends the existing authority boundary. Does not create a second
 * mint, ERC-20, or EVM dependency.
 */

export {
  CURRENT_APPLICATION_AUTHORITY,
  NATIVE_BLOCKCHAIN_AUTHORITY,
  nativeAssetAuthorityBoundary,
} from './authority.ts';
export type { AssetAuthority, NativeAssetAuthorityBoundary } from './authority.ts';
export {
  assertMigrationNotExecuted,
  developmentMigrationFixture,
} from './migration.ts';
export type { AssetMigrationManifest } from './migration.ts';
export {
  ASSET_LEDGER_KIND,
  PROTOCOL_NATIVE_ASSET_CLASS,
  canonicalNativeAsset,
  nativeAssetRegistry,
  publicTickerRemainsUnassigned,
  requireNativeAssetRecord,
} from './registry.ts';
export type { CanonicalNativeAssetRecord, NativeAssetProductStatus, NativeSupplyModel } from './registry.ts';
export {
  ECONOMIC_PARAMETER_NOT_AUTHORIZED,
  ECONOMIC_PARAMETER_UNRESOLVED,
  UNRESOLVED_MAINNET_ECONOMICS,
  economicPolicyDocument,
  hashEconomicPolicy,
  mainnetEconomicsMissing,
} from './economic-policy.ts';
export type {
  EconomicParameterState,
  UnresolvedEconomicParameter,
  VersionedEconomicPolicyDocument,
} from './economic-policy.ts';
export {
  CANONICAL_MINT_GATE,
  CANONICAL_SUPPLY_AUTHORITY,
  FORBIDDEN_SUPPLY_MUTATORS,
  LABELED_TESTNET_MOONREY_DEVELOPMENT_UNITS,
  LABELED_TESTNET_SUNREY_DEVELOPMENT_UNITS,
  PERMITTED_SUPPLY_ACTORS,
  ProtocolNativeSupplyAuthority,
  authorizedBurn,
  enforceSupplyInvariants,
  evaluateGenesisAllocation,
  evaluateHumanGovernanceGate,
  refuseForbiddenMutator,
  rejectAiEconomicApproval,
  runIsolatedEconomicSimulation,
  simulationCannotAuthorizeProduction,
  supplyAuthorityBoundary,
} from './economic-controls.ts';
export type {
  AuthorizedBurnRequest,
  BurnControlResult,
  ForbiddenSupplyMutator,
  GenesisControlResult,
  GovernanceGateResult,
  HumanGovernanceEvidence,
  IsolatedSimulationOutput,
  PermittedSupplyActor,
  SupplyActor,
  SupplyInvariantFailure,
  SupplyInvariantReport,
} from './economic-controls.ts';
export {
  ISSUANCE_PROPOSAL_SCHEMA,
  PRODUCTIVE_CATEGORY_CATALOG,
  agentCannotMint,
  createIssuanceProposal,
  evaluateOracleSafety,
  exchangeCannotChangeSupply,
  frontendCannotChangeSupply,
  issuanceAuthorityFingerprint,
  mainnetPolicyBlocksIssuance,
  refuseUnrestrictedMint,
  runMoonReyIssuancePipeline,
  runSunReyIssuancePipeline,
  separateValuationFromMarketPrice,
} from './issuance-pipelines.ts';
export type {
  ExchangeMarketPrice,
  IssuanceProposalStatus,
  NativeIssuanceProposal,
  OracleObservationQuality,
  OracleSafetyDecision,
  PipelineRefusal,
  PipelineResult,
  ProductiveCategoryId,
  ProtocolValuationInput,
} from './issuance-pipelines.ts';
export {
  AGENT_NATIVE_ECONOMY_PERMISSIONS,
  NATIVE_ECONOMY_SCHEMA,
  authorizeAgentNativeEconomyAction,
  clientNativeAssetResource,
  lovableNativeEconomyContract,
  publicSupplyApi,
} from './client-surface.ts';
export type {
  AgentNativeEconomyAction,
  ClientNativeAssetResource,
  ClientSupplySemantics,
  LovableNativeEconomyContract,
} from './client-surface.ts';
