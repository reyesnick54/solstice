import type { NativeAssetId } from '../protocol/assets.ts';

export const TESTNET_VALIDATOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type TestnetValidatorLabel = (typeof TESTNET_VALIDATOR_LABELS)[number];

export const TESTNET_NODE_ROLES = [
  'VALIDATOR',
  'SEED',
  'SENTRY',
  'PUBLIC_RPC',
  'FAUCET',
  'EXPLORER',
  'RELAYER',
] as const;
export type TestnetNodeRole = (typeof TESTNET_NODE_ROLES)[number];

export const TESTNET_INTERFACE_KINDS = [
  'CONSENSUS',
  'SENTRY_PEER',
  'OPERATOR_LOCAL',
  'PUBLIC_RPC',
] as const;
export type TestnetInterfaceKind = (typeof TESTNET_INTERFACE_KINDS)[number];

export type TestnetConsensusParams = {
  readonly maxBlockBytes: number;
  readonly maxTransactions: number;
  readonly timeoutProposeMs: number;
  readonly timeoutPrevoteMs: number;
  readonly timeoutPrecommitMs: number;
  readonly evidenceMaxAge: number;
  readonly blockIntervalMs: number;
};

export type TestnetNativeAsset = {
  readonly assetId: NativeAssetId;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly genesisSupply: bigint;
  readonly faucetAllocation: bigint;
  readonly implemented: boolean;
  readonly circulationLabel: 'TESTNET_DEVELOPMENT_UNITS';
};

export type TestnetValidatorPublic = {
  readonly validatorId: string;
  readonly operatorId: string;
  readonly consensusPublicKeyHex: string;
  readonly p2pPublicKeyHex: string;
  readonly governancePublicKeyHex: string;
  readonly cryptoSuite: string;
  readonly votingPower: bigint;
};

export type TestnetFeatureActivation = {
  readonly feature: string;
  readonly activated: boolean;
};

export type TestnetGovernancePolicy = {
  readonly version: number;
  readonly thresholdModel: 'VALIDATOR_SUPERMAJORITY';
  readonly requiredPower: bigint;
  readonly totalPower: bigint;
  readonly minActivationLead: number;
  readonly automaticBinaryUpgrade: false;
};

export type TestnetGenesisInput = {
  readonly networkId: string;
  readonly chainId: string;
  readonly displayName: string;
  readonly protocolVersion: string;
  readonly genesisTimeUnixMs: bigint;
  readonly validators: readonly TestnetValidatorPublic[];
  readonly consensus: TestnetConsensusParams;
  readonly cryptoSuitePolicy: string;
  readonly feePolicy: string;
  readonly nativeAssets: readonly TestnetNativeAsset[];
  readonly moduleRegistry: readonly string[];
  readonly governance: TestnetGovernancePolicy;
  readonly oraclePolicy: string;
  readonly faucetAuthorityId: string;
  readonly features: readonly TestnetFeatureActivation[];
  readonly environment: 'simulation';
  readonly productionNetworkEnabled: false;
};

export type TestnetGenesisBundle = {
  readonly canonicalBytesHex: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly manifest: TestnetGenesisManifest;
  readonly configuration: TestnetConfigurationBundle;
};

export type TestnetGenesisManifest = {
  readonly presentation: 'JSON_NOT_CONSENSUS';
  readonly displayName: string;
  readonly banner: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly genesisTimeUnixMs: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly validatorCount: number;
  readonly cryptoSuitePolicy: string;
  readonly feePolicy: string;
  readonly oraclePolicy: string;
  readonly faucetAuthorityId: string;
  readonly tickerStatus: 'NOT_ASSIGNED';
  readonly nativeAssets: readonly {
    readonly assetId: NativeAssetId;
    readonly tickerStatus: 'NOT_ASSIGNED';
    readonly genesisSupply: string;
    readonly faucetAllocation: string;
    readonly circulationLabel: 'TESTNET_DEVELOPMENT_UNITS';
  }[];
  readonly modules: readonly string[];
  readonly features: readonly TestnetFeatureActivation[];
  readonly governance: {
    readonly thresholdModel: 'VALIDATOR_SUPERMAJORITY';
    readonly requiredPower: string;
    readonly totalPower: string;
    readonly minActivationLead: number;
    readonly automaticBinaryUpgrade: false;
  };
  readonly environment: 'simulation';
  readonly productionNetworkEnabled: false;
  readonly monetaryValue: 'NONE';
};

export type TestnetConfigurationBundle = {
  readonly public: TestnetPublicConfiguration;
  readonly secretReferences: readonly TestnetSecretReference[];
  readonly operatorKeyHandles: readonly TestnetKeyHandle[];
};

export type TestnetPublicConfiguration = {
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: 'srtst';
  readonly sdkNetworkName: 'SUNREY_TESTNET_1';
  readonly rpcUrl: string;
  readonly explorerUrl: string;
  readonly faucetUrl: string;
  readonly genesisHash: string;
};

export type TestnetSecretReference = {
  readonly name: string;
  readonly role: TestnetNodeRole | 'FAUCET_AUTHORITY' | 'RELEASE_SIGNING';
  readonly handle: string;
  readonly containsPrivateKey: false;
};

export type TestnetKeyHandle = {
  readonly owner: string;
  readonly purpose: 'CONSENSUS' | 'P2P' | 'GOVERNANCE' | 'FAUCET' | 'OPERATOR';
  readonly handle: string;
};

export type CeremonyContribution = {
  readonly validatorId: string;
  readonly operatorId: string;
  readonly consensusPublicKeyHex: string;
  readonly p2pPublicKeyHex: string;
  readonly governancePublicKeyHex: string;
  readonly cryptoSuite: string;
  readonly votingPower: bigint;
  readonly submissionHash: string;
  readonly approved: boolean;
  readonly approvedBy: string | null;
};

export type CeremonyArtifact = {
  readonly networkId: string;
  readonly chainId: string;
  readonly contributions: readonly CeremonyContribution[];
  readonly coordinatorCollectedPrivateKeys: false;
};

export type TestnetHealth = {
  readonly network: string;
  readonly chainId: string;
  readonly banner: 'SUNREY TESTNET';
  readonly height: number;
  readonly finalizedHeight: number;
  readonly validatorParticipation: {
    readonly online: number;
    readonly total: number;
    readonly votingPowerOnline: string;
    readonly votingPowerTotal: string;
    readonly quorumSatisfied: boolean;
  };
  readonly rpcHealth: 'UP' | 'DOWN';
  readonly explorerLag: number;
  readonly faucetHealth: 'UP' | 'DOWN' | 'EMPTY';
  readonly protocolVersion: string;
  readonly genesisHash: string;
};

export type TestnetVerifyCheck = {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type TestnetVerifyReport = {
  readonly ok: boolean;
  readonly checks: readonly TestnetVerifyCheck[];
};
