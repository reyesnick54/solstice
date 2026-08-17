/**
 * sunrey-genesis — deterministic testnet genesis builder.
 *
 * Same canonical inputs produce the same genesis hash.
 * JSON presentation is not consensus serialization.
 */

import { encodeBool, encodeString, encodeU32, encodeU64, sha256Hex } from '../validators/canonical.ts';
import {
  SUNREY_TESTNET_1_BANNER,
  SUNREY_TESTNET_1_CHAIN_ID,
  SUNREY_TESTNET_1_DISPLAY_NAME,
  SUNREY_TESTNET_1_NETWORK_ID,
  SUNREY_TESTNET_1_SDK_NAME,
  TESTNET_ADDRESS_HRP,
  TESTNET_ENVIRONMENT,
  TESTNET_PRODUCTION_NETWORK_ENABLED,
  TESTNET_PROTOCOL_VERSION,
  TESTNET_TICKER_STATUS,
  isForbiddenReusedNetworkId,
} from './identity.ts';
import {
  TESTNET_BFT_QUORUM_POWER,
  faucetAuthorityLabel,
  sevenValidatorFixture,
  testnetGovernancePolicy,
} from './validators.ts';
import type {
  TestnetConfigurationBundle,
  TestnetGenesisBundle,
  TestnetGenesisInput,
  TestnetGenesisManifest,
  TestnetNativeAsset,
  TestnetValidatorPublic,
} from './types.ts';

export const GENESIS_DOMAIN = 'SUNREY_TESTNET_GENESIS_V1' as const;
export const GENESIS_TAG = 'GenesisTestnetV1' as const;
export const VALIDATOR_SET_DOMAIN = 'SUNREY_TESTNET_VALSET_V1' as const;
export const GENESIS_TOOL_VERSION = 'sunrey-genesis/1' as const;

/** Explicit, stable fixture genesis time: 2024-01-01T00:00:00.000Z */
export const TESTNET_1_FIXTURE_GENESIS_TIME_MS = 1_704_067_200_000n;

export const TESTNET_CRYPTO_SUITE_POLICY = 'sunrey.cryptopolicy.testnet.ed25519.v1' as const;
export const TESTNET_FEE_POLICY = 'sunrey.fees.testnet.v1' as const;
export const TESTNET_ORACLE_POLICY = 'sunrey.oracle.testnet.simulation.v1' as const;
export const TESTNET_FAUCET_AUTHORITY_ID = 'auth.testnet.1.faucet' as const;

export const TESTNET_SUNREY_FAUCET_ALLOCATION = 1_000_000_000_000n;
export const TESTNET_MOONREY_FAUCET_ALLOCATION = 100_000_000_000n;

export const TESTNET_MODULE_REGISTRY = Object.freeze([
  'native-assets',
  'fees',
  'governance',
  'oracle',
  'productive',
  'wallet',
  'interop',
]);

export const TESTNET_FEATURES = Object.freeze([
  { feature: 'NATIVE_SUNREY_COIN', activated: true },
  { feature: 'NATIVE_MOONREY_COIN', activated: true },
  { feature: 'DEVELOPMENT_FAUCET', activated: true },
  { feature: 'PUBLIC_STAKING', activated: false },
  { feature: 'PRODUCTION_BANKING_RAILS', activated: false },
  { feature: 'MAINNET', activated: false },
]);

export function testnetNativeAssets(): readonly TestnetNativeAsset[] {
  return Object.freeze([
    Object.freeze({
      assetId: 'SUNREY_COIN' as const,
      tickerStatus: TESTNET_TICKER_STATUS,
      genesisSupply: 0n,
      faucetAllocation: TESTNET_SUNREY_FAUCET_ALLOCATION,
      implemented: true,
      circulationLabel: 'TESTNET_DEVELOPMENT_UNITS' as const,
    }),
    Object.freeze({
      assetId: 'MOONREY_COIN' as const,
      tickerStatus: TESTNET_TICKER_STATUS,
      genesisSupply: 0n,
      faucetAllocation: TESTNET_MOONREY_FAUCET_ALLOCATION,
      implemented: true,
      circulationLabel: 'TESTNET_DEVELOPMENT_UNITS' as const,
    }),
  ]);
}

export function defaultTestnetConsensus() {
  return Object.freeze({
    maxBlockBytes: 512_000,
    maxTransactions: 64,
    timeoutProposeMs: 200,
    timeoutPrevoteMs: 200,
    timeoutPrecommitMs: 200,
    evidenceMaxAge: 10_000,
    blockIntervalMs: 1_000,
  });
}

function sortedValidators(validators: readonly TestnetValidatorPublic[]): TestnetValidatorPublic[] {
  return [...validators].sort((a, b) => (a.validatorId < b.validatorId ? -1 : a.validatorId > b.validatorId ? 1 : 0));
}

