/**
 * Deterministic rehearsal genesis.
 *
 * Same protocol, module, governance, fee, and native-asset architecture
 * as the production candidate — distinct identity, test-only keys,
 * zero economic-value supply, no customer state, no fiat, no production
 * credentials.
 */

import { SUITE_SUNREY_ED25519_V1, createEd25519SignatureProvider, type KeyPurpose } from '../../../security/src/index.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import { FIXTURE_KEY_MARKER, assertFixtureEnvironment } from '../testnet/security.ts';
import { CANDIDATE_MODULE_REGISTRY, defaultConsensusParameters, moduleHash } from '../mainnet/genesis-candidate.ts';
import { PRODUCTION_CANDIDATE_FEE_POLICY, productionCandidateCryptoPolicy } from '../mainnet/crypto-policy.ts';
import { emptyAllocationManifest } from '../mainnet/allocation.ts';
import { encodeBool, encodeString, encodeU32, encodeU64, sha256Bytes, sha256Hex } from '../validators/canonical.ts';
import type { CryptographicPolicyManifest, GenesisGovernancePolicy, MainnetValidatorCandidate } from '../mainnet/types.ts';
import {
  REHEARSAL_ADDRESS_HRP,
  REHEARSAL_CHAIN_ID,
  REHEARSAL_DISPLAY_NAME,
  REHEARSAL_FIXTURE_GENESIS_TIME_MS,
  REHEARSAL_GENESIS_VERSION,
  REHEARSAL_NETWORK_ID,
  REHEARSAL_PROTOCOL_VERSION,
  assertRehearsalIdentity,
} from './identity.ts';

export const REHEARSAL_GENESIS_DOMAIN = 'SUNREY_MAINNET_REHEARSAL_GENESIS_V1' as const;
export const REHEARSAL_GENESIS_TAG = 'MainnetRehearsalGenesisV1' as const;
export const REHEARSAL_VALIDATOR_COUNT = 7 as const;
export const REHEARSAL_VALIDATOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type RehearsalValidatorLabel = (typeof REHEARSAL_VALIDATOR_LABELS)[number];

const ROLE_LABEL = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
} as const;

export const REHEARSAL_FEATURES = Object.freeze([
  { feature: 'NATIVE_SUNREY_COIN', activated: true },
  { feature: 'NATIVE_MOONREY_COIN', activated: true },
  { feature: 'DEVELOPMENT_FAUCET', activated: false },
  { feature: 'PUBLIC_STAKING', activated: false },
  { feature: 'PRODUCTION_BANKING_RAILS', activated: false },
  { feature: 'MAINNET', activated: false },
  { feature: 'PRODUCTION_EXCHANGE', activated: false },
  { feature: 'PRODUCTION_CUSTODY_WITHDRAWALS', activated: false },
  { feature: 'PRODUCTION_INTEROPERABILITY', activated: false },
]);

export function rehearsalKeyLabel(
  validator: RehearsalValidatorLabel,
  role: keyof typeof ROLE_LABEL,
): string {
  return `SUNREY_MAINNET_REHEARSAL_1_FIXTURE_VALIDATOR_${validator}_${ROLE_LABEL[role]}_${FIXTURE_KEY_MARKER}_v1`;
}

