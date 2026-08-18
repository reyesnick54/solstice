/**
 * Deterministic economic-rehearsal genesis.
 *
 * Binds protocol version, economic RC, validator set, CryptoPolicy,
 * monetary / FeePolicyV2 / validator / MoonRey / treasury / governance
 * policies, and explicit REHEARSAL_ONLY allocations.
 *
 * Does not change the Chunk 65 production-candidate zero allocation.
 */

import { SUITE_SUNREY_ED25519_V1, createEd25519SignatureProvider, type KeyPurpose } from '../../../security/src/index.ts';
import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import { FIXTURE_KEY_MARKER, assertFixtureEnvironment } from '../testnet/security.ts';
import { CANDIDATE_MODULE_REGISTRY, defaultConsensusParameters, moduleHash } from '../mainnet/genesis-candidate.ts';
import { PRODUCTION_CANDIDATE_FEE_POLICY, productionCandidateCryptoPolicy } from '../mainnet/crypto-policy.ts';
import { emptyAllocationManifest, totalsOf } from '../mainnet/allocation.ts';
import { encodeBool, encodeString, encodeU32, encodeU64, sha256Bytes, sha256Hex } from '../validators/canonical.ts';
import type { CryptographicPolicyManifest, GenesisGovernancePolicy, MainnetValidatorCandidate } from '../mainnet/types.ts';
import { hashFeePolicyV2, developmentFeePolicyV2, hashFeeDispositionPolicyV2, developmentFeeDispositionPolicyV2 } from '../fees/v2/index.ts';
import { nativeAssetConstitution } from '../economics/constitution.ts';
import { hashPolicyBundle, developmentPolicyBundle } from '../productive/policy-governance/registry.ts';
import { rehearsalBondPolicy, developmentRewardPolicy, developmentPenaltyPolicy } from '../validator-economics/policy.ts';
import {
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_DISPLAY_NAME,
  ECONOMIC_REHEARSAL_FIXTURE_GENESIS_TIME_MS,
  ECONOMIC_REHEARSAL_GENESIS_VERSION,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
  ECONOMIC_RC_ID,
  assertEconomicRehearsalIdentity,
} from './identity.ts';
import { NO_PRODUCTION_VALUE, REHEARSAL_ONLY, type PolicyHashRecord, type RehearsalAllocationManifest, type EconomicGenesisBundle } from './types.ts';

export const ECONOMIC_GENESIS_DOMAIN = 'SUNREY_ECONOMIC_MAINNET_REHEARSAL_GENESIS_V1' as const;
export const ECONOMIC_GENESIS_TAG = 'EconomicMainnetRehearsalGenesisV1' as const;
export const ECONOMIC_VALIDATOR_COUNT = 7 as const;
export const ECONOMIC_VALIDATOR_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type EconomicValidatorLabel = (typeof ECONOMIC_VALIDATOR_LABELS)[number];

const ROLE_LABEL = {
  consensus: 'CONSENSUS',
  p2p: 'P2P',
  governance: 'GOVERNANCE',
} as const;

export const ECONOMIC_REHEARSAL_FEATURES = Object.freeze([
  { feature: 'NATIVE_SUNREY_COIN', activated: true },
  { feature: 'NATIVE_MOONREY_COIN', activated: true },
  { feature: 'DEVELOPMENT_FAUCET', activated: false },
  { feature: 'PUBLIC_STAKING', activated: false },
  { feature: 'PRODUCTION_BANKING_RAILS', activated: false },
  { feature: 'MAINNET', activated: false },
  { feature: 'PRODUCTION_EXCHANGE', activated: false },
  { feature: 'PRODUCTION_CUSTODY_WITHDRAWALS', activated: false },
  { feature: 'PRODUCTION_MONETARY_POLICY', activated: false },
]);

export function economicRehearsalKeyLabel(
  validator: EconomicValidatorLabel,
  role: keyof typeof ROLE_LABEL,
): string {
  return `SUNREY_ECONOMIC_MAINNET_REHEARSAL_1_FIXTURE_VALIDATOR_${validator}_${ROLE_LABEL[role]}_${FIXTURE_KEY_MARKER}_v1`;
}

function publicKeyFromLabel(
  validator: EconomicValidatorLabel,
  role: keyof typeof ROLE_LABEL,
  purpose: KeyPurpose,
): string {
  assertFixtureEnvironment();
  const provider = createEd25519SignatureProvider();
  const seed = sha256Bytes(Buffer.from(economicRehearsalKeyLabel(validator, role), 'utf8'));
  const derived = provider.fromSeed(
    seed.toString('hex'),
    purpose,
    SUITE_SUNREY_ED25519_V1,
    `economic-rehearsal-fixture:${validator}:${role}`,
  );
  if (!derived.ok) {
    throw new Error(derived.error.message);
  }
  return derived.value.publicKey.publicKeyHex;
}

