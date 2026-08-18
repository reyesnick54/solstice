/**
 * ProductionGenesisCeremonyPlan.
 *
 * A plan binds one exact Mainnet RC and one exact Candidate V2 root
 * hash. Changing either requires a new plan version.
 */

import { PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID } from '../mainnet/crypto-policy.ts';
import { encodeString, encodeU32, sha256Hex } from '../validators/canonical.ts';
import {
  DRESS_REHEARSAL_ADDRESS_HRP,
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  EXPECTED_CANDIDATE_V2_ID,
  EXPECTED_MAINNET_RC_ID,
  PRODUCTION_GENESIS_AUTHORITY_ID,
  PRODUCTION_PROTOCOL_AUTHORITY_ID,
  PRODUCTION_RELEASE_AUTHORITY_ID,
  PRODUCTION_SECURITY_AUTHORITY_ID,
} from './identity.ts';
import { REQUIRED_PRODUCTION_HUMAN_ROLES, type GenesisTimePolicy, type ProductionGenesisCeremonyPlan } from './types.ts';

export const PLAN_DOMAIN = 'SUNREY_PRODUCTION_GENESIS_CEREMONY_PLAN_V1' as const;

export function defaultGenesisTimePolicy(): GenesisTimePolicy {
  return Object.freeze({
    procedureId: 'sunrey.genesis-time.governed.v1',
    state: 'PROCEDURE_DEFINED',
    selectedUnixMs: null,
    selectedUtc: null,
    usesDeveloperLocalClock: false,
    notes:
      'Actual production genesis time remains part of the authorized launch procedure. This plan does not read a developer-local clock.',
  });
}

export function rehearsalGenesisTimePolicy(): GenesisTimePolicy {
  return Object.freeze({
    procedureId: 'sunrey.genesis-time.dress-rehearsal.v1',
    state: 'PROCEDURE_DEFINED',
    selectedUnixMs: null,
    selectedUtc: null,
    usesDeveloperLocalClock: false,
    notes: 'Dress-rehearsal time is a fixture procedure, not a production launch time.',
  });
}

export function planHash(plan: ProductionGenesisCeremonyPlan): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(PLAN_DOMAIN),
      encodeString(plan.planId),
      encodeU32(plan.planVersion),
      encodeString(plan.environmentClass),
      encodeString(plan.mainnetRcId),
      encodeString(plan.mainnetRcHash),
      encodeString(plan.candidateV2Id),
      encodeString(plan.candidateV2RootHash),
      encodeString(plan.protocolVersion),
      encodeString(plan.economicBundleHash),
      encodeString(plan.cryptoPolicyId),
      encodeString(plan.cryptoPolicyHash),
      encodeString(plan.validatorCandidateSetHash),
      encodeString(plan.governanceAuthorityId),
      encodeString(plan.releaseAuthorityId),
      encodeString(plan.genesisAuthorityId),
      encodeString(plan.networkId),
      encodeString(plan.chainId),
      encodeString(plan.addressHrp),
      encodeString(plan.allocationManifestHash),
    ]),
  );
}

export function assertPlanImmutability(
  plan: ProductionGenesisCeremonyPlan,
  next: { readonly mainnetRcHash: string; readonly candidateV2RootHash: string },
): void {
  if (next.mainnetRcHash !== plan.mainnetRcHash || next.candidateV2RootHash !== plan.candidateV2RootHash) {
    throw new TypeError('changing Mainnet RC or Candidate V2 requires a new ceremony plan version');
  }
}

