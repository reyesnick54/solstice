import { type Brand, brandAs } from '../../domain/src/brand.ts';
import { newSecurityToken } from '../../security/src/random.ts';

export type CleanRoomId = Brand<string, 'CleanRoomId'>;
export type CleanRoomSessionId = Brand<string, 'CleanRoomSessionId'>;
export type CleanRoomJobId = Brand<string, 'CleanRoomJobId'>;
export type CleanRoomDatasetId = Brand<string, 'CleanRoomDatasetId'>;
export type CleanRoomQueryId = Brand<string, 'CleanRoomQueryId'>;
export type QueryTemplateId = Brand<string, 'QueryTemplateId'>;
export type QueryTemplateVersion = Brand<string, 'QueryTemplateVersion'>;
export type ComputationReceiptId = Brand<string, 'ComputationReceiptId'>;
export type EgressDecisionId = Brand<string, 'EgressDecisionId'>;
export type PrivacyPolicyVersion = Brand<string, 'PrivacyPolicyVersion'>;
export type PseudonymousJoinKeyId = Brand<string, 'PseudonymousJoinKeyId'>;
export type ContributionComputationId = Brand<string, 'ContributionComputationId'>;
export type CleanRoomRequesterId = Brand<string, 'CleanRoomRequesterId'>;
export type AuthorizationSnapshotId = Brand<string, 'AuthorizationSnapshotId'>;

export const CLEAN_ROOM_ID_PREFIXES = Object.freeze({
  room: 'crm_',
  session: 'crs_',
  job: 'crj_',
  dataset: 'crd_',
  query: 'crq_',
  template: 'crt_',
  templateVersion: 'crtv_',
  receipt: 'crr_',
  egress: 'cre_',
  policy: 'ppv_',
  join: 'pjk_',
  contribution: 'ccc_',
  requester: 'crp_',
  snapshot: 'cas_',
});

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asCleanRoomId(value: string): CleanRoomId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.room, 'CleanRoomId');
}
export function asCleanRoomSessionId(value: string): CleanRoomSessionId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.session, 'CleanRoomSessionId');
}
export function asCleanRoomJobId(value: string): CleanRoomJobId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.job, 'CleanRoomJobId');
}
export function asCleanRoomDatasetId(value: string): CleanRoomDatasetId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.dataset, 'CleanRoomDatasetId');
}
export function asCleanRoomQueryId(value: string): CleanRoomQueryId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.query, 'CleanRoomQueryId');
}
export function asQueryTemplateId(value: string): QueryTemplateId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.template, 'QueryTemplateId');
}
export function asQueryTemplateVersion(value: string): QueryTemplateVersion {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.templateVersion, 'QueryTemplateVersion');
}
export function asComputationReceiptId(value: string): ComputationReceiptId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.receipt, 'ComputationReceiptId');
}
export function asEgressDecisionId(value: string): EgressDecisionId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.egress, 'EgressDecisionId');
}
export function asPrivacyPolicyVersion(value: string): PrivacyPolicyVersion {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.policy, 'PrivacyPolicyVersion');
}
export function asPseudonymousJoinKeyId(value: string): PseudonymousJoinKeyId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.join, 'PseudonymousJoinKeyId');
}
export function asContributionComputationId(value: string): ContributionComputationId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.contribution, 'ContributionComputationId');
}
export function asCleanRoomRequesterId(value: string): CleanRoomRequesterId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.requester, 'CleanRoomRequesterId');
}
export function asAuthorizationSnapshotId(value: string): AuthorizationSnapshotId {
  return asPrefixed(value, CLEAN_ROOM_ID_PREFIXES.snapshot, 'AuthorizationSnapshotId');
}

export function newCleanRoomId(): CleanRoomId {
  return asCleanRoomId(`${CLEAN_ROOM_ID_PREFIXES.room}${newSecurityToken()}`);
}
export function newCleanRoomSessionId(): CleanRoomSessionId {
  return asCleanRoomSessionId(`${CLEAN_ROOM_ID_PREFIXES.session}${newSecurityToken()}`);
}
export function newCleanRoomJobId(): CleanRoomJobId {
  return asCleanRoomJobId(`${CLEAN_ROOM_ID_PREFIXES.job}${newSecurityToken()}`);
}
export function newCleanRoomDatasetId(): CleanRoomDatasetId {
  return asCleanRoomDatasetId(`${CLEAN_ROOM_ID_PREFIXES.dataset}${newSecurityToken()}`);
}
export function newCleanRoomQueryId(): CleanRoomQueryId {
  return asCleanRoomQueryId(`${CLEAN_ROOM_ID_PREFIXES.query}${newSecurityToken()}`);
}
export function newComputationReceiptId(): ComputationReceiptId {
  return asComputationReceiptId(`${CLEAN_ROOM_ID_PREFIXES.receipt}${newSecurityToken()}`);
}
export function newEgressDecisionId(): EgressDecisionId {
  return asEgressDecisionId(`${CLEAN_ROOM_ID_PREFIXES.egress}${newSecurityToken()}`);
}
export function newContributionComputationId(): ContributionComputationId {
  return asContributionComputationId(`${CLEAN_ROOM_ID_PREFIXES.contribution}${newSecurityToken()}`);
}
export function newAuthorizationSnapshotId(): AuthorizationSnapshotId {
  return asAuthorizationSnapshotId(`${CLEAN_ROOM_ID_PREFIXES.snapshot}${newSecurityToken()}`);
}

export function queryTemplateIdFor(code: string): QueryTemplateId {
  return asQueryTemplateId(`${CLEAN_ROOM_ID_PREFIXES.template}${code}`);
}
export function queryTemplateVersionFor(code: string, version: number): QueryTemplateVersion {
  return asQueryTemplateVersion(`${CLEAN_ROOM_ID_PREFIXES.templateVersion}${code}_${version}`);
}
export function privacyPolicyVersionFor(code: string, version: number): PrivacyPolicyVersion {
  return asPrivacyPolicyVersion(`${CLEAN_ROOM_ID_PREFIXES.policy}${code}_${version}`);
}
export function requesterIdFor(code: string): CleanRoomRequesterId {
  return asCleanRoomRequesterId(`${CLEAN_ROOM_ID_PREFIXES.requester}${code}`);
}
export function joinKeyIdFor(tokenHex: string): PseudonymousJoinKeyId {
  return asPseudonymousJoinKeyId(`${CLEAN_ROOM_ID_PREFIXES.join}${tokenHex.slice(0, 32)}`);
}