export function sevenEconomicRehearsalValidators(): readonly MainnetValidatorCandidate[] {
  return Object.freeze(
    ECONOMIC_VALIDATOR_LABELS.map((label, index) => {
      const validatorId = `val_econ_rehearsal_1_${label.toLowerCase()}`;
      const consensusPublicKeyHex = publicKeyFromLabel(label, 'consensus', 'VALIDATOR_CONSENSUS_SIGNING');
      const p2pPublicKeyHex = publicKeyFromLabel(label, 'p2p', 'P2P_IDENTITY');
      const governancePublicKeyHex = publicKeyFromLabel(label, 'governance', 'GOVERNANCE_SIGNING');
      const ceremonyContributionHash = sha256Hex(
        Buffer.concat([
          encodeString(ECONOMIC_GENESIS_DOMAIN),
          encodeString(validatorId),
          encodeString(consensusPublicKeyHex),
        ]),
      );
      return Object.freeze({
        validatorId,
        operatorEntityReference: `operator.econ.rehearsal.1.${label.toLowerCase()}`,
        consensusPublicKeyHex,
        p2pPublicKeyHex,
        governancePublicKeyHex,
        cryptoSuite: SUITE_SUNREY_ED25519_V1,
        hsmAttestationReference: null,
        hsmEvidenceClass: 'SIMULATION_HSM' as const,
        failureDomain: `fd_econ_rehearsal_${['alpha', 'bravo', 'charlie'][index % 3]}`,
        votingPower: 1n,
        ceremonyContributionHash,
        approvalState: 'ENGINEERING_VERIFIED' as const,
      });
    }),
  );
}

export function economicRehearsalGovernance(
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

export function rehearsalAllocationManifest(): RehearsalAllocationManifest {
  const lines = Object.freeze([
    line('alloc.bond', 'SUNREY_COIN', 'NETWORK_SECURITY', 7_000_000n, 'rehearsal.validator_bonds'),
    line('alloc.treasury', 'SUNREY_COIN', 'TREASURY', 2_000_000n, 'rehearsal.protocol_treasury'),
    line('alloc.exchange', 'SUNREY_COIN', 'ECOSYSTEM', 1_000_000n, 'rehearsal.exchange_liquidity'),
    line('alloc.users', 'SUNREY_COIN', 'USER_DISTRIBUTION', 500_000n, 'rehearsal.synthetic_users'),
    line('alloc.reserve', 'SUNREY_COIN', 'RESERVE', 500_000n, 'rehearsal.reserve'),
    line('alloc.moonrey.genesis', 'MOONREY_COIN', 'PRODUCTIVE_ECONOMY', 0n, 'rehearsal.moonrey_post_genesis_only'),
  ]);
  return Object.freeze({
    schemaVersion: 1,
    policyVersion: 'sunrey.allocation.economic-rehearsal.v1',
    productionAllocationAuthorized: false,
    inheritedTestnetFaucet: false,
    migratedApplicationLedgerBalances: false,
    wrappedFiat: false,
    hiddenPremint: false,
    lines,
    totalByAsset: Object.freeze({
      SUNREY_COIN: 11_000_000n,
      MOONREY_COIN: 0n,
    }),
    classification: REHEARSAL_ONLY,
    productionValue: NO_PRODUCTION_VALUE,
    notes: 'Explicit rehearsal-only native allocations. NO_PRODUCTION_VALUE. Does not copy production-candidate assumptions.',
  });
}

function line(
  lineId: string,
  asset: 'SUNREY_COIN' | 'MOONREY_COIN',
  category: string,
  quantityMinorUnits: bigint,
  destination: string,
) {
  return Object.freeze({
    lineId,
    asset,
    category,
    quantityMinorUnits,
    destination,
    classification: REHEARSAL_ONLY,
    productionValue: NO_PRODUCTION_VALUE,
  });
}

export function productionCandidateAllocationUnchanged(): boolean {
  const candidate = emptyAllocationManifest();
  const totals = totalsOf(candidate.lines);
  return (
    candidate.productionAllocationAuthorized === false &&
    totals.SUNREY_COIN === 0n &&
    totals.MOONREY_COIN === 0n
  );
}

export function hashRehearsalAllocation(manifest: RehearsalAllocationManifest): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_ECONOMIC_REHEARSAL_ALLOCATION_V1'),
      encodeString(manifest.policyVersion),
      encodeU64(manifest.totalByAsset.SUNREY_COIN),
      encodeU64(manifest.totalByAsset.MOONREY_COIN),
      ...manifest.lines.flatMap((row) => [
        encodeString(row.lineId),
        encodeString(row.asset),
        encodeString(row.category),
        encodeU64(row.quantityMinorUnits),
        encodeString(row.classification),
        encodeString(row.productionValue),
      ]),
    ]),
  );
}

