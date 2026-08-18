/**
 * Chunk 61 — formal-assurance types.
 *
 * These types describe bounded TLA+/TLC models and reports. They are not a
 * second consensus engine, ledger, or verifier product.
 */

export const FORMAL_SCHEMA_VERSION = 1 as const;
export const FORMAL_OWNER = 'packages/sunrey-chain' as const;
export const FORMAL_TOOL_TLC = 'TLA+/TLC' as const;
export const FORMAL_TOOL_KANI = 'Kani' as const;
export const PINNED_TLC_VERSION = '1.8.0' as const;
export const PINNED_TLC_ARTIFACT = 'tla2tools.jar' as const;
export const PINNED_TLC_SHA256 =
  '3b8a24190c17a9097a73e827c0bf1b62e51356b14cf90a3b37f68b6c3b51c0d7' as const;
export const PINNED_KANI_VERSION = '0.65.0' as const;

export const FORMAL_MODEL_IDS = [
  'CONSENSUS_SAFETY',
  'SIGNER_SAFETY',
  'VALIDATOR_SET_TRANSITION',
  'PROTOCOL_GOVERNANCE',
  'NATIVE_ASSET_CONSERVATION',
  'FEE_CONSERVATION',
  'EXCHANGE_ATOMIC_DVP',
  'MOONREY_ISSUANCE',
  'MOONREY_POLICY_GOVERNANCE',
  'INTEROP_PACKET_STATE',
  'INTEROP_ASSET_CONSERVATION',
  'CRYPTO_POLICY_MIGRATION',
  'ADAPTIVE_FEE_MARKET',
  'VALIDATOR_ECONOMICS',
  'NATIVE_MONETARY_POLICY',
  'GENESIS_ALLOCATION_CONSERVATION',
  'GOVERNANCE_OPERATION_SAFETY',
  'PROTOCOL_TREASURY',
  'CROSS_ECONOMIC_INVARIANTS',
  'CAPABILITY_ACTIVATION_SAFETY',
  'GENESIS_EXECUTION_AUTHORIZATION',
] as const;
export type FormalModelId = (typeof FORMAL_MODEL_IDS)[number];

export const FORMAL_PROFILES = ['FORMAL_SMOKE', 'FORMAL_EXTENDED'] as const;
export type FormalProfileName = (typeof FORMAL_PROFILES)[number];

export const FORMAL_RESULTS = [
  'VERIFIED_WITHIN_MODEL_BOUNDS',
  'COUNTEREXAMPLE_FOUND',
  'TOOL_ERROR',
  'NOT_ANALYZED',
] as const;
export type FormalResultClassification = (typeof FORMAL_RESULTS)[number];

export const TRACE_DOMAINS = [
  'consensus',
  'asset',
  'exchange_dvp',
  'moonrey_issuance',
  'moonrey_policy_governance',
  'governance',
  'interop',
  'signer',
  'fee',
  'crypto_policy',
  'validator_set',
  'adaptive_fee',
  'validator_economics',
  'monetary_policy',
  'genesis_allocation',
  'governance_operations',
  'protocol_treasury',
  'cross_economic',
  'capability_activation',
  'genesis_execution',
] as const;
export type TraceDomain = (typeof TRACE_DOMAINS)[number];

export type FormalModelBounds = {
  readonly validators?: number;
  readonly maxHeight?: number;
  readonly maxRound?: number;
  readonly maxQuantity?: number;
  readonly maxOrders?: number;
  readonly maxPackets?: number;
  readonly maxEpochs?: number;
  readonly byzantineValidators?: number;
};

export type FormalModelRecord = {
  readonly modelId: FormalModelId;
  readonly modelVersion: string;
  readonly implementationReferences: readonly string[];
  readonly assumptions: readonly string[];
  readonly stateBounds: FormalModelBounds;
  readonly properties: readonly string[];
  readonly tool: typeof FORMAL_TOOL_TLC;
  readonly toolVersion: string;
  readonly lastResult: FormalResultClassification;
  readonly sourceCommit: string;
  readonly tlaModule: string;
  readonly executableTwin: string;
};

export type FormalModelRegistry = {
  readonly schemaVersion: typeof FORMAL_SCHEMA_VERSION;
  readonly owner: typeof FORMAL_OWNER;
  readonly claimLanguage: 'model checked within stated bounds';
  readonly notWholeSystemVerification: true;
  readonly selectedTool: typeof FORMAL_TOOL_TLC;
  readonly selectedToolVersion: string;
  readonly rustBoundedTool: typeof FORMAL_TOOL_KANI;
  readonly rustBoundedToolVersion: string;
  readonly models: readonly FormalModelRecord[];
};

export type PropertyCheck = {
  readonly property: string;
  readonly result: FormalResultClassification;
  readonly statesExplored: number;
  readonly counterexampleRef: string | null;
};

export type ModelCheckResult = {
  readonly modelId: FormalModelId;
  readonly modelVersion: string;
  readonly tool: string;
  readonly toolVersion: string;
  readonly profile: FormalProfileName;
  readonly bounds: FormalModelBounds;
  readonly properties: readonly PropertyCheck[];
  readonly statesExplored: number;
  readonly result: FormalResultClassification;
  readonly counterexampleRef: string | null;
};

export type TraceConformanceResult = {
  readonly domain: TraceDomain;
  readonly tracesChecked: number;
  readonly aligned: boolean;
  readonly note: 'trace conformance is evidence of alignment; it is not a mathematical proof that implementation and model are equivalent';
};

export type FormalVerificationReport = {
  readonly schemaVersion: typeof FORMAL_SCHEMA_VERSION;
  readonly sourceCommit: string;
  readonly profile: FormalProfileName;
  readonly toolVersions: {
    readonly tlc: string;
    readonly kani: string;
    readonly executableTwin: 'sunrey-formal-explicit-state/1';
  };
  readonly generatedAtUtc: string;
  readonly models: readonly ModelCheckResult[];
  readonly implementationTraceResult: readonly TraceConformanceResult[];
  readonly rustBoundedChecks: readonly {
    readonly harness: string;
    readonly result: FormalResultClassification;
  }[];
  readonly claim: 'model checked within stated bounds';
  readonly notWholeSystemVerification: true;
};

export type LogicalTraceEvent = {
  readonly domain: TraceDomain;
  readonly action: string;
  readonly args: Readonly<Record<string, string | number | boolean | null>>;
};

export type LogicalTrace = {
  readonly id: string;
  readonly domain: TraceDomain;
  readonly modelId: FormalModelId;
  readonly events: readonly LogicalTraceEvent[];
};

export type CounterexampleRecord = {
  readonly modelId: FormalModelId;
  readonly property: string;
  readonly stateTrace: readonly string[];
  readonly seed: string;
  readonly config: FormalProfileName;
  readonly explanation: string;
  readonly implementationImpact: string;
  readonly regressionTest: string;
};

export type FormalProfile = {
  readonly name: FormalProfileName;
  readonly consensusValidators: number;
  readonly consensusMaxHeight: number;
  readonly consensusMaxRound: number;
  readonly byzantineValidators: number;
  readonly maxQuantity: number;
  readonly maxOrders: number;
  readonly maxPackets: number;
  readonly maxEpochs: number;
};
