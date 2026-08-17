/**
 * Chunk 71 — SunRey dual-native-asset monetary constitution types.
 *
 * Canonical owner: packages/sunrey-chain. This is not a second
 * blockchain, native-asset ledger, Exchange, wallet, governance
 * system, or genesis system. Production quantities remain
 * UNCONFIGURED. Tickers remain NOT_ASSIGNED.
 */

export const MONETARY_CONSTITUTION_SCHEMA_VERSION = 1 as const;
export const MONETARY_CONSTITUTION_TOOL_VERSION = 'sunrey-economics/1' as const;
export const MONETARY_POLICY_VERSION_ID = 'sunrey.monetary.constitution.v1' as const;
export const TICKER_STATUS_NOT_ASSIGNED = 'NOT_ASSIGNED' as const;
export const PRODUCTION_PARAMETER_UNCONFIGURED = 'UNCONFIGURED' as const;
export const ENGINEERING_SIMULATION = 'ENGINEERING_SIMULATION' as const;
export const REHEARSAL_ONLY = 'REHEARSAL_ONLY' as const;
export const PROTOCOL_TREASURY_CLASS = 'SUNREY_BLOCKCHAIN_TREASURY' as const;

export const NATIVE_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type NativeMonetaryAssetId = (typeof NATIVE_ASSET_IDS)[number];

export const MONETARY_POLICY_STATES = [
  'DRAFT',
  'DEVELOPMENT_ACTIVE',
  'TESTNET_ACTIVE',
  'PRODUCTION_CANDIDATE',
  'SUPERSEDED',
] as const;
export type MonetaryPolicyState = (typeof MONETARY_POLICY_STATES)[number];

export const SUPPLY_CLASSIFICATIONS = [
  'GENESIS_ALLOCATED',
  'ISSUED_POST_GENESIS',
  'CIRCULATING',
  'LOCKED',
  'ESCROWED',
  'FEE_RESERVED',
  'BURNED',
] as const;
export type SupplyClassification = (typeof SUPPLY_CLASSIFICATIONS)[number];

export const LIVE_SUPPLY_CLASSES = ['CIRCULATING', 'LOCKED', 'ESCROWED', 'FEE_RESERVED'] as const;
export type LiveSupplyClass = (typeof LIVE_SUPPLY_CLASSES)[number];

export const SOURCE_SUPPLY_CLASSES = ['GENESIS_ALLOCATED', 'ISSUED_POST_GENESIS'] as const;
export type SourceSupplyClass = (typeof SOURCE_SUPPLY_CLASSES)[number];

export const GENESIS_DISTRIBUTION_CATEGORIES = [
  'NETWORK_SECURITY',
  'ECOSYSTEM',
  'TREASURY',
  'USER_DISTRIBUTION',
  'PRODUCTIVE_ECONOMY',
  'RESERVE',
  'OTHER_GOVERNED_CATEGORY',
] as const;
export type GenesisDistributionCategory = (typeof GENESIS_DISTRIBUTION_CATEGORIES)[number];

export const SUNREY_ISSUANCE_CLASSES = [
  'GENESIS_ONLY',
  'GOVERNED_ISSUANCE',
  'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
] as const;
export type SunReyIssuanceClass = (typeof SUNREY_ISSUANCE_CLASSES)[number];

export const MOONREY_ISSUANCE_CLASSES = ['VERIFIED_PRODUCTIVE_CONTRIBUTION'] as const;
export type MoonReyIssuanceClass = (typeof MOONREY_ISSUANCE_CLASSES)[number];

export type IssuanceClass = SunReyIssuanceClass | MoonReyIssuanceClass;

export const BURN_CLASSES = ['VOLUNTARY_USER_BURN', 'FEE_BURN', 'PROTOCOL_ECONOMIC_PENALTY'] as const;
export type BurnClass = (typeof BURN_CLASSES)[number];

export const NATIVE_LOCK_CLASSES = [
  'ORDER_RESERVATION',
  'MACHINE_ESCROW',
  'INTEROP_ESCROW',
  'VALIDATOR_BOND',
  'OTHER_GOVERNED_LOCK',
] as const;
export type NativeLockClass = (typeof NATIVE_LOCK_CLASSES)[number];

export const HUMAN_EVIDENCE_PURPOSE_CLASSES = [
  'CONSENT_SCOPED_INFORMATION_RIGHT_SETTLEMENT',
  'VERIFIED_HUMAN_ECONOMIC_CONTRIBUTION',
  'VERIFIED_COMMUNITY_CONTRIBUTION',
  'AUTHORIZED_ECONOMIC_PARTICIPATION_EVENT',
] as const;
export type HumanEvidencePurposeClass = (typeof HUMAN_EVIDENCE_PURPOSE_CLASSES)[number];

