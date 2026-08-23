import { FrozenClock } from '../../../../packages/config/src/clock.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import {
  AgentQualificationPlatform,
  type AgentQualificationPlatform as AgentPlatform,
} from '../../../../packages/sunrey-agent/src/productization/platform.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

type AgentHttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly idempotencyKey?: string;
};

type AgentHttpResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

export type AgentBffFacade = {
  readonly platform: AgentQualificationPlatform;
};

export function createAgentBffFacade(now = asUtcInstant('2026-08-23T00:00:00.000Z')): AgentBffFacade {
  return {
    platform: new AgentQualificationPlatform({ clock: new FrozenClock(now) }),
  };
}

export function dispatchAgent(
  facade: AgentBffFacade,
  request: AgentHttpRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): AgentHttpResponse | null {
  const { method, path, body } = request;
  if (!path.startsWith('/api/v1/agent')) {
    return null;
  }
  if (path === '/api/v1/agent' && method === 'GET') {
    return null;
  }
  const user = facade.platform.authenticateSandboxUser(principal.customerId);
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  if (path === '/api/v1/agent/conversations' && method === 'POST') {
    const opened = facade.platform.openConversation(user);
    return mapped(opened, requestId, headers, 201);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/messages') && method === 'POST') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/messages'.length);
    return mapped(facade.platform.chat(user, id, String(rec.text ?? rec.message ?? '')), requestId, headers);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/stream') && method === 'GET') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/stream'.length);
    return mapped(facade.platform.stream(user, id, String(rec.text ?? '')), requestId, headers);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/close') && method === 'POST') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/close'.length);
    return mapped(facade.platform.closeConversation(user, id), requestId, headers);
  }
  if (path === '/api/v1/agent/actions' && method === 'GET') {
    return json(200, { items: facade.platform.listActions(user) }, headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/revise') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/revise'.length);
    return mapped(facade.platform.reviseAction(user, id, BigInt(String(rec.amountMinor ?? '0'))), requestId, headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/approve'.length);
    return mapped(facade.platform.approveAction(user, id), requestId, headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/step-up') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/step-up'.length);
    return mapped(facade.platform.stepUp(user, id), requestId, headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/execute') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/execute'.length);
    return mapped(
      facade.platform.humanExecute(user, id, String(rec.idempotencyKey ?? request.idempotencyKey ?? requestId)),
      requestId,
      headers,
    );
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/outcome') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/outcome'.length);
    return mapped(
      facade.platform.recordDomainOutcome(user, {
        actionId: id,
        state: rec.state === 'FAILED' ? 'FAILED' : 'COMPLETED',
        ledgerJournalId: typeof rec.ledgerJournalId === 'string' ? rec.ledgerJournalId : null,
        providerRef: typeof rec.providerRef === 'string' ? rec.providerRef : null,
        executionAuthorityRef: typeof rec.executionAuthorityRef === 'string' ? rec.executionAuthorityRef : null,
        kernelDecision: typeof rec.kernelDecision === 'string' ? rec.kernelDecision : null,
      }),
      requestId,
      headers,
    );
  }
  if (path.startsWith('/api/v1/agent/actions/') && method === 'GET') {
    const id = path.slice('/api/v1/agent/actions/'.length);
    return mapped(facade.platform.getAction(user, id), requestId, headers);
  }
  if (path === '/api/v1/agent/memory' && method === 'GET') {
    return json(200, { items: facade.platform.listMemory(user) }, headers);
  }
  if (path === '/api/v1/agent/memory' && method === 'POST') {
    return mapped(facade.platform.storePreference(user, String(rec.text ?? '')), requestId, headers);
  }
  if (path === '/api/v1/agent/settings' && (method === 'GET' || method === 'PATCH')) {
    return json(200, { paused: false, modelRef: 'model:local-test', productionActive: false }, headers);
  }
  if ((path === '/api/v1/agent/pause' || path === '/api/v1/agent/revoke') && method === 'POST') {
    return mapped(facade.platform.pauseAgent(user), requestId, headers);
  }
  if (path === '/api/v1/agent/escalations' && method === 'POST') {
    const kind = rec.kind;
    const allowed = ['COMPLIANCE_QUESTION', 'FINANCIAL_DISPUTE', 'UNRESOLVED_PROVIDER_FAILURE', 'AGENT_UNCERTAINTY', 'SUSPICIOUS_BEHAVIOR'] as const;
    const picked = allowed.includes(kind as (typeof allowed)[number]) ? (kind as (typeof allowed)[number]) : 'AGENT_UNCERTAINTY';
    return json(201, facade.platform.escalate(user, picked, String(rec.summary ?? 'escalation'), null), headers);
  }
  if (path.startsWith('/api/v1/agent/audit/') && method === 'GET') {
    const id = path.slice('/api/v1/agent/audit/'.length);
    return mapped(facade.platform.exportAudit(user, id), requestId, headers);
  }
  return json(
    404,
    bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'agent resource not found',
      retryable: false,
      requestId,
    }),
    headers,
  );
}

function mapped(
  result: { readonly ok: boolean; readonly value?: unknown; readonly error?: { readonly detail?: string; readonly code?: string } },
  requestId: string,
  headers: Record<string, string>,
  success = 200,
): AgentHttpResponse {
  if (result.ok) {
    return json(success, result.value ?? { ok: true }, headers);
  }
  return json(
    403,
    bffError({
      errorCode: 'RESOURCE_NOT_OWNED',
      category: 'AUTHORIZATION',
      message: result.error?.detail ?? 'agent request refused',
      retryable: false,
      requestId,
    }),
    headers,
  );
}

function json(status: number, body: unknown | BffErrorEnvelope, headers: Record<string, string>): AgentHttpResponse {
  return { status, body, headers };
}

export type { AgentPlatform };
