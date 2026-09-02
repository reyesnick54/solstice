/**
 * Wave 7 — multi-party monetary governance signing architecture.
 *
 * Supports threshold requirements, separation of duties, approval expiry,
 * proposal hashes, and policy version binding. Actual thresholds remain
 * governed configuration — this module does not invent multisig economics.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import { sha256Hex } from '../hash.ts';

export const GOVERNANCE_APPROVAL_ROLES = [
  'PROTOCOL_GOVERNANCE',
  'SECURITY_GOVERNANCE',
  'ECONOMIC_GOVERNANCE',
  'RELEASE_GOVERNANCE',
  'VALIDATOR_GOVERNANCE',
  'OPERATIONS_GOVERNANCE',
] as const;

export type GovernanceApprovalRole = (typeof GOVERNANCE_APPROVAL_ROLES)[number];

export type GovernanceThresholdConfig = {
  readonly operationType: string;
  readonly requiredRoles: readonly GovernanceApprovalRole[];
  readonly minimumApprovals: number;
  readonly separationOfDuties: true;
  readonly approvalTtlSeconds: number;
  readonly policyVersionBinding: true;
};

export type GovernanceApproval = {
  readonly approvalId: string;
  readonly proposalHash: string;
  readonly policyVersion: string;
  readonly role: GovernanceApprovalRole;
  readonly approverId: string;
  readonly approvedAt: string;
  readonly expiresAt: string;
  readonly signatureRef: string;
};

export type GovernanceProposal = {
  readonly proposalId: string;
  readonly operationType: string;
  readonly proposalHash: string;
  readonly policyVersion: string;
  readonly previousStateRef: string;
  readonly newStateRef: string;
  readonly reason: string;
  readonly createdAt: string;
};

export function computeProposalHash(proposal: Omit<GovernanceProposal, 'proposalHash'>): string {
  return sha256Hex(
    JSON.stringify({
      proposalId: proposal.proposalId,
      operationType: proposal.operationType,
      policyVersion: proposal.policyVersion,
      previousStateRef: proposal.previousStateRef,
      newStateRef: proposal.newStateRef,
      reason: proposal.reason,
      createdAt: proposal.createdAt,
    }),
  );
}

export function bindProposal(proposal: Omit<GovernanceProposal, 'proposalHash'>): GovernanceProposal {
  const proposalHash = computeProposalHash(proposal);
  return Object.freeze({ ...proposal, proposalHash });
}

export function evaluateGovernanceThreshold(
  config: GovernanceThresholdConfig,
  approvals: readonly GovernanceApproval[],
  proposal: GovernanceProposal,
  now: string,
): SecurityResult<readonly GovernanceApproval[]> {
  const nowMs = Date.parse(now);
  const valid = approvals.filter((approval) => {
    if (approval.proposalHash !== proposal.proposalHash) {
      return false;
    }
    if (approval.policyVersion !== proposal.policyVersion) {
      return false;
    }
    if (Date.parse(approval.expiresAt) <= nowMs) {
      return false;
    }
    return config.requiredRoles.includes(approval.role);
  });

  const uniqueApprovers = new Set(valid.map((row) => row.approverId));
  if (config.separationOfDuties && uniqueApprovers.size !== valid.length) {
    return securityErr(
      'CEREMONY_APPROVAL_REJECTED',
      'separation of duties requires distinct approvers',
    );
  }

  const rolesPresent = new Set(valid.map((row) => row.role));
  for (const role of config.requiredRoles) {
    if (!rolesPresent.has(role)) {
      return securityErr(
        'CEREMONY_APPROVAL_REJECTED',
        `missing required governance role: ${role}`,
      );
    }
  }

  if (valid.length < config.minimumApprovals) {
    return securityErr(
      'CEREMONY_APPROVAL_REJECTED',
      `threshold not met: ${valid.length}/${config.minimumApprovals}`,
    );
  }

  return securityOk(Object.freeze(valid));
}

export const DEFAULT_GOVERNANCE_THRESHOLDS: readonly GovernanceThresholdConfig[] = Object.freeze([
  {
    operationType: 'monetary.parameter_change',
    requiredRoles: ['ECONOMIC_GOVERNANCE', 'PROTOCOL_GOVERNANCE'],
    minimumApprovals: 2,
    separationOfDuties: true,
    approvalTtlSeconds: 86_400,
    policyVersionBinding: true,
  },
  {
    operationType: 'issuance.sunrey.activate',
    requiredRoles: ['ECONOMIC_GOVERNANCE', 'PROTOCOL_GOVERNANCE', 'SECURITY_GOVERNANCE'],
    minimumApprovals: 3,
    separationOfDuties: true,
    approvalTtlSeconds: 86_400,
    policyVersionBinding: true,
  },
  {
    operationType: 'issuance.moonrey.activate',
    requiredRoles: ['ECONOMIC_GOVERNANCE', 'PROTOCOL_GOVERNANCE', 'SECURITY_GOVERNANCE'],
    minimumApprovals: 3,
    separationOfDuties: true,
    approvalTtlSeconds: 86_400,
    policyVersionBinding: true,
  },
  {
    operationType: 'mainnet.activate',
    requiredRoles: [
      'PROTOCOL_GOVERNANCE',
      'SECURITY_GOVERNANCE',
      'RELEASE_GOVERNANCE',
      'VALIDATOR_GOVERNANCE',
      'ECONOMIC_GOVERNANCE',
    ],
    minimumApprovals: 5,
    separationOfDuties: true,
    approvalTtlSeconds: 43_200,
    policyVersionBinding: true,
  },
  {
    operationType: 'governance.activate_package',
    requiredRoles: ['PROTOCOL_GOVERNANCE', 'RELEASE_GOVERNANCE'],
    minimumApprovals: 2,
    separationOfDuties: true,
    approvalTtlSeconds: 86_400,
    policyVersionBinding: true,
  },
]);

export function thresholdForOperation(operationType: string): GovernanceThresholdConfig | null {
  return DEFAULT_GOVERNANCE_THRESHOLDS.find((row) => row.operationType === operationType) ?? null;
}

export function assertExpiredApprovalRejected(
  approval: GovernanceApproval,
  now: string,
): SecurityResult<true> {
  if (Date.parse(now) >= Date.parse(approval.expiresAt)) {
    return securityErr('CREDENTIAL_EXPIRED', 'governance approval has expired');
  }
  return securityOk(true);
}

export function assertServiceCannotGovern(
  actorKind: 'HUMAN' | 'SERVICE' | 'AGENT' | 'AI',
): SecurityResult<true> {
  if (actorKind !== 'HUMAN') {
    return securityErr('AI_ROLE_FORBIDDEN', 'only authorized humans may approve governance');
  }
  return securityOk(true);
}