export function createProductionCeremonyPlan(input: {
  readonly mainnetRcId?: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id?: string;
  readonly candidateV2RootHash: string;
  readonly protocolVersion?: string;
  readonly economicBundleHash: string;
  readonly cryptoPolicyHash: string;
  readonly validatorCandidateSetHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly allocationManifestHash: string;
  readonly planVersion?: number;
}): ProductionGenesisCeremonyPlan {
  return Object.freeze({
    schemaVersion: 1,
    planId: 'plan.sunrey.production-genesis.v1',
    planVersion: input.planVersion ?? 1,
    environmentClass: 'PRODUCTION',
    mainnetRcId: input.mainnetRcId ?? EXPECTED_MAINNET_RC_ID,
    mainnetRcHash: input.mainnetRcHash,
    candidateV2Id: input.candidateV2Id ?? EXPECTED_CANDIDATE_V2_ID,
    candidateV2RootHash: input.candidateV2RootHash,
    protocolVersion: input.protocolVersion ?? '1',
    economicBundleHash: input.economicBundleHash,
    cryptoPolicyId: PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID,
    cryptoPolicyHash: input.cryptoPolicyHash,
    validatorCandidateSetHash: input.validatorCandidateSetHash,
    governanceAuthorityId: PRODUCTION_PROTOCOL_AUTHORITY_ID,
    releaseAuthorityId: PRODUCTION_RELEASE_AUTHORITY_ID,
    genesisAuthorityId: PRODUCTION_GENESIS_AUTHORITY_ID,
    networkId: input.networkId,
    chainId: input.chainId,
    addressHrp: input.addressHrp,
    allocationManifestHash: input.allocationManifestHash,
    requiredHumanRoles: REQUIRED_PRODUCTION_HUMAN_ROLES,
    requiredApprovals: REQUIRED_PRODUCTION_HUMAN_ROLES.length,
    genesisTimePolicy: defaultGenesisTimePolicy(),
    usableForProduction: false,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
}

export function createDressRehearsalCeremonyPlan(input: {
  readonly mainnetRcId?: string;
  readonly mainnetRcHash: string;
  readonly candidateV2Id?: string;
  readonly candidateV2RootHash: string;
  readonly economicBundleHash: string;
  readonly cryptoPolicyHash: string;
  readonly validatorCandidateSetHash: string;
  readonly allocationManifestHash: string;
}): ProductionGenesisCeremonyPlan {
  return Object.freeze({
    schemaVersion: 1,
    planId: `plan.${DRESS_REHEARSAL_ID}`,
    planVersion: 1,
    environmentClass: 'DRESS_REHEARSAL',
    mainnetRcId: input.mainnetRcId ?? EXPECTED_MAINNET_RC_ID,
    mainnetRcHash: input.mainnetRcHash,
    candidateV2Id: input.candidateV2Id ?? EXPECTED_CANDIDATE_V2_ID,
    candidateV2RootHash: input.candidateV2RootHash,
    protocolVersion: '1',
    economicBundleHash: input.economicBundleHash,
    cryptoPolicyId: PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID,
    cryptoPolicyHash: input.cryptoPolicyHash,
    validatorCandidateSetHash: input.validatorCandidateSetHash,
    governanceAuthorityId: PRODUCTION_PROTOCOL_AUTHORITY_ID,
    releaseAuthorityId: PRODUCTION_RELEASE_AUTHORITY_ID,
    genesisAuthorityId: PRODUCTION_GENESIS_AUTHORITY_ID,
    networkId: DRESS_REHEARSAL_NETWORK_ID,
    chainId: DRESS_REHEARSAL_CHAIN_ID,
    addressHrp: DRESS_REHEARSAL_ADDRESS_HRP,
    allocationManifestHash: input.allocationManifestHash,
    requiredHumanRoles: REQUIRED_PRODUCTION_HUMAN_ROLES,
    requiredApprovals: REQUIRED_PRODUCTION_HUMAN_ROLES.length,
    genesisTimePolicy: rehearsalGenesisTimePolicy(),
    usableForProduction: false,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
  });
}

export function rejectWrongMainnetRc(plan: ProductionGenesisCeremonyPlan, presentedHash: string): void {
  if (presentedHash !== plan.mainnetRcHash) {
    throw new TypeError('wrong Mainnet RC rejected');
  }
}

export function rejectWrongCandidateV2(plan: ProductionGenesisCeremonyPlan, presentedHash: string): void {
  if (presentedHash !== plan.candidateV2RootHash) {
    throw new TypeError('wrong Candidate V2 rejected');
  }
}

void PRODUCTION_SECURITY_AUTHORITY_ID;