export const AUTHORIZATION_SOURCES = [
  'GENESIS_ALLOCATION_MANIFEST',
  'PROTOCOL_GOVERNANCE',
  'MOONREY_PRODUCTIVE_AUTHORIZATION',
  'DEVELOPMENT_GOVERNED_SIMULATION',
] as const;
export type AuthorizationSource = (typeof AUTHORIZATION_SOURCES)[number];

export const AUTHORITY_ACTIVATION_STATES = [
  'INACTIVE',
  'DEVELOPMENT_ACTIVE',
  'TESTNET_ACTIVE',
  'PRODUCTION_UNCONFIGURED',
] as const;
export type AuthorityActivationState = (typeof AUTHORITY_ACTIVATION_STATES)[number];

export const FEE_ELIGIBILITY_STATES = ['ELIGIBLE', 'NOT_ELIGIBLE', 'POLICY_DISABLED'] as const;
export type FeeEligibilityState = (typeof FEE_ELIGIBILITY_STATES)[number];

export const ASSET_PURPOSES = {
  SUNREY_COIN: 'HUMAN_ECONOMIC_LAYER',
  MOONREY_COIN: 'AUTONOMOUS_PRODUCTIVE_ECONOMY',
} as const;

export type UnconfiguredQuantity = typeof PRODUCTION_PARAMETER_UNCONFIGURED;

export type SupplyConstraint = {
  readonly maximumSupply: UnconfiguredQuantity;
  readonly genesisSupply: bigint | UnconfiguredQuantity;
  readonly postGenesisIssuanceEnabled: boolean;
  readonly productionIssuanceActivated: false;
};

export type GenesisSupplyPolicy = {
  readonly policyVersion: string;
  readonly productionAllocationAuthorized: false;
  readonly defaultGenesisQuantity: 0n;
  readonly zeroUnlessApprovedManifest: true;
  readonly testnetMigrationForbidden: true;
  readonly rehearsalMigrationForbidden: true;
  readonly faucetMigrationForbidden: true;
  readonly automaticLedgerMigrationForbidden: true;
  readonly hiddenPremintForbidden: true;
  readonly categories: readonly GenesisDistributionCategory[];
};

export type IssuancePolicy = {
  readonly policyVersion: string;
  readonly permittedClasses: readonly IssuanceClass[];
  readonly productionActivation: UnconfiguredQuantity;
  readonly unrestrictedMintForbidden: true;
  readonly aiAuthorizationForbidden: true;
  readonly oracleObservationCannotMint: true;
  readonly verifiedFactAloneCannotMint: true;
  readonly pdvConsentCleanRoomCannotMint: true;
};

export type BurnPolicy = {
  readonly policyVersion: string;
  readonly permittedClasses: readonly BurnClass[];
  readonly validatorMisconductCannotBurnCustomerAssets: true;
  readonly onlyImplementedAuthorizedClassesActive: true;
};

export type MonetaryPolicyVersion = {
  readonly versionId: string;
  readonly schemaVersion: typeof MONETARY_CONSTITUTION_SCHEMA_VERSION;
  readonly state: MonetaryPolicyState;
  readonly activationHeight: bigint | UnconfiguredQuantity;
  readonly supersededBy: string | null;
  readonly historicalPolicyReference: string;
  readonly governanceReference: string;
};

export type NativeAssetMonetaryPolicy = {
  readonly assetId: NativeMonetaryAssetId;
  readonly assetPurpose: (typeof ASSET_PURPOSES)[NativeMonetaryAssetId];
  readonly displayName: 'SunRey Coin' | 'MoonRey Coin';
  readonly precision: 6;
  readonly tickerStatus: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly policyVersion: MonetaryPolicyVersion;
  readonly policyState: MonetaryPolicyState;
  readonly genesisPolicy: GenesisSupplyPolicy;
  readonly issuancePolicy: IssuancePolicy;
  readonly burnPolicy: BurnPolicy;
  readonly permittedIssuanceClasses: readonly IssuanceClass[];
  readonly permittedBurnClasses: readonly BurnClass[];
  readonly feeEligibility: FeeEligibilityState;
  readonly governanceAuthority: 'SUNREY_PROTOCOL_GOVERNANCE';
  readonly supplyConstraints: SupplyConstraint;
  readonly policyActivationHeight: bigint | UnconfiguredQuantity;
  readonly historicalPolicyReference: string;
};

export type NativeAssetConstitution = {
  readonly schemaVersion: typeof MONETARY_CONSTITUTION_SCHEMA_VERSION;
  readonly constitutionId: 'sunrey.native-asset-constitution.v1';
  readonly toolVersion: typeof MONETARY_CONSTITUTION_TOOL_VERSION;
  readonly tickerStatus: typeof TICKER_STATUS_NOT_ASSIGNED;
  readonly productionMainnetUnavailable: true;
  readonly productionEconomicActivationUnavailable: true;
  readonly assets: readonly NativeAssetMonetaryPolicy[];
};

