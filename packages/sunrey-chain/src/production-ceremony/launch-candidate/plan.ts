/**
 * Frozen-candidate binding and launch-ceremony plan.
 *
 * A ceremony session binds one exact Chunk 164 freeze hash. Changing
 * any constituent hash requires a new freeze, a new session, and new
 * signatures. The session does not recompute a hash and continue.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';
import { rehearsalGenesisTimePolicy } from '../plan.ts';
import { emptyTranscript } from '../transcript.ts';
import {
  LAUNCH_CEREMONY_BINDING_DOMAIN,
  LAUNCH_CEREMONY_PLAN_DOMAIN,
  LAUNCH_CEREMONY_SCHEMA_VERSION,
  REQUIRED_LAUNCH_HUMAN_ROLES,
  type CeremonyEvidenceWatch,
  type LaunchAuthorizationCeremonySession,
  type LaunchCeremonyPlan,
  type LaunchCeremonySessionIdentity,
  type ProductionLaunchCeremonyBinding,
  type RoleOverlapPolicy,
} from './types.ts';

export const LAUNCH_CEREMONY_REHEARSAL_PLAN_ID = 'plan.sunrey.launch-authorization.rehearsal.v1' as const;
export const LAUNCH_CEREMONY_REHEARSAL_NETWORK_ID = 'net_sunrey_launch_authorization_ceremony_rehearsal_1' as const;
export const LAUNCH_CEREMONY_REHEARSAL_CHAIN_ID = 'chn_sunrey_launch_authorization_ceremony_rehearsal_1' as const;

const BINDING_FIELD_ORDER = [
  'launchFreezeId',
  'mainnetRcHash',
  'economicRcHash',
  'economicAuthorizationHash',
  'genesisHash',
  'validatorSetHash',
  'cryptoPolicyHash',
  'externalEvidenceSnapshotHash',
  'operatingScopeSnapshotHash',
  'providerBindingSnapshotHash',
  'sourceCommit',
] as const;

export function computeLaunchFreezeHash(
  input: Omit<ProductionLaunchCeremonyBinding, 'schemaVersion' | 'launchFreezeHash'>,
): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(LAUNCH_CEREMONY_BINDING_DOMAIN),
      ...BINDING_FIELD_ORDER.map((key) => encodeString(input[key])),
    ]),
  );
}

export function freezeLaunchCeremonyBinding(
  input: Omit<ProductionLaunchCeremonyBinding, 'schemaVersion' | 'launchFreezeHash'> & {
    readonly launchFreezeHash?: string;
  },
): ProductionLaunchCeremonyBinding {
  const computed = computeLaunchFreezeHash(input);
  if (input.launchFreezeHash && input.launchFreezeHash !== computed) {
    throw new TypeError('CEREMONY_CANDIDATE_MISMATCH: presented launchFreezeHash does not match bound fields');
  }
  return Object.freeze({
    schemaVersion: LAUNCH_CEREMONY_SCHEMA_VERSION,
    launchFreezeId: input.launchFreezeId,
    launchFreezeHash: computed,
    mainnetRcHash: input.mainnetRcHash,
    economicRcHash: input.economicRcHash,
    economicAuthorizationHash: input.economicAuthorizationHash,
    genesisHash: input.genesisHash,
    validatorSetHash: input.validatorSetHash,
    cryptoPolicyHash: input.cryptoPolicyHash,
    externalEvidenceSnapshotHash: input.externalEvidenceSnapshotHash,
    operatingScopeSnapshotHash: input.operatingScopeSnapshotHash,
    providerBindingSnapshotHash: input.providerBindingSnapshotHash,
    sourceCommit: input.sourceCommit,
  });
}

export function bindingFromLaunchFreeze(freeze: {
  readonly launchFreezeId: string;
  readonly launchFreezeHash?: string;
  readonly mainnetRcHash: string;
  readonly economicRcHash: string;
  readonly economicAuthorizationHash: string;
  readonly genesisHash: string;
  readonly validatorSetHash: string;
  readonly cryptoPolicyHash: string;
  readonly externalEvidenceSnapshotHash: string;
  readonly operatingScopeSnapshotHash: string;
  readonly providerBindingSnapshotHash: string;
  readonly sourceCommit: string;
}): ProductionLaunchCeremonyBinding {
  return freezeLaunchCeremonyBinding(freeze);
}

export function assertBindingMatches(
  bound: ProductionLaunchCeremonyBinding,
  current: ProductionLaunchCeremonyBinding,
): void {
  const expected = computeLaunchFreezeHash(current);
  if (current.launchFreezeHash !== expected) {
    throw new TypeError('CEREMONY_CANDIDATE_MISMATCH: current freeze hash is stale or tampered');
  }
  if (
    bound.launchFreezeHash !== current.launchFreezeHash ||
    bound.launchFreezeId !== current.launchFreezeId ||
    bound.mainnetRcHash !== current.mainnetRcHash ||
    bound.economicRcHash !== current.economicRcHash ||
    bound.economicAuthorizationHash !== current.economicAuthorizationHash ||
    bound.genesisHash !== current.genesisHash ||
    bound.validatorSetHash !== current.validatorSetHash ||
    bound.cryptoPolicyHash !== current.cryptoPolicyHash ||
    bound.externalEvidenceSnapshotHash !== current.externalEvidenceSnapshotHash ||
    bound.operatingScopeSnapshotHash !== current.operatingScopeSnapshotHash ||
    bound.providerBindingSnapshotHash !== current.providerBindingSnapshotHash ||
    bound.sourceCommit !== current.sourceCommit
  ) {
    throw new TypeError('CEREMONY_CANDIDATE_MISMATCH');
  }
}

export function launchCeremonyPlanHash(plan: Omit<LaunchCeremonyPlan, 'planHash'>): string {
  return sha256Hex(
    Buffer.concat([
      encodeString(LAUNCH_CEREMONY_PLAN_DOMAIN),
      encodeString(plan.planId),
      encodeString(String(plan.planVersion)),
      encodeString(plan.environmentClass),
      encodeString(plan.binding.launchFreezeHash),
      encodeString(plan.networkId),
      encodeString(plan.chainId),
      encodeString(plan.requiredHumanRoles.join(',')),
      encodeString(plan.roleOverlapPolicy.allowIndependentRoleOverlap ? '1' : '0'),
      encodeString(plan.genesisTimePolicy.procedureId),
    ]),
  );
}

export function createLaunchCeremonyPlan(input: {
  readonly binding: ProductionLaunchCeremonyBinding;
  readonly networkId?: string;
  readonly chainId?: string;
  readonly environmentClass?: 'DRESS_REHEARSAL' | 'PRODUCTION';
  readonly roleOverlapPolicy?: RoleOverlapPolicy;
}): LaunchCeremonyPlan {
  const expected = computeLaunchFreezeHash(input.binding);
  if (input.binding.launchFreezeHash !== expected) {
    throw new TypeError('CEREMONY_CANDIDATE_MISMATCH: freeze hash unbound or stale');
  }
  const draft: Omit<LaunchCeremonyPlan, 'planHash'> = {
    schemaVersion: LAUNCH_CEREMONY_SCHEMA_VERSION,
    planId: LAUNCH_CEREMONY_REHEARSAL_PLAN_ID,
    planVersion: 1,
    environmentClass: input.environmentClass ?? 'DRESS_REHEARSAL',
    binding: input.binding,
    networkId: input.networkId ?? LAUNCH_CEREMONY_REHEARSAL_NETWORK_ID,
    chainId: input.chainId ?? LAUNCH_CEREMONY_REHEARSAL_CHAIN_ID,
    requiredHumanRoles: REQUIRED_LAUNCH_HUMAN_ROLES,
    roleOverlapPolicy: input.roleOverlapPolicy ?? Object.freeze({ allowIndependentRoleOverlap: false }),
    genesisTimePolicy: rehearsalGenesisTimePolicy(),
    usableForProduction: false,
    realProductionKeysCreated: false,
    mainnetEnabled: false,
    productionActivated: false,
  };
  return Object.freeze({
    ...draft,
    planHash: launchCeremonyPlanHash(draft),
  });
}

export function createSessionIdentity(
  sessionId: string,
  plan: LaunchCeremonyPlan,
): LaunchCeremonySessionIdentity {
  return Object.freeze({
    sessionId,
    planHash: plan.planHash,
    launchFreezeHash: plan.binding.launchFreezeHash,
    networkId: plan.networkId,
    chainId: plan.chainId,
    genesisHashCandidate: plan.binding.genesisHash,
  });
}

export function openLaunchCeremonySession(input: {
  readonly sessionId: string;
  readonly plan: LaunchCeremonyPlan;
  readonly evidence: CeremonyEvidenceWatch;
}): LaunchAuthorizationCeremonySession {
  const identity = createSessionIdentity(input.sessionId, input.plan);
  return Object.freeze({
    sessionId: input.sessionId,
    identity,
    plan: input.plan,
    binding: input.plan.binding,
    participants: Object.freeze([]),
    state: 'PLANNED',
    transcript: emptyTranscript(input.sessionId),
    offlinePackages: Object.freeze([]),
    signatures: Object.freeze([]),
    evidence: input.evidence,
    hsmAttestation: null,
    hsmClass: 'SIMULATION_HSM',
    abort: null,
    authorization: null,
    realProductionKeysCreated: false,
    realHumanSignaturesCollected: false,
    aiSatisfiesHumanRole: false,
    mainnetEnabled: false,
    productionActivated: false,
  });
}
