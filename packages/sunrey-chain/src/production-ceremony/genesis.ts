/**
 * Deterministic production-genesis candidate bytes and hash.
 *
 * JSON display format is not consensus serialization. Changing bound
 * inputs changes the hash. Unapproved production allocations keep the
 * production package incomplete. Rehearsal allocation is never copied.
 */

import { NATIVE_ASSET_TICKER_STATUS } from '../protocol/assets.ts';
import { productionCandidateCryptoPolicy, PRODUCTION_CANDIDATE_FEE_POLICY, rejectUnsupportedPqHsmRequirement } from '../mainnet/crypto-policy.ts';
import { allocationManifestHash, emptyAllocationManifest, rejectUnapprovedAllocation } from '../mainnet/allocation.ts';
import { CANDIDATE_MODULE_REGISTRY, moduleHash } from '../mainnet/genesis-candidate.ts';
import type { GenesisAssetAllocationManifest } from '../mainnet/types.ts';
import { encodeBool, encodeString, encodeU32, encodeU64, sha256Hex } from '../validators/canonical.ts';
import { assertDressRehearsalIdentity } from './identity.ts';
import type { GenesisTimePolicy, ProductionGenesisCeremonyPlan, ProductionGenesisManifest } from './types.ts';

export const PRODUCTION_GENESIS_DOMAIN = 'SUNREY_PRODUCTION_GENESIS_CEREMONY_V1' as const;
export const PRODUCTION_GENESIS_TAG = 'ProductionGenesisCeremonyV1' as const;
export const REHEARSAL_GENESIS_DOMAIN = 'SUNREY_PRODUCTION_GENESIS_CEREMONY_REHEARSAL_V1' as const;
export const REHEARSAL_GENESIS_TAG = 'ProductionGenesisCeremonyRehearsalV1' as const;
export const TREASURY_POLICY_ID = 'sunrey.protocol-treasury.production-unconfigured.v1' as const;

export type ProductionGenesisInput = {
  readonly plan: ProductionGenesisCeremonyPlan;
  readonly validatorSetHash: string;
  readonly validatorKeysHash: string;
  readonly governanceKeysHash: string;
  readonly allocation: GenesisAssetAllocationManifest;
  readonly genesisTimePolicy: GenesisTimePolicy;
  readonly moduleRegistry: readonly string[];
};

export function rehearsalZeroAllocation(): GenesisAssetAllocationManifest {
  const base = emptyAllocationManifest();
  return Object.freeze({
    ...base,
    notes:
      'Dress-rehearsal allocation is zero and REHEARSAL_ONLY. It is not copied from economic rehearsal and is not a production allocation.',
  });
}

export function allocationStatusOf(
  allocation: GenesisAssetAllocationManifest,
  environmentClass: 'PRODUCTION' | 'DRESS_REHEARSAL',
): 'UNAPPROVED' | 'REHEARSAL_ONLY' | 'APPROVED' {
  if (environmentClass === 'DRESS_REHEARSAL') {
    return 'REHEARSAL_ONLY';
  }
  if (allocation.productionAllocationAuthorized) {
    return 'APPROVED';
  }
  return 'UNAPPROVED';
}

export function rejectRehearsalAllocationAsProduction(allocation: GenesisAssetAllocationManifest): void {
  if (allocation.notes.includes('REHEARSAL_ONLY') && allocation.productionAllocationAuthorized) {
    throw new TypeError('rehearsal allocation cannot authorize production genesis');
  }
  rejectUnapprovedAllocation(allocation);
}