export function economicPolicyHashes(): readonly PolicyHashRecord[] {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  const fee = developmentFeePolicyV2();
  const disposition = developmentFeeDispositionPolicyV2();
  const moonrey = developmentPolicyBundle();
  const bond = rehearsalBondPolicy();
  const reward = developmentRewardPolicy();
  const penalty = developmentPenaltyPolicy();
  return Object.freeze([
    { name: 'monetary-constitution', version: constitution.assets[0]!.policyVersion.versionId, hash: sha256Hex(Buffer.from(constitution.constitutionId)) },
    { name: 'fee-policy-v2', version: `v${fee.version}`, hash: hashFeePolicyV2(fee) },
    { name: 'fee-disposition-v2', version: 'development', hash: hashFeeDispositionPolicyV2(disposition) },
    { name: 'moonrey-issuance-policy', version: `v${moonrey.policyVersion}`, hash: hashPolicyBundle(moonrey) },
    { name: 'validator-bond-policy', version: `v${bond.version}`, hash: sha256Hex(Buffer.from(JSON.stringify({ v: bond.version, asset: bond.bondAsset }))) },
    { name: 'validator-reward-policy', version: `v${reward.version}`, hash: sha256Hex(Buffer.from(JSON.stringify({ v: reward.version }))) },
    { name: 'validator-penalty-policy', version: `v${penalty.version}`, hash: sha256Hex(Buffer.from(JSON.stringify({ v: penalty.version }))) },
    { name: 'treasury-policy', version: 'rehearsal.treasury.v1', hash: sha256Hex(Buffer.from('sunrey.protocol-treasury.rehearsal.v1')) },
    { name: 'governance-policy', version: 'validator-supermajority', hash: sha256Hex(Buffer.from('VALIDATOR_SUPERMAJORITY')) },
    { name: 'crypto-policy', version: productionCandidateCryptoPolicy().policyId, hash: sha256Hex(Buffer.from(productionCandidateCryptoPolicy().policyId)) },
    { name: 'economic-rc', version: ECONOMIC_RC_ID, hash: sha256Hex(Buffer.from(ECONOMIC_RC_ID)) },
  ]);
}

export type EconomicGenesisInput = {
  readonly networkId: string;
  readonly chainId: string;
  readonly displayName: string;
  readonly protocolVersion: string;
  readonly genesisVersion: string;
  readonly genesisTimeUnixMs: bigint;
  readonly addressHrp: typeof ECONOMIC_REHEARSAL_ADDRESS_HRP;
  readonly validators: readonly MainnetValidatorCandidate[];
  readonly cryptoPolicy: CryptographicPolicyManifest;
  readonly feePolicy: string;
  readonly economicRcId: string;
  readonly moduleRegistry: readonly string[];
  readonly governance: GenesisGovernancePolicy;
  readonly allocation: RehearsalAllocationManifest;
  readonly policyHashes: readonly PolicyHashRecord[];
  readonly ceremonyTranscriptHash: string;
  readonly environment: 'simulation';
  readonly productionActivated: false;
  readonly mainnetEnabled: false;
};

export function defaultEconomicGenesisInput(
  validators: readonly MainnetValidatorCandidate[] = sevenEconomicRehearsalValidators(),
  ceremonyTranscriptHash = sha256Hex(Buffer.from('sunrey-economic-mainnet-rehearsal-ceremony-placeholder')),
): EconomicGenesisInput {
  return Object.freeze({
    networkId: ECONOMIC_REHEARSAL_NETWORK_ID,
    chainId: ECONOMIC_REHEARSAL_CHAIN_ID,
    displayName: ECONOMIC_REHEARSAL_DISPLAY_NAME,
    protocolVersion: ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
    genesisVersion: ECONOMIC_REHEARSAL_GENESIS_VERSION,
    genesisTimeUnixMs: ECONOMIC_REHEARSAL_FIXTURE_GENESIS_TIME_MS,
    addressHrp: ECONOMIC_REHEARSAL_ADDRESS_HRP,
    validators,
    cryptoPolicy: productionCandidateCryptoPolicy(),
    feePolicy: PRODUCTION_CANDIDATE_FEE_POLICY,
    economicRcId: ECONOMIC_RC_ID,
    moduleRegistry: CANDIDATE_MODULE_REGISTRY,
    governance: economicRehearsalGovernance(validators),
    allocation: rehearsalAllocationManifest(),
    policyHashes: economicPolicyHashes(),
    ceremonyTranscriptHash,
    environment: 'simulation',
    productionActivated: false,
    mainnetEnabled: false,
  });
}

