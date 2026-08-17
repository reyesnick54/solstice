/**
 * Deterministic production genesis candidate builder.
 *
 * Identical approved inputs produce an identical candidate hash.
 * This does not publish genesis or launch validators.
 */

import { encodeBool, encodeString, encodeU32, encodeU64, sha256Hex } from '../validators/canonical.ts';
import { fixtureGenesisHash, TESTNET_MODULE_REGISTRY } from '../testnet/genesis.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import { allocationManifestHash, emptyAllocationManifest, rejectUnapprovedAllocation } from './allocation.ts';
import { bindCeremony, buildSimulatedCeremonyTranscript } from './ceremony.ts';
import { productionCandidateCryptoPolicy, PRODUCTION_CANDIDATE_FEE_POLICY, rejectUnsupportedPqHsmRequirement } from './crypto-policy.ts';
import {
  assertCandidateIdentity,
  PRODUCTION_ADDRESS_HRP,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_CANDIDATE_DISPLAY_NAME,
  PRODUCTION_CANDIDATE_FIXTURE_GENESIS_TIME_MS,
  PRODUCTION_CANDIDATE_GENESIS_VERSION,
  PRODUCTION_CANDIDATE_NETWORK_ID,
  PRODUCTION_CANDIDATE_PROTOCOL_VERSION,
} from './identity.ts';
import {
  rejectSimulationHsmAsReal,
  rejectTestnetKeys,
  sevenProductionCandidateValidators,
  validatorCandidateManifest,
  validatorSetHash,
} from './validators.ts';
import type {
  CryptographicPolicyManifest,
  GenesisAssetAllocationManifest,
  GenesisGovernancePolicy,
  MainnetValidatorCandidate,
  NativeAssetCandidate,
  ProductionNetworkCandidate,
} from './types.ts';

export const GENESIS_CANDIDATE_DOMAIN = 'SUNREY_PRODUCTION_GENESIS_CANDIDATE_V1' as const;
export const GENESIS_CANDIDATE_TAG = 'GenesisCandidateV1' as const;
export const GENESIS_CANDIDATE_TOOL_VERSION = 'sunrey-genesis/candidate-1' as const;

export const CANDIDATE_MODULE_REGISTRY = TESTNET_MODULE_REGISTRY;

export const CANDIDATE_FEATURES = Object.freeze([
  { feature: 'NATIVE_SUNREY_COIN', activated: true },
  { feature: 'NATIVE_MOONREY_COIN', activated: true },
  { feature: 'DEVELOPMENT_FAUCET', activated: false },
  { feature: 'PUBLIC_STAKING', activated: false },
  { feature: 'PRODUCTION_BANKING_RAILS', activated: false },
  { feature: 'MAINNET', activated: false },
  { feature: 'PRODUCTION_EXCHANGE', activated: false },
  { feature: 'PRODUCTION_CUSTODY_WITHDRAWALS', activated: false },
]);

export function candidateNativeAssets(): readonly NativeAssetCandidate[] {
  return Object.freeze([
    Object.freeze({
      assetId: 'SUNREY_COIN' as const,
      tickerStatus: NATIVE_ASSET_TICKER_STATUS,
      genesisSupply: 0n,
      faucetAllocation: 0n,
      circulationLabel: 'PRODUCTION_ALLOCATION_NOT_AUTHORIZED' as const,
    }),
    Object.freeze({
      assetId: 'MOONREY_COIN' as const,
      tickerStatus: NATIVE_ASSET_TICKER_STATUS,
      genesisSupply: 0n,
      faucetAllocation: 0n,
      circulationLabel: 'PRODUCTION_ALLOCATION_NOT_AUTHORIZED' as const,
    }),
  ]);
}