export function encodeProductionGenesis(input: ProductionGenesisInput): Buffer {
  if (input.plan.environmentClass === 'DRESS_REHEARSAL') {
    assertDressRehearsalIdentity(input.plan.networkId, input.plan.chainId, input.plan.addressHrp);
  }
  if (input.plan.mainnetEnabled) {
    throw new TypeError('ceremony genesis must not enable mainnet');
  }
  rejectUnsupportedPqHsmRequirement(productionCandidateCryptoPolicy());
  rejectRehearsalAllocationAsProduction(input.allocation);
  const domain = input.plan.environmentClass === 'DRESS_REHEARSAL' ? REHEARSAL_GENESIS_DOMAIN : PRODUCTION_GENESIS_DOMAIN;
  const tag = input.plan.environmentClass === 'DRESS_REHEARSAL' ? REHEARSAL_GENESIS_TAG : PRODUCTION_GENESIS_TAG;
  const modules = [...input.moduleRegistry].sort((a, b) => a.localeCompare(b));
  const moduleHashes = modules.map((name) => moduleHash(name, input.plan.protocolVersion));
  const parts = [
    encodeString(domain),
    encodeString(tag),
    encodeString(input.plan.networkId),
    encodeString(input.plan.chainId),
    encodeString(input.plan.protocolVersion),
    encodeString(input.plan.mainnetRcId),
    encodeString(input.plan.mainnetRcHash),
    encodeString(input.plan.candidateV2Id),
    encodeString(input.plan.candidateV2RootHash),
    encodeString(input.validatorSetHash),
    encodeString(input.validatorKeysHash),
    encodeString(input.governanceKeysHash),
    encodeString(input.plan.cryptoPolicyId),
    encodeString(input.plan.cryptoPolicyHash),
    encodeString(input.plan.economicBundleHash),
    encodeString(PRODUCTION_CANDIDATE_FEE_POLICY),
    encodeString(TREASURY_POLICY_ID),
    encodeString(allocationManifestHash(input.allocation)),
    encodeString(input.genesisTimePolicy.procedureId),
    encodeString(input.genesisTimePolicy.state),
    encodeU64(input.genesisTimePolicy.selectedUnixMs ?? 0n),
    encodeBool(false),
    encodeU32(moduleHashes.length),
  ];
  for (const hash of moduleHashes) {
    parts.push(encodeString(hash));
  }
  parts.push(encodeString(NATIVE_ASSET_TICKER_STATUS), encodeBool(false), encodeBool(false));
  return Buffer.concat(parts);
}

export function productionGenesisHashOf(input: ProductionGenesisInput): string {
  return sha256Hex(encodeProductionGenesis(input));
}

export function buildProductionGenesisManifest(input: ProductionGenesisInput): ProductionGenesisManifest {
  const modules = [...input.moduleRegistry].sort((a, b) => a.localeCompare(b));
  return Object.freeze({
    schemaVersion: 1,
    presentation: 'JSON_NOT_CONSENSUS',
    networkId: input.plan.networkId,
    chainId: input.plan.chainId,
    protocolVersion: input.plan.protocolVersion,
    mainnetRcId: input.plan.mainnetRcId,
    mainnetRcHash: input.plan.mainnetRcHash,
    candidateV2Id: input.plan.candidateV2Id,
    candidateV2RootHash: input.plan.candidateV2RootHash,
    validatorSetHash: input.validatorSetHash,
    validatorKeysHash: input.validatorKeysHash,
    governanceKeysHash: input.governanceKeysHash,
    cryptoPolicy: productionCandidateCryptoPolicy(),
    economicPolicyHash: input.plan.economicBundleHash,
    feePolicy: PRODUCTION_CANDIDATE_FEE_POLICY,
    treasuryPolicy: TREASURY_POLICY_ID,
    allocation: input.allocation,
    allocationHash: allocationManifestHash(input.allocation),
    genesisTimePolicy: input.genesisTimePolicy,
    moduleHashes: Object.freeze(modules.map((name) => moduleHash(name, input.plan.protocolVersion))),
    tickerStatus: 'NOT_ASSIGNED',
    environment: 'simulation',
    productionActivated: false,
    mainnetEnabled: false,
  });
}

export function jsonPresentationIsNotConsensus(input: ProductionGenesisInput): boolean {
  const canonical = productionGenesisHashOf(input);
  const jsonHash = sha256Hex(
    Buffer.from(
      JSON.stringify(buildProductionGenesisManifest(input), (_key, inner) =>
        typeof inner === 'bigint' ? inner.toString() : inner,
      ),
      'utf8',
    ),
  );
  return canonical !== jsonHash;
}

export function defaultModuleRegistry(): readonly string[] {
  return CANDIDATE_MODULE_REGISTRY;
}
