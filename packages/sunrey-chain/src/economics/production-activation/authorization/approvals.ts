import {
  commitGovernance,
  ed25519FromSeed,
  seedFromLabel,
  signHex,
  verifyHex,
} from '../../../governance-ops/hash.ts';
import type { GovernanceApprovalRecord, GovernanceApprovalSet, GovernanceOpsActorKind, GovernanceOpsRole } from '../../../governance-ops/types.ts';

import {
  REJECTED_APPROVAL_ACTOR_KINDS,
  REQUIRED_HUMAN_AUTHORIZATION_ROLES,
  type ProductionEconomicApprovalBinding,
  type ProductionEconomicAuthorizationPackage,
} from './types.ts';

export function productionApprovalPayload(input: {
  readonly authorizationHash: string;
  readonly parameterDiffHash: string;
  readonly evidenceBundleHash: string;
  readonly operatingScopeHash: string;
  readonly providerBindingHash: string;
  readonly economicRcHash: string;
  readonly fullPlatformCandidateHash: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly policyVersion: number;
  readonly approvalValidUntilUtc: string;
  readonly role: GovernanceOpsRole;
  readonly actorId: string;
}): string {
  return commitGovernance({
    kind: 'PRODUCTION_ECONOMIC_AUTHORIZATION_APPROVAL',
    ...input,
  });
}

export function signProductionApproval(input: {
  readonly actorId: string;
  readonly actorKind: GovernanceOpsActorKind;
  readonly role: GovernanceOpsRole;
  readonly pkg: ProductionEconomicAuthorizationPackage;
  readonly parameterDiffHash: string;
  readonly evidenceBundleHash: string;
  readonly operatingScopeHash: string;
  readonly providerBindingHash: string;
  readonly signedAtUtc?: string;
  readonly policyVersion?: number;
}): ProductionEconomicApprovalBinding {
  const policyVersion = input.policyVersion ?? 1;
  const payload = productionApprovalPayload({
    authorizationHash: input.pkg.authorizationHash,
    parameterDiffHash: input.parameterDiffHash,
    evidenceBundleHash: input.evidenceBundleHash,
    operatingScopeHash: input.operatingScopeHash,
    providerBindingHash: input.providerBindingHash,
    economicRcHash: input.pkg.economicRcHash,
    fullPlatformCandidateHash: input.pkg.fullPlatformCandidateHash,
    networkId: input.pkg.networkId,
    chainId: input.pkg.chainId,
    policyVersion,
    approvalValidUntilUtc: input.pkg.approvalWindow.validUntilUtc,
    role: input.role,
    actorId: input.actorId,
  });
  const seed = seedFromLabel(input.actorId);
  const keys = ed25519FromSeed(seed);
  const rejectedKind = (REJECTED_APPROVAL_ACTOR_KINDS as readonly string[]).includes(input.actorKind);
  const aiAnalyst = input.role === 'AI_ANALYST';
  if (input.actorKind !== 'HUMAN' || rejectedKind || aiAnalyst) {
    const reason =
      input.actorKind === 'AGENT'
        ? 'AGENT_CANNOT_APPROVE'
        : input.actorKind === 'AUTOMATION'
          ? 'AUTOMATION_CANNOT_APPROVE'
          : 'AI_CANNOT_APPROVE';
    return bindingOf({
      record: unsignedRecord(input, keys.publicKeyHex, reason),
      pkg: input.pkg,
      hashes: input,
      policyVersion,
      accepted: false,
      rejectionReason: reason,
    });
  }
  return bindingOf({
    record: Object.freeze({
      actorId: input.actorId,
      actorKind: 'HUMAN',
      role: input.role,
      packageHash: input.pkg.authorizationHash,
      networkId: input.pkg.networkId,
      chainId: input.pkg.chainId,
      policyVersion,
      activationHeight: 0,
      signedAtUtc: input.signedAtUtc ?? input.pkg.approvalWindow.validFromUtc,
      publicKeyHex: keys.publicKeyHex,
      signatureHex: signHex(seed, payload),
      accepted: true,
      rejectionReason: null,
    }),
    pkg: input.pkg,
    hashes: input,
    policyVersion,
    accepted: true,
    rejectionReason: null,
  });
}