export function encodeValidatorSet(validators: readonly TestnetValidatorPublic[]): Buffer {
  const ordered = sortedValidators(validators);
  const parts = [encodeString(VALIDATOR_SET_DOMAIN), encodeU32(ordered.length)];
  for (const row of ordered) {
    parts.push(
      encodeString(row.validatorId),
      encodeString(row.operatorId),
      encodeString(row.consensusPublicKeyHex),
      encodeString(row.p2pPublicKeyHex),
      encodeString(row.governancePublicKeyHex),
      encodeString(row.cryptoSuite),
      encodeU64(row.votingPower),
    );
  }
  return Buffer.concat(parts);
}

export function validatorSetHash(validators: readonly TestnetValidatorPublic[]): string {
  return sha256Hex(encodeValidatorSet(validators));
}

export function encodeGenesisInput(input: TestnetGenesisInput): Buffer {
  if (isForbiddenReusedNetworkId(input.networkId)) {
    throw new TypeError(`testnet genesis must not reuse development network id ${input.networkId}`);
  }
  if (input.productionNetworkEnabled) {
    throw new TypeError('testnet genesis cannot enable a production network');
  }
  if (input.environment !== 'simulation') {
    throw new TypeError('testnet genesis environment must remain simulation');
  }
  const validators = sortedValidators(input.validators);
  const assets = [...input.nativeAssets].sort((a, b) => a.assetId.localeCompare(b.assetId));
  const modules = [...input.moduleRegistry].sort();
  const features = [...input.features].sort((a, b) => a.feature.localeCompare(b.feature));
  const parts = [
    encodeString(GENESIS_TAG),
    encodeString(input.networkId),
    encodeString(input.chainId),
    encodeString(input.displayName),
    encodeString(input.protocolVersion),
    encodeU64(input.genesisTimeUnixMs),
    encodeString(input.cryptoSuitePolicy),
    encodeString(input.feePolicy),
    encodeString(input.oraclePolicy),
    encodeString(input.faucetAuthorityId),
    encodeBool(input.productionNetworkEnabled),
    encodeString(input.environment),
    encodeU32(input.consensus.maxBlockBytes),
    encodeU32(input.consensus.maxTransactions),
    encodeU32(input.consensus.timeoutProposeMs),
    encodeU32(input.consensus.timeoutPrevoteMs),
    encodeU32(input.consensus.timeoutPrecommitMs),
    encodeU32(input.consensus.evidenceMaxAge),
    encodeU32(input.consensus.blockIntervalMs),
    encodeU32(validators.length),
  ];
  for (const row of validators) {
    parts.push(
      encodeString(row.validatorId),
      encodeString(row.operatorId),
      encodeString(row.consensusPublicKeyHex),
      encodeString(row.p2pPublicKeyHex),
      encodeString(row.governancePublicKeyHex),
      encodeString(row.cryptoSuite),
      encodeU64(row.votingPower),
    );
  }
  parts.push(encodeU32(assets.length));
  for (const asset of assets) {
    parts.push(
      encodeString(asset.assetId),
      encodeString(asset.tickerStatus),
      encodeU64(asset.genesisSupply),
      encodeU64(asset.faucetAllocation),
      encodeBool(asset.implemented),
      encodeString(asset.circulationLabel),
    );
  }
  parts.push(encodeU32(modules.length));
  for (const module of modules) {
    parts.push(encodeString(module));
  }
  parts.push(encodeU32(features.length));
  for (const feature of features) {
    parts.push(encodeString(feature.feature), encodeBool(feature.activated));
  }
  parts.push(
    encodeString(input.governance.thresholdModel),
    encodeU64(input.governance.requiredPower),
    encodeU64(input.governance.totalPower),
    encodeU32(input.governance.minActivationLead),
    encodeBool(input.governance.automaticBinaryUpgrade),
  );
  const body = Buffer.concat(parts);
  return Buffer.concat([encodeString(GENESIS_DOMAIN), body]);
}

export function genesisHashOf(input: TestnetGenesisInput): string {
  return sha256Hex(encodeGenesisInput(input));
}

