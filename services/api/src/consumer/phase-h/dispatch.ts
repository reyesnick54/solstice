/**
 * Consumer BFF dispatch for Phase H Vault / HIN / economy-data routes.
 */

import { bffError } from '../errors.ts';
import type { BffPrincipal } from '../ports.ts';
import type { PhaseHProductSurface } from './surface.ts';
import type { RightsRequestKind } from './types.ts';

type DispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

type DispatchResponse = {
  readonly status: number;
  readonly body: unknown;
};

function json(status: number, body: unknown): DispatchResponse {
  return { status, body };
}

function rec(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function mapResult(
  requestId: string,
  result: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly code: string; readonly message: string },
  okStatus = 200,
): DispatchResponse {
  if (result.ok) {
    return json(okStatus, result.value);
  }
  const status =
    result.code === 'CROSS_SUBJECT_DENIED' || result.code === 'RESOURCE_NOT_OWNED'
      ? 403
      : result.code === 'NOT_FOUND' || result.code === 'VAULT_NOT_FOUND' || result.code === 'ASSET_NOT_FOUND'
        ? 404
        : 400;
  return json(
    status,
    bffError({
      errorCode: status === 403 ? 'RESOURCE_NOT_OWNED' : status === 404 ? 'NOT_FOUND' : 'VALIDATION',
      category: status === 403 ? 'AUTHORIZATION' : status === 404 ? 'NOT_FOUND' : 'VALIDATION',
      message: result.message,
      retryable: false,
      requestId,
      detailsSafeForClient: { code: result.code },
    }),
  );
}