function publicKeyFromLabel(
  validator: RehearsalValidatorLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
): string {
  assertFixtureEnvironment();
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(rehearsalKeyLabel(validator, role), 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `mainnet-rehearsal-fixture:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function sevenRehearsalValidators(): readonly MainnetValidatorCandidate[] {
  return Object.freeze(
    REHEARSAL_VALIDATOR_LABELS.map((label, index) => {
      const validatorId = `val_rehearsal_1_${label.toLowerCase()}`;
      const consensusPublicKeyHex = publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING');
      const p2pPublicKeyHex = publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY');
      const governancePublicKeyHex = publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING');
      const ceremonyContributionHash = sha256Hex(
        Buffer.concat([
          encodeString(REHEARSAL_GENESIS_DOMAIN),
          encodeString(validatorId),
          encodeString(consensusPublicKeyHex),
        ]),
      );
      return Object.freeze({
        validatorId,
        operatorEntityReference: `operator.rehearsal.1.${label.toLowerCase()}`,
        consensusPublicKeyHex,
        p2pPublicKeyHex,
        governancePublicKeyHex,
        cryptoSuite: SUITE_SUNREY_ED25519_V1,
        hsmAttestationReference: null,
        hsmEvidenceClass: 'SIMULATION_HSM' as const,
        failureDomain: `fd_rehearsal_${['alpha', 'bravo', 'charlie'][index % 3]}`,
        votingPower: 1n,
        ceremonyContributionHash,
        approvalState: 'ENGINEERING_VERIFIED' as const,
      });
    }),
  );
}

export function rehearsalGovernance(
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

export type RehearsalGenesisInput = {
  readonly networkId: string;
  readonly chainId: string;
  readonly displayName: string;
  readonly protocolVersion: string;
  readonly genesisVersion: string;
  readonly genesisTimeUnixMs: bigint;
  readonly addressHrp: typeof REHEARSAL_ADDRESS_HRP;
  readonly validators: readonly MainnetValidatorCandidate[];
  readonly cryptoPolicy: CryptographicPolicyManifest;
  readonly feePolicy: string;
  readonly moduleRegistry: readonly string[];
  readonly governance: GenesisGovernancePolicy;
  readonly ceremonyTranscriptHash: string;
  readonly environment: 'simulation';
  readonly productionActivated: false;
  readonly mainnetEnabled: false;
};

export type RehearsalGenesisBundle = {
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly moduleHashes: Readonly<Record<string, string>>;
  readonly input: RehearsalGenesisInput;
  readonly verification: {
    readonly ok: boolean;
    readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
  };
};

export function defaultRehearsalGenesisInput(
  validators: readonly MainnetValidatorCandidate[] = sevenRehearsalValidators(),
  ceremonyTranscriptHash = sha256Hex(Buffer.from('sunrey-mainnet-rehearsal-ceremony-placeholder')),
): RehearsalGenesisInput {
  return Object.freeze({
    networkId: REHEARSAL_NETWORK_ID,
    chainId: REHEARSAL_CHAIN_ID,
    displayName: REHEARSAL_DISPLAY_NAME,
    protocolVersion: REHEARSAL_PROTOCOL_VERSION,
    genesisVersion: REHEARSAL_GENESIS_VERSION,
    genesisTimeUnixMs: REHEARSAL_FIXTURE_GENESIS_TIME_MS,
    addressHrp: REHEARSAL_ADDRESS_HRP,
    validators,
    cryptoPolicy: productionCandidateCryptoPolicy(),
    feePolicy: PRODUCTION_CANDIDATE_FEE_POLICY,
    moduleRegistry: CANDIDATE_MODULE_REGISTRY,
    governance: rehearsalGovernance(validators),
    ceremonyTranscriptHash,
    environment: 'simulation',
    productionActivated: false,
    mainnetEnabled: false,
  });
}

export function encodeRehearsalGenesis(input: RehearsalGenesisInput): Buffer {
  assertRehearsalIdentity(input.networkId, input.chainId, input.addressHrp);
  if (input.mainnetEnabled || input.productionActivated) {
    throw new TypeError('rehearsal genesis must not activate production');
  }
  if (input.environment !== 'simulation') {
    throw new TypeError('rehearsal genesis remains a simulation artifact');
  }
  const validators = [...input.validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  const modules = [...input.moduleRegistry].sort();
  const features = [...REHEARSAL_FEATURES].sort((a, b) => a.feature.localeCompare(b.feature));
  const parts = [
    encodeString(REHEARSAL_GENESIS_TAG),
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
    encodeBool(false),
    encodeBool(false),
    encodeString(input.environment),
    encodeU32(validators.length),
  ];
  for (const row of validators) {
    parts.push(
      encodeString(row.validatorId),
      encodeString(row.consensusPublicKeyHex),
      encodeString(row.p2pPublicKeyHex),
      encodeString(row.governancePublicKeyHex),
      encodeU64(row.votingPower),
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
    encodeBool(input.governance.governanceToken),
    encodeBool(input.governance.aiMayGovern),
  );
  parts.push(encodeString(emptyAllocationManifest().notes));
  const consensus = defaultConsensusParameters();
  parts.push(
    encodeU32(consensus.maxBlockBytes),
    encodeU32(consensus.maxTransactions),
    encodeU32(consensus.timeoutProposeMs),
  );
  return Buffer.concat([encodeString(REHEARSAL_GENESIS_DOMAIN), Buffer.concat(parts)]);
}

export function rehearsalGenesisHashOf(input: RehearsalGenesisInput): string {
  return sha256Hex(encodeRehearsalGenesis(input));
}

export function rehearsalValidatorSetHash(validators: readonly MainnetValidatorCandidate[]): string {
  const sorted = [...validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  return sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_REHEARSAL_VALSET_V1'),
      ...sorted.flatMap((row) => [
        encodeString(row.validatorId),
        encodeString(row.consensusPublicKeyHex),
        encodeU64(row.votingPower),
      ]),
    ]),
  );
}

export function verifyRehearsalGenesis(
  input: RehearsalGenesisInput,
  expectedHash?: string,
): RehearsalGenesisBundle['verification'] {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
  };
  try {
    assertRehearsalIdentity(input.networkId, input.chainId, input.addressHrp);
    push('network', true, input.networkId);
    push('chain', true, input.chainId);
  } catch (error) {
    push('identity', false, error instanceof Error ? error.message : 'identity failed');
  }
  push('validator-set', input.validators.length === 7, `${input.validators.length} validators`);
  push('crypto-policy', input.cryptoPolicy.pqRequiredForConsensus === false, input.cryptoPolicy.policyId);
  push('fee-policy', input.feePolicy.length > 0, input.feePolicy);
  push('native-assets', true, 'SUNREY_COIN,MOONREY_COIN zero supply');
  push('governance', input.governance.aiMayGovern === false && input.governance.governanceToken === false, 'validator supermajority');
  push('modules', input.moduleRegistry.length > 0, `${input.moduleRegistry.length} modules`);
  push('ticker', NATIVE_ASSET_TICKER_STATUS === 'NOT_ASSIGNED', NATIVE_ASSET_TICKER_STATUS);
  push('production-off', input.productionActivated === false && input.mainnetEnabled === false, 'simulation');
  const hash = rehearsalGenesisHashOf(input);
  push('genesis-hash', expectedHash === undefined || expectedHash === hash, hash);
  return Object.freeze({ ok: checks.every((row) => row.ok), checks: Object.freeze(checks) });
}

export function buildRehearsalGenesis(
  input: RehearsalGenesisInput = defaultRehearsalGenesisInput(),
): RehearsalGenesisBundle {
  const genesisHash = rehearsalGenesisHashOf(input);
  const validatorSetHash = rehearsalValidatorSetHash(input.validators);
  const moduleHashes = Object.fromEntries(
    input.moduleRegistry.map((name) => [name, moduleHash(name, input.protocolVersion)]),
  );
  return Object.freeze({
    genesisHash,
    validatorSetHash,
    moduleHashes: Object.freeze(moduleHashes),
    input,
    verification: verifyRehearsalGenesis(input, genesisHash),
  });
}