export function evaluateProductionApprovals(input: {
  readonly pkg: ProductionEconomicAuthorizationPackage;
  readonly bindings: readonly ProductionEconomicApprovalBinding[];
  readonly nowUtc: string;
  readonly currentEvidenceHash: string;
  readonly currentOperatingScopeHash: string;
  readonly currentProviderHash: string;
  readonly currentParameterDiffHash: string;
  readonly currentEconomicRcHash: string;
  readonly currentFullPlatformHash: string;
}): {
  readonly set: GovernanceApprovalSet;
  readonly bindings: readonly ProductionEconomicApprovalBinding[];
} {
  const judged = input.bindings.map((row) => refreshBinding(row, input));
  const accepted = judged.filter((row) => row.accepted);
  const roles = new Set(accepted.map((row) => row.record.role));
  const actors = new Set(accepted.map((row) => row.record.actorId));
  const distinctOk = REQUIRED_HUMAN_AUTHORIZATION_ROLES.every((role) => {
    const holders = accepted.filter((row) => row.record.role === role).map((row) => row.record.actorId);
    return holders.length === 1;
  });
  const noSharedActors = actors.size === accepted.length;
  const satisfied =
    distinctOk &&
    noSharedActors &&
    REQUIRED_HUMAN_AUTHORIZATION_ROLES.every((role) => roles.has(role)) &&
    actors.size === REQUIRED_HUMAN_AUTHORIZATION_ROLES.length;
  return {
    set: Object.freeze({
      requiredRoles: REQUIRED_HUMAN_AUTHORIZATION_ROLES,
      minimumDistinctActors: REQUIRED_HUMAN_AUTHORIZATION_ROLES.length,
      records: Object.freeze(judged.map((row) => row.record)),
      satisfied,
    }),
    bindings: Object.freeze(judged),
  };
}

export function fixtureProcessApprovals(
  pkg: ProductionEconomicAuthorizationPackage,
  hashes: {
    readonly parameterDiffHash: string;
    readonly evidenceBundleHash: string;
    readonly operatingScopeHash: string;
    readonly providerBindingHash: string;
  },
): readonly ProductionEconomicApprovalBinding[] {
  return Object.freeze(
    REQUIRED_HUMAN_AUTHORIZATION_ROLES.map((role, index) =>
      signProductionApproval({
        actorId: `fixture-human-${role.toLowerCase()}-${index + 1}`,
        actorKind: 'HUMAN',
        role,
        pkg,
        ...hashes,
        signedAtUtc: pkg.approvalWindow.validFromUtc,
      }),
    ),
  );
}