export function candidateGovernancePolicy(
  validators: readonly MainnetValidatorCandidate[],
): GenesisGovernancePolicy {
  const total = validators.reduce((sum, row) => sum + row.votingPower, 0n);
  return Object.freeze({
    thresholdModel: 'VALIDATOR_SUPERMAJORITY',
    requiredPower: (total * 2n) / 3n + 1n,
    totalPower: total,
    minActivationLead: 4,
    automaticBinaryUpgrade: false,
    governanceToken: false,
    aiMayGovern: false,
  });
}

export function defaultConsensusParameters() {
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

export function moduleHash(moduleName: string, protocolVersion: string): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.module.v1'), encodeString(moduleName), encodeString(protocolVersion)]));
}

export type GenesisCandidateInput = {
  readonly networkId: string;
  readonly chainId: string;
  readonly displayName: string;
  readonly protocolVersion: string;
  readonly genesisVersion: string;
  readonly genesisTimeUnixMs: bigint;
  readonly addressHrp: 'srprd';
  readonly validators: readonly MainnetValidatorCandidate[];
  readonly consensus: ReturnType<typeof defaultConsensusParameters>;
  readonly cryptoPolicy: CryptographicPolicyManifest;
  readonly feePolicy: string;
  readonly nativeAssets: readonly NativeAssetCandidate[];
  readonly moduleRegistry: readonly string[];
  readonly governance: GenesisGovernancePolicy;
  readonly allocation: GenesisAssetAllocationManifest;
  readonly ceremonyTranscriptHash: string;
  readonly environment: 'simulation';
  readonly productionActivated: false;
  readonly mainnetEnabled: false;
};

export type GenesisCandidateBundle = {
  readonly canonicalBytesHex: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly allocationHash: string;
  readonly manifest: ReturnType<typeof genesisCandidateManifest>;
  readonly candidate: ProductionNetworkCandidate;
  readonly verification: GenesisCandidateVerification;
};

export type GenesisCandidateVerification = {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
};

export function defaultGenesisCandidateInput(
  validators: readonly MainnetValidatorCandidate[] = sevenProductionCandidateValidators(),
): GenesisCandidateInput {
  const transcript = buildSimulatedCeremonyTranscript(validators);
  return Object.freeze({
    networkId: PRODUCTION_CANDIDATE_NETWORK_ID,
    chainId: PRODUCTION_CANDIDATE_CHAIN_ID,
    displayName: PRODUCTION_CANDIDATE_DISPLAY_NAME,
    protocolVersion: PRODUCTION_CANDIDATE_PROTOCOL_VERSION,
    genesisVersion: PRODUCTION_CANDIDATE_GENESIS_VERSION,
    genesisTimeUnixMs: PRODUCTION_CANDIDATE_FIXTURE_GENESIS_TIME_MS,
    addressHrp: PRODUCTION_ADDRESS_HRP,
    validators,
    consensus: defaultConsensusParameters(),
    cryptoPolicy: productionCandidateCryptoPolicy(),
    feePolicy: PRODUCTION_CANDIDATE_FEE_POLICY,
    nativeAssets: candidateNativeAssets(),
    moduleRegistry: CANDIDATE_MODULE_REGISTRY,
    governance: candidateGovernancePolicy(validators),
    allocation: emptyAllocationManifest(),
    ceremonyTranscriptHash: transcript.transcriptHash,
    environment: 'simulation',
    productionActivated: false,
    mainnetEnabled: false,
  });
}