export function encodeEconomicGenesis(input: EconomicGenesisInput): Buffer {
  assertEconomicRehearsalIdentity(input.networkId, input.chainId, input.addressHrp);
  if (input.mainnetEnabled || input.productionActivated) {
    throw new TypeError('economic rehearsal genesis must not activate production');
  }
  if (input.environment !== 'simulation') {
    throw new TypeError('economic rehearsal genesis remains a simulation artifact');
  }
  const validators = [...input.validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  const modules = [...input.moduleRegistry].sort();
  const features = [...ECONOMIC_REHEARSAL_FEATURES].sort((a, b) => a.feature.localeCompare(b.feature));
  const hashes = [...input.policyHashes].sort((a, b) => a.name.localeCompare(b.name));
  const parts = [
    encodeString(ECONOMIC_GENESIS_TAG),
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
    encodeString(input.economicRcId),
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
  parts.push(encodeString(hashRehearsalAllocation(input.allocation)));
  parts.push(encodeU32(hashes.length));
  for (const row of hashes) {
    parts.push(encodeString(row.name), encodeString(row.version), encodeString(row.hash));
  }
  const consensus = defaultConsensusParameters();
  parts.push(
    encodeU32(consensus.maxBlockBytes),
    encodeU32(consensus.maxTransactions),
    encodeU32(consensus.timeoutProposeMs),
  );
  return Buffer.concat([encodeString(ECONOMIC_GENESIS_DOMAIN), Buffer.concat(parts)]);
}

export function economicGenesisHashOf(input: EconomicGenesisInput): string {
  return sha256Hex(encodeEconomicGenesis(input));
}

export function economicValidatorSetHash(validators: readonly MainnetValidatorCandidate[]): string {
  const sorted = [...validators].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  return sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_ECONOMIC_REHEARSAL_VALSET_V1'),
      ...sorted.flatMap((row) => [
        encodeString(row.validatorId),
        encodeString(row.consensusPublicKeyHex),
        encodeU64(row.votingPower),
      ]),
    ]),
  );
}

export function verifyEconomicGenesis(
  input: EconomicGenesisInput,
  expectedHash?: string,
): EconomicGenesisBundle['verification'] {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
  };
  try {
    assertEconomicRehearsalIdentity(input.networkId, input.chainId, input.addressHrp);
    push('network', true, input.networkId);
    push('chain', true, input.chainId);
  } catch (error) {
    push('identity', false, error instanceof Error ? error.message : 'identity failed');
  }
  push('validator-set', input.validators.length === 7, `${input.validators.length} validators`);
  push('crypto-policy', input.cryptoPolicy.pqRequiredForConsensus === false, input.cryptoPolicy.policyId);
  push('fee-policy', input.feePolicy.length > 0, input.feePolicy);
  push('economic-rc', input.economicRcId === ECONOMIC_RC_ID, input.economicRcId);
  push('allocation-rehearsal-only', input.allocation.classification === REHEARSAL_ONLY, input.allocation.classification);
  push('allocation-no-production-value', input.allocation.productionValue === NO_PRODUCTION_VALUE, input.allocation.productionValue);
  push('allocation-sum', input.allocation.totalByAsset.SUNREY_COIN === 11_000_000n, input.allocation.totalByAsset.SUNREY_COIN.toString());
  push('moonrey-genesis-zero', input.allocation.totalByAsset.MOONREY_COIN === 0n, 'post-genesis issuance only');
  push('production-candidate-zero', productionCandidateAllocationUnchanged(), 'chunk-65 unchanged');
  push('governance', input.governance.aiMayGovern === false && input.governance.governanceToken === false, 'validator supermajority');
  push('ticker', NATIVE_ASSET_TICKER_STATUS === 'NOT_ASSIGNED', NATIVE_ASSET_TICKER_STATUS);
  push('production-off', input.productionActivated === false && input.mainnetEnabled === false, 'simulation');
  const hash = economicGenesisHashOf(input);
  push('genesis-hash', expectedHash === undefined || expectedHash === hash, hash);
  return Object.freeze({ ok: checks.every((row) => row.ok), checks: Object.freeze(checks) });
}

export function buildEconomicGenesis(
  input: EconomicGenesisInput = defaultEconomicGenesisInput(),
): EconomicGenesisBundle {
  const genesisHash = economicGenesisHashOf(input);
  return Object.freeze({
    genesisHash,
    validatorSetHash: economicValidatorSetHash(input.validators),
    allocationHash: hashRehearsalAllocation(input.allocation),
    policyHashes: input.policyHashes,
    verification: verifyEconomicGenesis(input, genesisHash),
  });
}
