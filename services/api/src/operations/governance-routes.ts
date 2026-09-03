/**
 * Wave 8 — governance operations HTTP routes.
 *
 * View and approve/reject according to configured authority.
 * No single-admin mint buttons.
 */

import {
  buildOperationPackage,
  developmentEvidence,
  evaluateApprovals,
  fixtureHumanApprovals,
  publicView,
  requiredRolesFor,
  signApproval,
} from '../../../../packages/sunrey-chain/src/governance-ops/engine.ts';
import type {
  GovernanceApprovalRecord,
  GovernanceOperationPackage,
} from '../../../../packages/sunrey-chain/src/governance-ops/types.ts';
import { PlatformApiError } from '../errors.ts';
import type { RouteDefinition } from '../http.ts';
import { assertInternalOperator } from '../internal-production-gates.ts';

export type GovernanceStore = {
  readonly get: (proposalId: string) => GovernanceOperationPackage | null;
  readonly approvals: (proposalId: string) => readonly GovernanceApprovalRecord[];
  readonly saveApproval: (proposalId: string, record: GovernanceApprovalRecord) => void;
};

export function createDefaultGovernanceStore(): GovernanceStore {
  const packages = new Map<string, GovernanceOperationPackage>();
  const approvals = new Map<string, GovernanceApprovalRecord[]>();
  const pkg = buildOperationPackage({
    packageId: 'gov.sandbox.fee-policy.001',
    operationType: 'FEE_POLICY',
    activation: { kind: 'HEIGHT', height: 120, epoch: null },
    evidence: developmentEvidence('gov.sandbox.fee-policy.001'),
  });
  packages.set(pkg.packageId, pkg);
  approvals.set(pkg.packageId, [...fixtureHumanApprovals(pkg)]);
  return {
    get(proposalId) {
      return packages.get(proposalId) ?? null;
    },
    approvals(proposalId) {
      return approvals.get(proposalId) ?? [];
    },
    saveApproval(proposalId, record) {
      const current = approvals.get(proposalId) ?? [];
      approvals.set(proposalId, [...current, record]);
    },
  };
}

export type GovernanceRouteOptions = {
  readonly operatorToken?: string | undefined;
  readonly store?: GovernanceStore;
};

const APPROVER_ROLES = new Set(['GOVERNANCE_ADMIN', 'HUMAN_GOVERNANCE']);

export function createInternalGovernanceRoutes(options: GovernanceRouteOptions = {}): readonly RouteDefinition[] {
  const store = options.store ?? createDefaultGovernanceStore();
  const guard = (headers: Readonly<Record<string, string>>): void => {
    assertInternalOperator(headers, options.operatorToken);
  };
  const proposalIdFromParams = (params: Readonly<Record<string, string>>): string => {
    const proposalId = params.proposalId;
    if (!proposalId) {
      throw notFound('proposal id required');
    }
    return proposalId;
  };

  return Object.freeze([
    {
      method: 'GET',
      path: '/internal/v1/governance/proposals/:proposalId',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers, params }) => {
        guard(headers);
        const proposalId = proposalIdFromParams(params);
        const pkg = store.get(proposalId);
        if (!pkg) {
          throw notFound('proposal not found');
        }
        const approvalSet = evaluateApprovals(pkg, store.approvals(proposalId));
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            consumerSafe: false,
            proposal: pkg,
            requiredRoles: requiredRolesFor(pkg.operationType),
            approvalSet,
            publicView: publicView({ pkg, approvals: approvalSet, activation: null }),
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/governance/proposals/:proposalId/evidence',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers, params }) => {
        guard(headers);
        const proposalId = proposalIdFromParams(params);
        const pkg = store.get(proposalId);
        if (!pkg) {
          throw notFound('proposal not found');
        }
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            evidence: pkg.evidence,
            economicProof: pkg.economic ?? null,
            evidenceCommitments: Object.values(pkg.evidence),
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/governance/proposals/:proposalId/result',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers, params }) => {
        guard(headers);
        const proposalId = proposalIdFromParams(params);
        const pkg = store.get(proposalId);
        if (!pkg) {
          throw notFound('proposal not found');
        }
        const approvalSet = evaluateApprovals(pkg, store.approvals(proposalId));
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            finalized: approvalSet.satisfied,
            publicView: publicView({ pkg, approvals: approvalSet, activation: null }),
            mintAuthorized: false,
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/internal/v1/governance/proposals/:proposalId/approve',
      endpointClass: 'internal',
      requiresIdempotency: true,
      handler: async ({ headers, params, body }) => {
        guard(headers);
        const role = headers['x-sunrey-operator-role'] ?? '';
        if (!APPROVER_ROLES.has(role)) {
          throw denied('approver role required');
        }
        const proposalId = proposalIdFromParams(params);
        const pkg = store.get(proposalId);
        if (!pkg) {
          throw notFound('proposal not found');
        }
        const payload = body as Record<string, unknown>;
        const actorId = typeof payload.actorId === 'string' ? payload.actorId : 'actor.governance.reviewer';
        const approvalRole = typeof payload.role === 'string' ? payload.role : role;
        const record = signApproval({
          actorId,
          actorKind: 'HUMAN',
          role: approvalRole as never,
          pkg,
        });
        store.saveApproval(proposalId, record);
        const approvalSet = evaluateApprovals(pkg, store.approvals(proposalId));
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            accepted: record.accepted,
            approvalSet,
            mintAuthorized: false,
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/internal/v1/governance/proposals/:proposalId/reject',
      endpointClass: 'internal',
      requiresIdempotency: true,
      handler: async ({ headers, params, body }) => {
        guard(headers);
        const role = headers['x-sunrey-operator-role'] ?? '';
        if (!APPROVER_ROLES.has(role)) {
          throw denied('approver role required');
        }
        const proposalId = proposalIdFromParams(params);
        const pkg = store.get(proposalId);
        if (!pkg) {
          throw notFound('proposal not found');
        }
        const payload = body as Record<string, unknown>;
        const reason = typeof payload.reason === 'string' ? payload.reason : 'operator rejected';
        const record = signApproval({
          actorId: typeof payload.actorId === 'string' ? payload.actorId : 'actor.governance.reviewer',
          actorKind: 'HUMAN',
          role: role as never,
          pkg,
        });
        const rejected = Object.freeze({ ...record, accepted: false, rejectionReason: reason });
        store.saveApproval(proposalId, rejected);
        const approvalSet = evaluateApprovals(pkg, store.approvals(proposalId));
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            accepted: false,
            reason,
            approvalSet,
            mintAuthorized: false,
          },
        };
      },
    },
  ]);
}

function notFound(message: string): PlatformApiError {
  return new PlatformApiError({
    code: 'NOT_FOUND',
    message,
    category: 'VALIDATION',
    retryable: false,
    httpStatus: 404,
  });
}

function denied(message: string): PlatformApiError {
  return new PlatformApiError({
    code: 'AUTHORIZATION_DENIED',
    message,
    category: 'AUTHORIZATION',
    retryable: false,
    httpStatus: 403,
  });
}