export function testnet1GenesisInput(validators: readonly TestnetValidatorPublic[] = sevenValidatorFixture()): TestnetGenesisInput {
  return Object.freeze({
    networkId: SUNREY_TESTNET_1_NETWORK_ID,
    chainId: SUNREY_TESTNET_1_CHAIN_ID,
    displayName: SUNREY_TESTNET_1_DISPLAY_NAME,
    protocolVersion: TESTNET_PROTOCOL_VERSION,
    genesisTimeUnixMs: TESTNET_1_FIXTURE_GENESIS_TIME_MS,
    validators,
    consensus: defaultTestnetConsensus(),
    cryptoSuitePolicy: TESTNET_CRYPTO_SUITE_POLICY,
    feePolicy: TESTNET_FEE_POLICY,
    nativeAssets: testnetNativeAssets(),
    moduleRegistry: TESTNET_MODULE_REGISTRY,
    governance: testnetGovernancePolicy(validators),
    oraclePolicy: TESTNET_ORACLE_POLICY,
    faucetAuthorityId: TESTNET_FAUCET_AUTHORITY_ID,
    features: TESTNET_FEATURES,
    environment: TESTNET_ENVIRONMENT,
    productionNetworkEnabled: TESTNET_PRODUCTION_NETWORK_ENABLED,
  });
}

export function buildGenesis(input: TestnetGenesisInput = testnet1GenesisInput()): TestnetGenesisBundle {
  const canonical = encodeGenesisInput(input);
  const hash = sha256Hex(canonical);
  const setHash = validatorSetHash(input.validators);
  const manifest = genesisManifest(input, hash, setHash);
  return Object.freeze({
    canonicalBytesHex: canonical.toString('hex'),
    genesisHash: hash,
    validatorSetHash: setHash,
    manifest,
    configuration: configurationBundle(input, hash),
  });
}

export function genesisManifest(
  input: TestnetGenesisInput,
  hash: string,
  setHash: string,
): TestnetGenesisManifest {
  return Object.freeze({
    presentation: 'JSON_NOT_CONSENSUS',
    displayName: input.displayName,
    banner: SUNREY_TESTNET_1_BANNER,
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    genesisTimeUnixMs: input.genesisTimeUnixMs.toString(),
    genesisHash: hash,
    validatorSetHash: setHash,
    validatorCount: input.validators.length,
    cryptoSuitePolicy: input.cryptoSuitePolicy,
    feePolicy: input.feePolicy,
    oraclePolicy: input.oraclePolicy,
    faucetAuthorityId: input.faucetAuthorityId,
    tickerStatus: TESTNET_TICKER_STATUS,
    nativeAssets: input.nativeAssets.map((asset) =>
      Object.freeze({
        assetId: asset.assetId,
        tickerStatus: asset.tickerStatus,
        genesisSupply: asset.genesisSupply.toString(),
        faucetAllocation: asset.faucetAllocation.toString(),
        circulationLabel: asset.circulationLabel,
      }),
    ),
    modules: input.moduleRegistry,
    features: input.features,
    governance: Object.freeze({
      thresholdModel: input.governance.thresholdModel,
      requiredPower: input.governance.requiredPower.toString(),
      totalPower: input.governance.totalPower.toString(),
      minActivationLead: input.governance.minActivationLead,
      automaticBinaryUpgrade: false as const,
    }),
    environment: 'simulation',
    productionNetworkEnabled: false,
    monetaryValue: 'NONE',
  });
}

export function configurationBundle(input: TestnetGenesisInput, genesisHash: string): TestnetConfigurationBundle {
  return Object.freeze({
    public: Object.freeze({
      networkId: input.networkId,
      chainId: input.chainId,
      addressHrp: TESTNET_ADDRESS_HRP,
      sdkNetworkName: SUNREY_TESTNET_1_SDK_NAME,
      rpcUrl: '',
      explorerUrl: '',
      faucetUrl: '',
      genesisHash,
    }),
    secretReferences: Object.freeze([
      Object.freeze({
        name: 'faucet-authority',
        role: 'FAUCET_AUTHORITY' as const,
        handle: `secretref:${TESTNET_FAUCET_AUTHORITY_ID}`,
        containsPrivateKey: false as const,
      }),
      ...input.validators.map((row) =>
        Object.freeze({
          name: `${row.validatorId}-consensus`,
          role: 'VALIDATOR' as const,
          handle: `secretref:${row.validatorId}:consensus`,
          containsPrivateKey: false as const,
        }),
      ),
    ]),
    operatorKeyHandles: Object.freeze([
      Object.freeze({
        owner: faucetAuthorityLabel(),
        purpose: 'FAUCET' as const,
        handle: `keyhandle:${TESTNET_FAUCET_AUTHORITY_ID}`,
      }),
    ]),
  });
}

export function fixtureGenesisHash(): string {
  return buildGenesis(testnet1GenesisInput()).genesisHash;
}

export function jsonPresentationIsNotConsensus(manifestJson: string, canonicalHex: string): boolean {
  const jsonHash = sha256Hex(Buffer.from(manifestJson, 'utf8'));
  return jsonHash !== sha256Hex(Buffer.from(canonicalHex, 'hex'));
}

export { TESTNET_BFT_QUORUM_POWER };