function refreshBinding(
  row: ProductionEconomicApprovalBinding,
  input: {
    readonly pkg: ProductionEconomicAuthorizationPackage;
    readonly nowUtc: string;
    readonly currentEvidenceHash: string;
    readonly currentOperatingScopeHash: string;
    readonly currentProviderHash: string;
    readonly currentParameterDiffHash: string;
    readonly currentEconomicRcHash: string;
    readonly currentFullPlatformHash: string;
  },
): ProductionEconomicApprovalBinding {
  if (!row.record.accepted || row.record.actorKind !== 'HUMAN' || row.record.role === 'AI_ANALYST') {
    return row;
  }
  if (input.nowUtc > input.pkg.approvalWindow.validUntilUtc || input.nowUtc < input.pkg.approvalWindow.validFromUtc) {
    return stale(row, 'STALE_SIGNATURE');
  }
  if (row.authorizationHash !== input.pkg.authorizationHash) {
    return stale(row, 'PARAMETER_HASH_CHANGED');
  }
  if (row.parameterDiffHash !== input.currentParameterDiffHash) {
    return stale(row, 'PARAMETER_HASH_CHANGED');
  }
  if (row.economicRcHash !== input.currentEconomicRcHash || row.fullPlatformCandidateHash !== input.currentFullPlatformHash) {
    return stale(row, 'RELEASE_HASH_CHANGED');
  }
  if (row.evidenceBundleHash !== input.currentEvidenceHash) {
    return stale(row, 'EVIDENCE_HASH_CHANGED');
  }
  if (row.operatingScopeHash !== input.currentOperatingScopeHash) {
    return stale(row, 'OPERATING_SCOPE_CHANGED');
  }
  if (row.providerBindingHash !== input.currentProviderHash) {
    return stale(row, 'PROVIDER_MATRIX_CHANGED');
  }
  const payload = productionApprovalPayload({
    authorizationHash: row.authorizationHash,
    parameterDiffHash: row.parameterDiffHash,
    evidenceBundleHash: row.evidenceBundleHash,
    operatingScopeHash: row.operatingScopeHash,
    providerBindingHash: row.providerBindingHash,
    economicRcHash: row.economicRcHash,
    fullPlatformCandidateHash: row.fullPlatformCandidateHash,
    networkId: row.record.networkId,
    chainId: row.record.chainId,
    policyVersion: row.record.policyVersion,
    approvalValidUntilUtc: row.approvalValidUntilUtc,
    role: row.record.role,
    actorId: row.record.actorId,
  });
  if (!verifyHex(row.record.publicKeyHex, payload, row.record.signatureHex)) {
    return stale(row, 'STALE_SIGNATURE');
  }
  return row;
}

function stale(row: ProductionEconomicApprovalBinding, reason: string): ProductionEconomicApprovalBinding {
  return Object.freeze({
    ...row,
    accepted: false,
    rejectionReason: reason,
    record: Object.freeze({ ...row.record, accepted: false, rejectionReason: reason }),
  });
}

function unsignedRecord(
  input: {
    readonly actorId: string;
    readonly actorKind: GovernanceOpsActorKind;
    readonly role: GovernanceOpsRole;
    readonly pkg: ProductionEconomicAuthorizationPackage;
    readonly signedAtUtc?: string;
  },
  publicKeyHex: string,
  reason: string,
): GovernanceApprovalRecord {
  return Object.freeze({
    actorId: input.actorId,
    actorKind: input.actorKind,
    role: input.role,
    packageHash: input.pkg.authorizationHash,
    networkId: input.pkg.networkId,
    chainId: input.pkg.chainId,
    policyVersion: 1,
    activationHeight: 0,
    signedAtUtc: input.signedAtUtc ?? input.pkg.approvalWindow.validFromUtc,
    publicKeyHex,
    signatureHex: '',
    accepted: false,
    rejectionReason: reason,
  });
}

function bindingOf(input: {
  readonly record: GovernanceApprovalRecord;
  readonly pkg: ProductionEconomicAuthorizationPackage;
  readonly hashes: {
    readonly parameterDiffHash: string;
    readonly evidenceBundleHash: string;
    readonly operatingScopeHash: string;
    readonly providerBindingHash: string;
  };
  readonly policyVersion: number;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
}): ProductionEconomicApprovalBinding {
  return Object.freeze({
    record: input.record,
    authorizationHash: input.pkg.authorizationHash,
    parameterDiffHash: input.hashes.parameterDiffHash,
    evidenceBundleHash: input.hashes.evidenceBundleHash,
    operatingScopeHash: input.hashes.operatingScopeHash,
    providerBindingHash: input.hashes.providerBindingHash,
    economicRcHash: input.pkg.economicRcHash,
    fullPlatformCandidateHash: input.pkg.fullPlatformCandidateHash,
    policyVersion: input.policyVersion,
    approvalValidUntilUtc: input.pkg.approvalWindow.validUntilUtc,
    accepted: input.accepted,
    rejectionReason: input.rejectionReason,
  });
}
