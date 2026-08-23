import type { StaffOperator } from '../../../../packages/identity/src/staff/operator.ts';
import {
  isOperationalCaseDomain,
  isOperationalCaseState,
  type OperationalCaseDomain,
  type OperationalSeverity,
  type OperationalSource,
} from '../../../../packages/kernel/src/operations/types.ts';
import type { OperationsControlPlane } from '../../../../packages/kernel/src/operations/service.ts';
import { INTERNAL_API_POSTURE } from '../../../../packages/kernel/src/operations/internal-api.ts';
import type { PrivilegedStaffAction } from '../../../../packages/identity/src/staff/sod.ts';

export type InternalRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly authorization: string | undefined;
  readonly requestId?: string;
};

export type InternalResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

export type StaffDirectory = {
  resolve(authorization: string | undefined): StaffOperator | null;
};

export type InternalOpsRuntime = {
  readonly plane: OperationsControlPlane;
  readonly staff: StaffDirectory;
};

const HEADERS = Object.freeze({
  'x-sunrey-surface': 'INTERNAL_OPERATIONS',
  'cache-control': 'no-store',
});

function deny(status: number, code: string, message: string): InternalResponse {
  return {
    status,
    body: {
      errorCode: code,
      message,
      retryable: false,
      productionActive: false,
    },
    headers: HEADERS,
  };
}

function ok(body: unknown): InternalResponse {
  return { status: 200, body, headers: HEADERS };
}

function created(body: unknown): InternalResponse {
  return { status: 201, body, headers: HEADERS };
}

function bodyOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function handleInternalOps(runtime: InternalOpsRuntime, req: InternalRequest): InternalResponse {
  if (!req.path.startsWith('/internal/v1')) {
    return deny(404, 'NOT_FOUND', 'internal operations are served only under /internal/v1');
  }
  if (req.method === 'GET' && req.path === '/internal/v1/health') {
    return ok({
      ok: true,
      ...INTERNAL_API_POSTURE,
      flags: runtime.plane.flags,
    });
  }
  const operator = runtime.staff.resolve(req.authorization);
  if (!operator) {
    return deny(401, 'UNAUTHENTICATED', 'staff authentication is required');
  }
  if (req.method === 'GET' && req.path === '/internal/v1/me') {
    return ok({
      operatorId: operator.operatorId,
      roles: operator.roles,
      capabilities: operator.capabilities,
      principalKind: 'STAFF',
      productionActive: false,
    });
  }
  if (req.method === 'GET' && req.path === '/internal/v1/cases') {
    return ok({ cases: runtime.plane.exportSnapshot().cases });
  }
  if (req.method === 'POST' && req.path === '/internal/v1/cases') {
    const body = bodyOf(req.body);
    const domain = body.domain;
    if (!isOperationalCaseDomain(domain)) {
      return deny(400, 'UNKNOWN_DOMAIN', 'unknown operational case domain');
    }
    const result = runtime.plane.createCase({
      operator,
      domain: domain as OperationalCaseDomain,
      type: String(body.type ?? domain),
      subject: String(body.subject ?? ''),
      severity: (body.severity as OperationalSeverity) ?? 'MEDIUM',
      source: (body.source as OperationalSource) ?? 'OPERATOR',
      reason: String(body.reason ?? ''),
    });
    return result.ok ? created(result.value) : deny(403, result.error.code, result.error.message);
  }
  const caseMatch = /^\/internal\/v1\/cases\/([^/]+)(?:\/([a-z]+))?$/.exec(req.path);
  if (caseMatch) {
    const caseId = decodeURIComponent(caseMatch[1] ?? '');
    const verb = caseMatch[2];
    if (req.method === 'GET' && !verb) {
      const found = runtime.plane.exportSnapshot().cases.find((row) => row.caseId === caseId);
      return found ? ok(found) : deny(404, 'CASE_NOT_FOUND', 'case does not exist');
    }
    const body = bodyOf(req.body);
    if (req.method === 'POST' && verb === 'assign') {
      const result = runtime.plane.assignCase(operator, caseId, String(body.owner ?? ''), String(body.reason ?? ''));
      return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
    }
    if (req.method === 'POST' && verb === 'transition') {
      const next = body.status;
      if (!isOperationalCaseState(next)) {
        return deny(400, 'INVALID_TRANSITION', 'unknown operational state');
      }
      const result = runtime.plane.transitionCase(operator, caseId, next, String(body.reason ?? ''));
      return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
    }
    if (req.method === 'POST' && verb === 'notes') {
      const result = runtime.plane.addCaseNote(operator, caseId, String(body.body ?? ''), String(body.reason ?? 'note'));
      return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
    }
    if (req.method === 'POST' && verb === 'resolve') {
      const second = body.secondApproverToken
        ? runtime.staff.resolve(`Bearer ${String(body.secondApproverToken)}`)
        : undefined;
      const result = runtime.plane.resolveCase(
        operator,
        caseId,
        String(body.reason ?? ''),
        String(body.outcome ?? 'CLEAR'),
        second ?? undefined,
      );
      return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
    }
  }
  if (req.method === 'GET' && req.path === '/internal/v1/search') {
    const result = runtime.plane.search(operator, req.query);
    return result.ok ? ok({ cases: result.value }) : deny(400, result.error.code, result.error.message);
  }
  if (req.method === 'GET' && req.path.startsWith('/internal/v1/timeline/')) {
    const ref = decodeURIComponent(req.path.slice('/internal/v1/timeline/'.length));
    return ok({ timeline: runtime.plane.timeline(ref) });
  }
  if (req.method === 'GET' && req.path === '/internal/v1/payments') return ok({ payments: runtime.plane.paymentOps() });
  if (req.method === 'GET' && req.path === '/internal/v1/treasury') return ok({ treasury: runtime.plane.treasuryOps() });
  if (req.method === 'GET' && req.path === '/internal/v1/reconciliation') {
    return ok({ breaks: runtime.plane.reconciliationOps() });
  }
  if (req.method === 'GET' && req.path === '/internal/v1/surveillance') {
    return ok({ alerts: runtime.plane.surveillanceOps() });
  }
  if (req.method === 'GET' && req.path === '/internal/v1/custody') return ok({ wallets: runtime.plane.custodyOps() });
  if (req.method === 'GET' && req.path === '/internal/v1/providers') {
    return ok({ providers: runtime.plane.providerOps() });
  }
  if (req.method === 'GET' && req.path === '/internal/v1/agents') return ok({ agents: runtime.plane.agentOps() });
  if (req.method === 'GET' && req.path === '/internal/v1/security') {
    return ok({ events: runtime.plane.securityOps() });
  }
  if (req.method === 'POST' && req.path === '/internal/v1/actions') {
    const body = bodyOf(req.body);
    const second = body.secondApproverToken
      ? runtime.staff.resolve(`Bearer ${String(body.secondApproverToken)}`)
      : undefined;
    const result = runtime.plane.privilegedAction({
      operator,
      action: String(body.action ?? '') as PrivilegedStaffAction,
      reason: String(body.reason ?? ''),
      subjectRef: typeof body.subjectRef === 'string' ? body.subjectRef : undefined,
      caseId: typeof body.caseId === 'string' ? body.caseId : undefined,
      secondApprover: second ?? undefined,
    });
    return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
  }
  if (req.method === 'POST' && req.path === '/internal/v1/support/view') {
    const body = bodyOf(req.body);
    const result = runtime.plane.openSupportView(
      operator,
      String(body.customerId ?? ''),
      String(body.reason ?? ''),
      body.sensitive === true,
    );
    return result.ok ? ok(result.value) : deny(403, result.error.code, result.error.message);
  }
  return deny(404, 'NOT_FOUND', 'unknown internal operations route');
}