export function dispatchPhaseH(
  surface: PhaseHProductSurface,
  request: DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
): DispatchResponse | null {
  const { method, path, body } = request;
  const input = rec(body);

  if (path === '/api/v1/data' && method === 'GET') {
    return json(200, surface.vaultHome(principal));
  }
  if (path === '/api/v1/data/categories' && method === 'GET') {
    return json(200, surface.categories());
  }
  if (path === '/api/v1/data/sources' && method === 'GET') {
    return json(200, surface.sources());
  }
  if (path === '/api/v1/data/records' && method === 'GET') {
    return json(200, surface.listRecords(principal));
  }
  if (path === '/api/v1/data/records' && method === 'POST') {
    return mapResult(requestId, surface.createUserDeclared(principal, {
      key: str(input.key),
      value: str(input.value),
      idempotencyKey: str(input.idempotencyKey),
    }), 201);
  }
  if (path === '/api/v1/data/records/ingest' && method === 'POST') {
    const kind = str(input.kind);
    return mapResult(
      requestId,
      surface.ingestSourceBacked(principal, {
        kind: kind === 'TRANSACTIONS' || kind === 'RECEIPT' || kind === 'PAYROLL' ? kind : 'PAYROLL',
        idempotencyKey: str(input.idempotencyKey),
      }),
      201,
    );
  }
  if (path === '/api/v1/data/access-history' && method === 'GET') {
    return json(200, surface.accessHistory(principal));
  }
  if (path === '/api/v1/data/permissions' && method === 'GET') {
    return json(200, surface.permissions(principal));
  }
  if (path === '/api/v1/data/permissions' && method === 'POST') {
    const purpose = str(input.purpose) === 'DATA_CONTRIBUTION_RESEARCH' ? 'DATA_CONTRIBUTION_RESEARCH' : 'PERSONAL_AGENT_ANALYSIS';
    const categories = Array.isArray(input.categories) ? input.categories.filter((row): row is string => typeof row === 'string') : ['PAYROLL_DATA'];
    return mapResult(requestId, surface.grantPermission(principal, { purpose, categories, idempotencyKey: str(input.idempotencyKey) }), 201);
  }
  if (path === '/api/v1/data/consent' && method === 'GET') {
    return json(200, surface.permissions(principal));
  }
  if (path === '/api/v1/data/agent-access' && method === 'GET') {
    return json(200, surface.agentAccess(principal));
  }
  if (path === '/api/v1/data/agent-access/read' && method === 'POST') {
    return mapResult(requestId, surface.agentRead(principal, { recordId: str(input.recordId), category: str(input.category) }));
  }
  if (path === '/api/v1/data/agent-access/summary' && method === 'GET') {
    return json(200, surface.vaultSummaryForAgent(principal));
  }
  if (path === '/api/v1/data/hin' && method === 'GET') {
    return json(200, surface.hinHome(principal));
  }
  if (path === '/api/v1/data/hin/participate' && method === 'POST') {
    return mapResult(requestId, surface.participateHin(principal));
  }
  if (path === '/api/v1/data/hin/stop/request' && method === 'POST') {
    return json(200, surface.requestHinStop(principal));
  }
  if (path === '/api/v1/data/hin/stop' && method === 'POST') {
    return mapResult(requestId, surface.confirmHinStop(principal));
  }
  if (path === '/api/v1/data/contributions' && method === 'GET') {
    return json(200, surface.contributionsFor(principal));
  }
  if (path === '/api/v1/data/contributions' && method === 'POST') {
    return mapResult(requestId, surface.createContribution(principal, str(input.seed)), 201);
  }
  if (path === '/api/v1/data/contributions/duplicate' && method === 'POST') {
    return mapResult(requestId, surface.duplicateContribution(principal, str(input.seed) ?? 'dup'));
  }
  if (path === '/api/v1/data/earnings' && method === 'GET') {
    return json(200, surface.earnings(principal));
  }
  if (path === '/api/v1/data/licenses' && method === 'GET') {
    return json(200, surface.licenses(principal));
  }
  if (path === '/api/v1/data/licenses' && method === 'POST') {
    return mapResult(requestId, surface.requestLicense(principal, { purpose: str(input.purpose) }), 201);
  }
  if (path === '/api/v1/data/rights' && method === 'GET') {
    return json(200, surface.rightsRequests(principal));
  }
  if (path === '/api/v1/data/rights' && method === 'POST') {
    return mapResult(requestId, surface.createRightsRequest(principal, (str(input.kind) ?? 'ACCESS') as RightsRequestKind, str(input.recordId)), 201);
  }
  if (path === '/api/v1/data/export' && method === 'POST') {
    return mapResult(requestId, surface.exportOwn(principal));
  }
  if (path === '/api/v1/data/retention' && method === 'GET') {
    return json(200, surface.retention(principal));
  }
  if (path === '/api/v1/data/retention/hold' && method === 'POST') {
    return json(200, surface.setRetentionHold(principal, input.hold === true));
  }
  if (path === '/api/v1/economy/sunrey' && method === 'GET') {
    return json(200, surface.sunreyEconomy());
  }
  if (path === '/api/v1/economy/moonrey' && method === 'GET') {
    return json(200, surface.moonreyEconomy());
  }
  if (path === '/api/v1/economy/hin' && method === 'GET') {
    return json(200, surface.aggregateHin());
  }
  if (path === '/api/v1/economy/productive' && method === 'GET') {
    return json(200, surface.productiveOverview());
  }
  if (path === '/api/v1/economy/productive/observe' && method === 'POST') {
    const kind = str(input.kind);
    return mapResult(
      requestId,
      surface.observeProductive(
        kind === 'compute' || kind === 'manufacturing' || kind === 'stale' || kind === 'energy' ? kind : 'energy',
      ),
    );
  }
  if (path === '/api/v1/economy/issuance-basis' && method === 'POST') {
    return json(200, surface.issuanceBasisProposal(str(input.kind) === 'MOONREY' ? 'MOONREY' : 'HIN'));
  }
  if (path === '/api/v1/data/gates' && method === 'GET') {
    return json(200, surface.gates());
  }
  if (path === '/api/v1/data/statuses' && method === 'GET') {
    return json(200, surface.dataStatuses());
  }

  if (path.startsWith('/api/v1/data/records/')) {
    const rest = path.slice('/api/v1/data/records/'.length);
    const [recordId, action] = rest.split('/');
    if (!recordId) {
      return null;
    }
    if (!action && method === 'GET') {
      return mapResult(requestId, surface.getRecord(principal, recordId));
    }
    if (action === 'derive' && method === 'POST') {
      return mapResult(requestId, surface.deriveRecord(principal, recordId));
    }
    if (action === 'history' && method === 'GET') {
      return mapResult(requestId, surface.recordHistory(principal, recordId));
    }
    if (action === 'correct' && method === 'POST') {
      return mapResult(requestId, surface.correctRecord(principal, recordId, { key: str(input.key), value: str(input.value) }));
    }
    if (action === 'dispute' && method === 'POST') {
      return mapResult(requestId, surface.disputeRecord(principal, recordId, str(input.reason) ?? 'source_incorrect'));
    }
    if (action === 'delete' && method === 'POST') {
      return mapResult(requestId, surface.createRightsRequest(principal, 'DELETION', recordId));
    }
  }

  if (path.startsWith('/api/v1/data/permissions/') && path.endsWith('/revoke') && method === 'POST') {
    const permissionId = path.slice('/api/v1/data/permissions/'.length, -'/revoke'.length).replace(/\/$/, '');
    return mapResult(requestId, surface.revokePermission(principal, permissionId, str(input.reason) ?? 'user_revoked'));
  }
  if (path.startsWith('/api/v1/data/consent/') && path.endsWith('/receipt') && method === 'GET') {
    const consentId = path.slice('/api/v1/data/consent/'.length, -'/receipt'.length).replace(/\/$/, '');
    return mapResult(requestId, surface.consentReceipt(principal, consentId));
  }
  if (path.startsWith('/api/v1/data/licenses/')) {
    const rest = path.slice('/api/v1/data/licenses/'.length);
    const [licenseId, action] = rest.split('/');
    if (!licenseId) {
      return null;
    }
    if (action === 'approve' && method === 'POST') {
      return mapResult(requestId, surface.approveLicense(principal, licenseId));
    }
    if ((action === 'pay' || action === 'usage' || action === 'activate') && method === 'POST') {
      return mapResult(requestId, surface.payAndMeterLicense(principal, licenseId));
    }
    if (action === 'revoke' && method === 'POST') {
      return mapResult(requestId, surface.revokeLicense(principal, licenseId));
    }
  }
  if (path.startsWith('/api/v1/economy/productive/') && method === 'GET') {
    return json(200, surface.productiveOverview());
  }
  if (path.startsWith('/api/v1/data/retention/expire/') && method === 'POST') {
    const recordId = path.slice('/api/v1/data/retention/expire/'.length);
    return mapResult(requestId, surface.expireEligible(principal, recordId));
  }

  return null;
}