export type MonetaryPolicyRegistry = {
  readonly schemaVersion: typeof MONETARY_CONSTITUTION_SCHEMA_VERSION;
  readonly owner: 'packages/sunrey-chain';
  readonly activeVersionId: string;
  readonly versions: readonly MonetaryPolicyVersion[];
  readonly constitution: NativeAssetConstitution;
  readonly history: readonly MonetaryPolicyHistoryRecord[];
};

export type MonetaryPolicyHistoryRecord = {
  readonly versionId: string;
  readonly state: MonetaryPolicyState;
  readonly recordedAtHeight: bigint;
  readonly governanceReference: string;
  readonly changeClass:
    | 'ISSUANCE_MODE'
    | 'SUPPLY_CONSTRAINT'
    | 'BURN_RULE'
    | 'FEE_ELIGIBILITY'
    | 'GENESIS_POLICY'
    | 'DISTRIBUTION_CATEGORY';
  readonly note: string;
};

export type HumanEconomicEvidence = {
  readonly evidenceId: string;
  readonly policyVersion: string;
  readonly authorizationId: string;
  readonly contentHash: string;
  readonly quantityBasis: bigint;
  readonly purposeClass: HumanEvidencePurposeClass;
  readonly rawPersonalDataPresent: false;
  readonly pdvSourceExposed: false;
  readonly cleanRoomSourceExposed: false;
};

export type MonetaryIssuanceAuthority = {
  readonly authorityId: string;
  readonly assetId: NativeMonetaryAssetId;
  readonly issuanceClass: IssuanceClass;
  readonly monetaryPolicyVersion: string;
  readonly authorizationSource: AuthorizationSource;
  readonly recipient: string;
  readonly economicEvidence: HumanEconomicEvidence | MoonReyProductiveEvidence | GenesisEvidence;
  readonly quantity: bigint;
  readonly quantityCeiling: bigint;
  readonly epoch: number;
  readonly timeDomain: 'HEIGHT' | 'EPOCH';
  readonly replayIdentifier: string;
  readonly activationState: AuthorityActivationState;
  readonly actorKind: 'HUMAN' | 'PROTOCOL' | 'AI' | 'AGENT';
  readonly authorized: boolean;
};

export type MoonReyProductiveEvidence = {
  readonly evidenceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION';
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly authorizationId: string;
  readonly policyVersion: string;
  readonly moonreyIssuanceAuthorizationRequired: true;
  readonly oracleObservationAloneInsufficient: true;
  readonly verifiedFactAloneInsufficient: true;
};

export type GenesisEvidence = {
  readonly evidenceClass: 'GENESIS_ALLOCATION_MANIFEST';
  readonly manifestHash: string;
  readonly category: GenesisDistributionCategory;
  readonly categoryVersion: string;
};

export type NativeSupplySnapshot = {
  readonly assetId: NativeMonetaryAssetId;
  readonly policyVersion: string;
  readonly genesisAllocated: bigint;
  readonly issuedPostGenesis: bigint;
  readonly burned: bigint;
  readonly circulating: bigint;
  readonly locked: bigint;
  readonly escrowed: bigint;
  readonly feeReserved: bigint;
  readonly expectedTotal: bigint;
  readonly observedTotal: bigint;
};

export type NativeSupplyAuditReport = {
  readonly schemaVersion: typeof MONETARY_CONSTITUTION_SCHEMA_VERSION;
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly policyVersion: string;
  readonly assets: readonly (NativeSupplySnapshot & {
    readonly reconciliation: 'EXACT' | 'MISMATCH';
    readonly notes: string;
  })[];
  readonly ok: boolean;
};

export type MonetaryPolicyAuditReport = {
  readonly schemaVersion: typeof MONETARY_CONSTITUTION_SCHEMA_VERSION;
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export type ProtocolTreasuryAccount = {
  readonly classification: typeof PROTOCOL_TREASURY_CLASS;
  readonly distinctFromFiatTreasuryPackage: true;
  readonly fiatTreasuryOwner: 'packages/treasury';
  readonly accountId: string;
  readonly assetId: NativeMonetaryAssetId;
};

export type ConcentrationAnalysis = {
  readonly classification: typeof ENGINEERING_SIMULATION;
  readonly accountConcentration: readonly { readonly account: string; readonly quantity: bigint; readonly shareNumerator: bigint; readonly shareDenominator: bigint }[];
  readonly categoryConcentration: readonly { readonly category: GenesisDistributionCategory; readonly quantity: bigint }[];
  readonly issuanceAuthorityConcentration: readonly { readonly source: AuthorizationSource; readonly quantity: bigint }[];
  readonly genesisConcentration: readonly { readonly category: GenesisDistributionCategory; readonly quantity: bigint }[];
  readonly legalOrPoliticalConclusion: null;
};

export type MonetarySimulationClassification = typeof ENGINEERING_SIMULATION;