export function encodeGenesisCandidate(input: GenesisCandidateInput): Buffer {
  assertCandidateIdentity(input.networkId, input.chainId);
  if (input.mainnetEnabled) {
    throw new TypeError('AI cannot emit genesis with mainnetEnabled');
  }
  if (input.productionActivated) {
    throw new TypeError('genesis candidate must not activate production');
  }
  if (input.environment !== 'simulation') {
    throw new TypeError('current genesis candidates remain simulation artifacts');
  }
  if (input.addressHrp !== PRODUCTION_ADDRESS_HRP) {
    throw new TypeError('production candidate must use canonical HRP srprd');
  }
  if (input.governance.governanceToken || input.governance.aiMayGovern) {
    throw new TypeError('governance token and AI governance are forbidden');
  }
  rejectUnsupportedPqHsmRequirement(input.cryptoPolicy);
  rejectUnapprovedAllocation(input.allocation);
  rejectTestnetKeys(input.validators);
  rejectSimulationHsmAsReal(input.validators);

  const validators = [...input.validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  const assets = [...input.nativeAssets].sort((a, b) => a.assetId.localeCompare(b.assetId));
  const modules = [...input.moduleRegistry].sort();
  const features = [...CANDIDATE_FEATURES].sort((a, b) => a.feature.localeCompare(b.feature));
  const parts = [
    encodeString(GENESIS_CANDIDATE_TAG),
    encodeString(input.networkId),
    encodeString(input.chainId),
    encodeString(input.displayName),
    encodeString(input.protocolVersion),
    encodeString(input.genesisVersion),
    encodeU64(input.genesisTimeUnixMs),
    encodeString(input.addressHrp),
    encodeString(input.cryptoPolicy.policyId),
    encodeString(input.cryptoPolicy.consensusSuiteId),
    encodeString(input.feePolicy),
    encodeString(input.ceremonyTranscriptHash),
    encodeString(allocationManifestHash(input.allocation)),
    encodeBool(input.productionActivated),
    encodeBool(input.mainnetEnabled),
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
      encodeString(row.operatorEntityReference),
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
      encodeString(asset.circulationLabel),
    );
  }
  parts.push(encodeU32(modules.length));
  for (const module of modules) {
    parts.push(encodeString(module), encodeString(moduleHash(module, input.protocolVersion)));
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
    encodeBool(input.governance.governanceToken),
    encodeBool(input.governance.aiMayGovern),
  );
  return Buffer.concat([encodeString(GENESIS_CANDIDATE_DOMAIN), Buffer.concat(parts)]);
}

export function genesisCandidateHashOf(input: GenesisCandidateInput): string {
  return sha256Hex(encodeGenesisCandidate(input));
}

export function genesisCandidateManifest(
  input: GenesisCandidateInput,
  hash: string,
  setHash: string,
  allocationHash: string,
) {
  return Object.freeze({
    presentation: 'JSON_NOT_CONSENSUS' as const,
    toolVersion: GENESIS_CANDIDATE_TOOL_VERSION,
    displayName: input.displayName,
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    genesisVersion: input.genesisVersion,
    addressHrp: input.addressHrp,
    genesisTimeUnixMs: input.genesisTimeUnixMs.toString(),
    genesisHash: hash,
    validatorSetHash: setHash,
    allocationHash,
    validatorCount: input.validators.length,
    cryptoPolicy: input.cryptoPolicy.policyId,
    feePolicy: input.feePolicy,
    tickerStatus: NATIVE_ASSET_TICKER_STATUS,
    nativeAssets: input.nativeAssets.map((asset) =>
      Object.freeze({
        assetId: asset.assetId,
        genesisSupply: asset.genesisSupply.toString(),
        faucetAllocation: '0',
        circulationLabel: asset.circulationLabel,
      }),
    ),
    modules: input.moduleRegistry,
    features: CANDIDATE_FEATURES,
    governance: Object.freeze({
      thresholdModel: input.governance.thresholdModel,
      requiredPower: input.governance.requiredPower.toString(),
      totalPower: input.governance.totalPower.toString(),
      governanceToken: false,
      aiMayGovern: false,
    }),
    environment: 'simulation' as const,
    productionActivated: false as const,
    mainnetEnabled: false as const,
    monetaryValue: 'NONE' as const,
    status: 'CANDIDATE' as const,
  });
}

export function verifyGenesisCandidate(input: GenesisCandidateInput, expectedHash?: string): GenesisCandidateVerification {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
  };
  try {
    assertCandidateIdentity(input.networkId, input.chainId);
    push('network-identity', true, input.networkId);
    push('chain-identity', true, input.chainId);
  } catch (error) {
    push('network-identity', false, error instanceof Error ? error.message : 'identity failed');
  }
  push('address-hrp', input.addressHrp === PRODUCTION_ADDRESS_HRP, input.addressHrp);
  push('mainnet-disabled', input.mainnetEnabled === false, 'mainnetEnabled remains false');
  push('production-inactive', input.productionActivated === false, 'productionActivated remains false');
  push('environment-simulation', input.environment === 'simulation', input.environment);
  push('governance-token-absent', input.governance.governanceToken === false, 'no governance token');
  push('ai-cannot-govern', input.governance.aiMayGovern === false, 'AI cannot govern');
  try {
    rejectUnsupportedPqHsmRequirement(input.cryptoPolicy);
    push('crypto-policy', true, input.cryptoPolicy.policyId);
  } catch (error) {
    push('crypto-policy', false, error instanceof Error ? error.message : 'crypto policy failed');
  }
  try {
    rejectUnapprovedAllocation(input.allocation);
    push('asset-allocations', true, 'zero or explicitly authorized');
  } catch (error) {
    push('asset-allocations', false, error instanceof Error ? error.message : 'allocation failed');
  }
  try {
    rejectTestnetKeys(input.validators);
    push('validator-keys', true, 'distinct from testnet');
  } catch (error) {
    push('validator-keys', false, error instanceof Error ? error.message : 'validator key failed');
  }
  const hash = genesisCandidateHashOf(input);
  push('genesis-hash', expectedHash === undefined || expectedHash === hash, hash);
  push('testnet-genesis-not-reused', hash !== fixtureGenesisHash(), 'candidate hash differs from testnet');
  push('ceremony-reference', input.ceremonyTranscriptHash.length === 64, input.ceremonyTranscriptHash);
  const nativeOk = input.nativeAssets.every((asset) => asset.genesisSupply === 0n && asset.faucetAllocation === 0n);
  push('native-asset-registry', nativeOk, 'zero genesis supply and no faucet');
  return Object.freeze({
    ok: checks.every((check) => check.ok),
    checks: Object.freeze(checks),
  });
}

export function buildGenesisCandidate(
  input: GenesisCandidateInput = defaultGenesisCandidateInput(),
): GenesisCandidateBundle {
  const canonical = encodeGenesisCandidate(input);
  const hash = sha256Hex(canonical);
  const setHash = validatorSetHash(input.validators);
  const allocationHash = allocationManifestHash(input.allocation);
  const transcript = buildSimulatedCeremonyTranscript(input.validators);
  const candidate: ProductionNetworkCandidate = Object.freeze({
    displayName: input.displayName,
    networkId: input.networkId,
    chainId: input.chainId,
    productionAddressHrp: PRODUCTION_ADDRESS_HRP,
    protocolVersion: input.protocolVersion,
    genesisVersion: input.genesisVersion,
    cryptoPolicy: input.cryptoPolicy,
    validatorSetCandidate: validatorCandidateManifest(input.validators),
    moduleRegistry: input.moduleRegistry,
    governancePolicy: input.governance,
    feePolicy: input.feePolicy,
    nativeAssetRegistry: input.nativeAssets,
    allocationManifestReference: allocationHash,
    securityEvidenceBundleHash: null,
    rootOfTrustCeremony: bindCeremony(transcript),
    status: 'CANDIDATE',
    mainnetEnabled: false,
    productionActivated: false,
    environment: 'simulation',
  });
  return Object.freeze({
    canonicalBytesHex: canonical.toString('hex'),
    genesisHash: hash,
    validatorSetHash: setHash,
    allocationHash,
    manifest: genesisCandidateManifest(input, hash, setHash, allocationHash),
    candidate,
    verification: verifyGenesisCandidate(input, hash),
  });
}

export function jsonPresentationIsNotConsensus(manifestJson: string, canonicalHex: string): boolean {
  return sha256Hex(Buffer.from(manifestJson, 'utf8')) !== sha256Hex(Buffer.from(canonicalHex, 'hex'));
}
